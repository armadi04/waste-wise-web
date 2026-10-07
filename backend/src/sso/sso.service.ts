import {
  Injectable,
  Logger,
  OnModuleInit,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as crypto from 'crypto';
import { PassportClient } from '@univstekom/passport-sdk';
import { RegisterMethodEnum } from '@/users/register-method.enum';
import { UsersService } from '../users/users.service';
import { Role } from '../roles/entities/role.entity';
import { User } from '../users/entities/user.entity';

const SCOPE = 'openid email profile roles divisions offline_access';

export interface SsoClaims {
  sub: string;
  email?: string;
  email_verified?: boolean;
  name?: string | null;
  phone_number?: string | null;
  sid?: string;
}

export interface SsoCallbackResult {
  claims: SsoClaims;
  idToken: string;
  sid?: string;
}

/**
 * Thin wrapper over `@univstekom/passport-sdk`'s `PassportClient`. The SDK owns
 * the OIDC protocol (discovery, PKCE, code exchange, ID-token verification,
 * back-channel logout); this service keeps the app-specific bits — user
 * provisioning — and preserves the method surface `SsoController` depends on.
 */
@Injectable()
export class SsoService implements OnModuleInit {
  private readonly logger = new Logger(SsoService.name);
  private client?: PassportClient;

  constructor(
    private readonly env: ConfigService,
    private readonly usersService: UsersService,
    @InjectRepository(Role)
    private readonly rolesRepository: Repository<Role>,
  ) {}

  // Provision-or-update the local user for an SSO identity. SSO is the identity
  // source: a first-time user is auto-created (email-based, auto-verified, with a
  // random unusable password) and granted the configured default role; the
  // SSO roles/permissions claims are intentionally ignored (managed in-app).
  async provisionUser(claims: SsoClaims): Promise<Omit<User, 'password'>> {
    const email = claims.email!;
    const existing = await this.usersService.findOneByEmail(email);

    if (!existing) {
      const defaultRoleName =
        this.env.get<string>('SSO_DEFAULT_ROLE') ?? 'user';
      const role = await this.rolesRepository.findOneBy({
        name: defaultRoleName,
      });
      await this.usersService.create(
        {
          email,
          password: crypto.randomBytes(32).toString('hex'),
          fullname: claims.name ?? undefined,
          phone: claims.phone_number ?? undefined,
          roleIds: role ? [role.id] : undefined,
        },
        { autoVerify: true, registerMethod: RegisterMethodEnum.SSO },
      );
    } else if (
      (claims.name && claims.name !== existing.fullname) ||
      (claims.phone_number && claims.phone_number !== existing.phone)
    ) {
      await this.usersService.update(existing.id, {
        fullname: claims.name ?? existing.fullname ?? undefined,
        phone: claims.phone_number ?? existing.phone ?? undefined,
      });
    }

    // Reload with roles + role permissions so login() can build the JWT claims.
    const user = await this.usersService.findOneByEmail(email);
    if (!user) {
      throw new UnauthorizedException('Failed to provision SSO user');
    }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password, ...result } = user;
    return result;
  }

  get enabled(): boolean {
    return !!this.client;
  }

  async onModuleInit(): Promise<void> {
    const issuer = this.env.get<string>('SSO_ISSUER');
    const clientId = this.env.get<string>('SSO_CLIENT_ID');
    const clientSecret = this.env.get<string>('SSO_CLIENT_SECRET');

    if (!issuer || !clientId || !clientSecret) {
      this.logger.log(
        'SSO not configured (SSO_ISSUER unset) — SSO login disabled',
      );
      return;
    }

    try {
      const client = new PassportClient({
        issuer,
        clientId,
        clientSecret,
        redirectUri: this.env.getOrThrow<string>('SSO_REDIRECT_URI'),
        postLogoutRedirectUri: this.env.get<string>('SSO_POST_LOGOUT_URI'),
        scope: SCOPE,
        tokenEndpointAuthMethod: 'client_secret_post',
      });
      await client.discover();
      this.client = client;
      this.logger.log(`SSO discovery complete for issuer ${issuer}`);
    } catch (err) {
      this.logger.error(
        'SSO discovery failed — SSO login disabled',
        err instanceof Error ? err.stack : String(err),
      );
    }
  }

  private requireClient(): PassportClient {
    if (!this.client) {
      throw new ServiceUnavailableException('SSO is not configured');
    }
    return this.client;
  }

  async newPkce(): Promise<{
    verifier: string;
    challenge: string;
    state: string;
  }> {
    const state = await this.requireClient().createLoginState();
    return {
      verifier: state.codeVerifier,
      challenge: state.codeChallenge,
      state: state.state,
    };
  }

  // `prompt: 'none'` requests a silent authorization — the IdP either returns a
  // code (an active session exists) or errors with `login_required`.
  buildAuthUrl(challenge: string, state: string, prompt?: 'none'): URL {
    return this.requireClient().authorizationUrl({
      codeChallenge: challenge,
      state,
      ...(prompt ? { prompt } : {}),
    });
  }

  async exchange(
    currentUrl: URL,
    verifier: string,
    state: string,
  ): Promise<SsoCallbackResult> {
    const client = this.requireClient();
    const result = await client.handleCallback(currentUrl, {
      codeVerifier: verifier,
      expectedState: state,
    });

    // The provider keeps the ID token minimal (sub + sid). Identity claims —
    // email/name/phone_number — are released via UserInfo, so fetch them there.
    const identity = await client.userInfo(result.accessToken);
    const claims: SsoClaims = { ...identity, sid: result.sid };
    if (!claims.email) {
      throw new UnauthorizedException(
        'SSO identity did not include an email claim',
      );
    }
    return { claims, idToken: result.idToken, sid: result.sid };
  }

  endSessionUrl(idToken: string): URL {
    return this.requireClient().endSessionUrl({ idToken });
  }

  // Verify a back-channel logout_token (OIDC Back-Channel Logout spec). The SDK
  // checks the RS256 signature against the IdP JWKS, the iss/aud, the logout
  // event claim, and the absence of a nonce. Returns the targeted session/subject.
  async verifyLogoutToken(
    logoutToken: string,
  ): Promise<{ sid?: string; sub?: string }> {
    return this.requireClient().verifyLogoutToken(logoutToken);
  }
}
