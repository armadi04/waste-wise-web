import 'reflect-metadata';
import '@nestjs/core';
import { afterAll, beforeAll, describe, expect, it, mock } from 'bun:test';
import { Global, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { ThrottlerModule } from '@nestjs/throttler';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import type { Logger } from 'nestjs-pino';
import { createHttpAdapter, registerHttpPlugins } from '@/config/http';
import { configureApiRouting } from '@/config/api-routing';
import { AllExceptionsFilter } from '@/common/filters/all-exceptions.filter';
import { GqlThrottlerGuard } from '@/common/guards/gql-throttler.guard';
import { JwtStrategy } from '@/auth/jwt.strategy';
import { AuthService } from '@/auth/auth.service';
import { SessionsService } from '@/sessions/sessions.service';
import { GraphqlApiModule } from '@/graphql/graphql-api.module';
import { DataloaderModule } from '@/graphql/dataloaders/dataloader.module';
import { DataloaderService } from '@/graphql/dataloaders/dataloader.service';
import { UsersModule } from '@/users/users.module';
import { UsersService } from '@/users/users.service';
import { RolesModule } from '@/roles/roles.module';
import { RolesService } from '@/roles/roles.service';
import { PermissionsModule } from '@/permissions/permissions.module';
import { PermissionsService } from '@/permissions/permissions.service';
import { MediaModule } from '@/media/media.module';
import { MediaService } from '@/media/media.service';
import { NotificationsModule } from '@/notifications/notifications.module';
import { NotificationsService } from '@/notifications/notifications.service';
import { InvitationsModule } from '@/invitations/invitations.module';
import { InvitationsService } from '@/invitations/invitations.service';
import { NotificationsGateway } from '@/notifications/notifications.gateway';
import { AppRefreshService } from '@/app-refresh/app-refresh.service';

const secret = 'graphql-socket-test-secret';
const jwt = new JwtService({ secret });
const token = jwt.sign({ sub: 1, email: 'user@example.test', roles: ['user'] });
const user = {
  id: 1,
  email: 'user@example.test',
  emailVerifiedAt: new Date(),
  roles: [],
  permissions: [],
};
const findOne = mock(async (id: number) => ({
  id,
  email: `user${id}@example.test`,
}));
const createLoaders = mock(() => ({
  userRoles: { load: async () => [] },
  userPermissions: { load: async () => [] },
}));
const services = [
  {
    provide: ConfigService,
    useValue: new ConfigService({ JWT_SECRET: secret }),
  },
  { provide: DataloaderService, useValue: { createLoaders } },
  { provide: UsersService, useValue: { findOne } },
  ...[
    RolesService,
    PermissionsService,
    MediaService,
    NotificationsService,
    InvitationsService,
    SessionsService,
  ].map((provide) => ({ provide, useValue: {} })),
  {
    provide: AuthService,
    useValue: {
      isTokenBlacklisted: async () => false,
      getProfile: async () => user,
    },
  },
];
@Global()
@Module({
  providers: services,
  exports: services.map((service) => service.provide),
})
class MockFeaturesModule {}

describe('Production GraphQL module with mocked feature services', () => {
  let app: NestFastifyApplication;
  beforeAll(async () => {
    const builder = Test.createTestingModule({
      imports: [
        MockFeaturesModule,
        GraphqlApiModule,
        ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }]),
      ],
      providers: [
        JwtStrategy,
        { provide: APP_GUARD, useClass: GqlThrottlerGuard },
      ],
    });
    for (const module of [
      UsersModule,
      RolesModule,
      PermissionsModule,
      MediaModule,
      NotificationsModule,
      InvitationsModule,
      DataloaderModule,
    ])
      builder.overrideModule(module).useModule(MockFeaturesModule);
    const module = await builder.compile();
    app = module.createNestApplication<NestFastifyApplication>(
      createHttpAdapter(),
      { logger: false },
    );
    await registerHttpPlugins(app);
    configureApiRouting(app);
    app.useGlobalFilters(
      new AllExceptionsFilter({ error: mock() } as unknown as Logger),
    );
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });
  afterAll(async () => {
    await app?.close();
  });

  it('serves the actual schema and allocates independent loaders per operation', async () => {
    const before = createLoaders.mock.calls.length;
    for (let i = 0; i < 2; i++) {
      const res = await app.inject({
        method: 'POST',
        url: '/graphql',
        payload: { query: '{ _health }' },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({ data: { _health: 'ok' } });
    }
    expect(createLoaders.mock.calls.length).toBe(before + 2);
    expect(createLoaders.mock.results.at(-1)?.value).not.toBe(
      createLoaders.mock.results.at(-2)?.value,
    );
  });

  it('authenticates cookies/Bearer on GraphQL and supplies reply to the production throttle guard', async () => {
    for (const headers of [
      { cookie: `accessToken=${token}` },
      { authorization: `Bearer ${token}` },
    ]) {
      const res = await app.inject({
        method: 'POST',
        url: '/graphql',
        headers,
        payload: { query: '{ user(id: 1) { id email roles { id } } }' },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({
        data: { user: { id: 1, email: 'user1@example.test', roles: [] } },
      });
      expect(res.headers['x-ratelimit-limit']).toBe('100');
    }
    const unauthorized = await app.inject({
      method: 'POST',
      url: '/graphql',
      payload: { query: '{ user(id: 1) { id } }' },
    });
    expect(unauthorized.json().errors[0].extensions.code).toBe(
      'UNAUTHENTICATED',
    );
    const forbidden = await app.inject({
      method: 'POST',
      url: '/graphql',
      headers: { authorization: `Bearer ${token}` },
      payload: { query: '{ user(id: 2) { id } }' },
    });
    expect(forbidden.json().errors[0].extensions.code).toBe('FORBIDDEN');
  });
});

describe('Socket.IO HTTP transport on the Fastify HTTP server, without database', () => {
  let app: NestFastifyApplication;
  let base: string;
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      providers: [
        NotificationsGateway,
        { provide: JwtService, useValue: jwt },
        {
          provide: AppRefreshService,
          useValue: { current: () => '2026-10-26T00:00:00.000Z' },
        },
      ],
    }).compile();
    app = module.createNestApplication<NestFastifyApplication>(
      createHttpAdapter(),
      { logger: false },
    );
    await app.listen(0, '127.0.0.1');
    base = `${await app.getUrl()}/socket.io/?EIO=4&transport=polling`;
  });
  afterAll(async () => {
    await app?.close();
  });

  async function connect(
    headers: Record<string, string>,
    auth: Record<string, string>,
  ) {
    const open = await fetch(base, { headers });
    const handshake = await open.text();
    expect(open.status).toBe(200);
    expect(handshake[0]).toBe('0');
    const { sid } = JSON.parse(handshake.slice(1));
    const url = `${base}&sid=${sid}`;
    await fetch(url, {
      method: 'POST',
      headers: { ...headers, 'content-type': 'text/plain' },
      body: `40/notifications,${JSON.stringify(auth)}`,
    });
    const response = await fetch(url, { headers });
    const packets = await response.text();
    await fetch(url, {
      method: 'POST',
      headers: { ...headers, 'content-type': 'text/plain' },
      body: '1',
    });
    return packets;
  }

  it('keeps the notifications namespace, legacy cookie auth and refresh replay', async () => {
    for (const [headers, auth] of [
      [{ cookie: `accessToken=${encodeURIComponent(token)}` }, {}],
      [{}, { token }],
      [{ authorization: `Bearer ${token}` }, {}],
    ] as [Record<string, string>, Record<string, string>][]) {
      const packets = await connect(headers, auth);
      expect(packets).toContain('40/notifications,');
      expect(packets).toContain('app_refresh');
    }
  });

  it('disconnects missing, invalid and non-session JWTs', async () => {
    for (const auth of [
      {},
      { token: 'invalid' },
      { token: jwt.sign({ sub: 1, tokenType: 'refresh' }) },
      { token: jwt.sign({ sub: 1, tokenType: '2fa' }) },
    ]) {
      const packets = await connect({}, auth);
      expect(packets).toContain('41/notifications,');
      expect(packets).not.toContain('app_refresh');
    }
  });
});
