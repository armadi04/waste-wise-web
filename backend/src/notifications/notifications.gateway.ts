import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { Logger } from '@nestjs/common';
import { Notification } from './entities/notification.entity';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { AppRefreshService } from '../app-refresh/app-refresh.service';
import { AuthService } from '../auth/auth.service';
import { SessionsService } from '../sessions/sessions.service';

/** Same allow-list as REST CORS; credentials only with an explicit list. */
function socketCors() {
  const origins = (process.env.ALLOWED_ORIGINS ?? '*')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  if (!origins.length || origins.includes('*')) return { origin: '*' };
  return { origin: origins, credentials: true };
}

@WebSocketGateway({
  cors: socketCors(),
  namespace: 'notifications',
})
export class NotificationsGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private logger = new Logger('NotificationsGateway');

  constructor(
    private readonly jwtService: JwtService,
    private readonly appRefresh: AppRefreshService,
    private readonly authService: AuthService,
    private readonly sessionsService: SessionsService,
  ) {}

  /** Reads the accessToken from the raw Cookie header of the WS handshake. */
  private tokenFromCookie(client: Socket): string | undefined {
    const cookieHeader = client.handshake.headers.cookie;
    if (!cookieHeader) return undefined;
    for (const part of cookieHeader.split(';')) {
      const [name, ...rest] = part.trim().split('=');
      if (name === 'accessToken') return decodeURIComponent(rest.join('='));
    }
    return undefined;
  }

  async handleConnection(client: Socket) {
    try {
      const authHeader = client.handshake.headers.authorization;
      // Browser SPA sends the httpOnly cookie in the handshake (withCredentials);
      // mobile / non-browser clients pass a bearer token via auth.token / header.
      const token =
        (client.handshake.auth.token as string) ||
        authHeader?.split(' ')[1] ||
        this.tokenFromCookie(client);

      if (!token) {
        this.logger.warn(`Connection attempt without token: ${client.id}`);
        client.disconnect();
        return;
      }

      const payload = await this.jwtService.verifyAsync<JwtPayload>(token);
      // Same rule as the HTTP strategy: only signed-in sessions, never a
      // two-factor challenge or a refresh token.
      if (payload.tokenType === '2fa' || payload.tokenType === 'refresh') {
        this.logger.warn(`Rejected non-session token: ${client.id}`);
        client.disconnect();
        return;
      }
      // Same revocation rules as JwtStrategy: signed-out tokens, revoked device
      // sessions and deactivated accounts must not keep a live channel.
      if (await this.authService.isTokenBlacklisted(token)) {
        this.logger.warn(`Rejected blacklisted token: ${client.id}`);
        client.disconnect();
        return;
      }
      if (
        payload.sessionId &&
        !(await this.sessionsService.isActive(payload.sessionId))
      ) {
        this.logger.warn(`Rejected revoked session: ${client.id}`);
        client.disconnect();
        return;
      }
      const account = await this.authService.getProfile(payload.sub);
      if (!account || account.isActive === false) {
        this.logger.warn(`Rejected inactive account: ${client.id}`);
        client.disconnect();
        return;
      }
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      client.data.user = payload;

      const userId = payload.sub;
      void client.join(`user_${userId}`);

      if (payload.roles && Array.isArray(payload.roles)) {
        payload.roles.forEach((role) => {
          void client.join(`role_${role}`);
          this.logger.debug(`Client ${client.id} joined room: role_${role}`);
        });
      }

      // Replay the standing force-refresh signal so a client that was offline
      // when it was issued still reloads. It carries a timestamp, so a client
      // that already applied this one ignores it.
      const refreshAt = this.appRefresh.current();
      if (refreshAt) client.emit('app_refresh', { issuedAt: refreshAt });

      this.logger.log(`Client connected: ${client.id} (User: ${userId})`);
    } catch (e: unknown) {
      const error = e as Error;
      this.logger.error(`Connection error: ${error.message}`);
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  /** Tell every connected client to drop its cache and reload. */
  broadcastRefresh(issuedAt: string) {
    this.server.emit('app_refresh', { issuedAt });
    this.logger.log(`Broadcast force-refresh (${issuedAt})`);
  }

  async sendNotification(notification: Notification) {
    const excludeUserId = notification.actorId;

    if (notification.userId) {
      if (notification.userId === excludeUserId) return;
      this.server
        .to(`user_${notification.userId}`)
        .emit('new_notification', notification);
    }

    if (notification.targetRole) {
      const room = `role_${notification.targetRole}`;
      if (excludeUserId) {
        const sockets = await this.server.in(room).fetchSockets();
        for (const socket of sockets) {
          const user = (socket.data as { user?: JwtPayload }).user;
          if (user?.sub !== excludeUserId) {
            socket.emit('new_notification', notification);
          }
        }
      } else {
        this.server.to(room).emit('new_notification', notification);
      }
    }
  }
}
