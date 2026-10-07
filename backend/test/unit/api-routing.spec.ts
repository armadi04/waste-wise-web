import { afterAll, beforeAll, describe, expect, it, mock } from 'bun:test';
import {
  INestApplication,
  MiddlewareConsumer,
  Module,
  NestModule,
  ValidationPipe,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { HealthCheckService, MemoryHealthIndicator } from '@nestjs/terminus';
import { SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { API_VERSION, configureApiRouting } from '@/config/api-routing';
import {
  SWAGGER_UI_PATH,
  buildSwaggerConfig,
  setupSwagger,
} from '@/config/swagger.config';
import { AppController } from '@/app.controller';
import { AppService } from '@/app.service';
import { AuthController } from '@/auth/auth.controller';
import { AuthModule } from '@/auth/auth.module';
import { AuthService } from '@/auth/auth.service';
import { TurnstileService } from '@/auth/turnstile.service';
import { TwoFactorService } from '@/auth/two-factor.service';
import { SessionsService } from '@/sessions/sessions.service';
import { SsoController } from '@/sso/sso.controller';
import { SsoService } from '@/sso/sso.service';
import { DatabaseHealthService } from '@/health/database-health.service';
import { HealthController } from '@/health/health.controller';

const tokens = {
  accessToken: 'test-access',
  refreshToken: 'test-refresh',
  sessionExpiresAt: new Date(Date.now() + 60000),
};
const auth = {
  validateUser: mock(async () => ({ id: 1, email: 'user@example.test' })),
  login: mock(async () => tokens),
  refresh: mock(async () => tokens),
  revokeSession: mock(async () => undefined),
};
const health = { check: mock(async () => ({ status: 'ok' })) };
const sso = {
  enabled: true,
  newPkce: mock(async () => ({
    verifier: 'test-verifier',
    challenge: 'test-challenge',
    state: 'test-state',
  })),
  buildAuthUrl: () => new URL('https://idp.example.test/authorize'),
  verifyLogoutToken: mock(async () => ({ sid: 'test-sid', sub: 'test-sub' })),
  exchange: mock(async () => ({
    claims: { sub: 'test-sub', email: 'user@example.test' },
    idToken: 'test-id-token',
    sid: 'test-sid',
  })),
  provisionUser: mock(async () => ({ id: 1, email: 'user@example.test' })),
  endSessionUrl: () => new URL('https://idp.example.test/logout'),
};

@Module({
  controllers: [AppController, AuthController, HealthController, SsoController],
  providers: [
    AppService,
    { provide: AuthService, useValue: auth },
    { provide: TurnstileService, useValue: { verify: async () => undefined } },
    { provide: TwoFactorService, useValue: { isEnabled: () => false } },
    { provide: SessionsService, useValue: {} },
    { provide: EventEmitter2, useValue: { emit: () => undefined } },
    { provide: HealthCheckService, useValue: health },
    { provide: DatabaseHealthService, useValue: {} },
    { provide: MemoryHealthIndicator, useValue: {} },
    { provide: SsoService, useValue: sso },
    {
      provide: ConfigService,
      useValue: new ConfigService({
        SSO_REDIRECT_URI: 'http://localhost:3001/api/v1/auth/sso/callback',
        SSO_POST_LOGOUT_URI: 'http://localhost:3001',
      }),
    },
  ],
})
class RoutingTestModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // Exercise the production middleware mapping without database/providers.
    AuthModule.prototype.configure(consumer);
  }
}

describe('REST URI version 1', () => {
  let app: INestApplication;
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [RoutingTestModule],
    }).compile();
    app = module.createNestApplication();
    app.use(cookieParser());
    configureApiRouting(app);
    app.useGlobalPipes(
      new ValidationPipe({ transform: true, whitelist: true }),
    );
    setupSwagger(app);
    await app.init();
  });
  afterAll(async () => {
    await app?.close();
  });

  it('serves root metadata, login and health under version 1', async () => {
    await request(app.getHttpServer()).get('/api/v1').expect(200, {
      name: 'Nestplate API',
      apiVersion: API_VERSION,
      docs: SWAGGER_UI_PATH,
    });
    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'user@example.test', password: 'test-password' })
      .expect(201)
      .expect(({ body }) => expect(body.accessToken).toBe(tokens.accessToken));
    await request(app.getHttpServer())
      .get('/api/v1/health')
      .expect(200, { status: 'ok' });
  });

  it('rejects old and unsupported versions without reaching handlers', async () => {
    const loginCalls = auth.login.mock.calls.length;
    const healthCalls = health.check.mock.calls.length;
    const ssoCalls = sso.newPkce.mock.calls.length;
    for (const prefix of ['/api', '/api/v2']) {
      await request(app.getHttpServer()).get(prefix).expect(404);
      await request(app.getHttpServer())
        .post(`${prefix}/auth/login`)
        .send({})
        .expect(404);
      await request(app.getHttpServer()).get(`${prefix}/health`).expect(404);
      await request(app.getHttpServer())
        .get(`${prefix}/auth/sso/login`)
        .expect(404);
      await request(app.getHttpServer())
        .post(`${prefix}/auth/refresh`)
        .expect(404);
      await request(app.getHttpServer())
        .get(`${prefix}/auth/sso/callback?code=test-code&state=test-state`)
        .expect(404);
      await request(app.getHttpServer())
        .post(`${prefix}/auth/sso/backchannel-logout`)
        .send({ logout_token: 'test-logout' })
        .expect(404);
    }
    expect(auth.login.mock.calls.length).toBe(loginCalls);
    expect(health.check.mock.calls.length).toBe(healthCalls);
    expect(sso.newPkce.mock.calls.length).toBe(ssoCalls);
  });

  it('keeps CSRF on all three protected versioned session paths', async () => {
    for (const route of ['refresh', 'logout', 'switch-role'])
      await request(app.getHttpServer())
        .post(`/api/v1/auth/${route}`)
        .expect(403);
    const calls = auth.refresh.mock.calls.length;
    await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .set('Cookie', 'refreshToken=test-refresh; csrfToken=test-csrf')
      .set('X-CSRF-Token', 'test-csrf')
      .expect(201);
    expect(auth.refresh.mock.calls.length).toBe(calls + 1);
  });

  it('uses versioned SSO cookies and handles callbacks and backchannel logout', async () => {
    const login = await request(app.getHttpServer())
      .get('/api/v1/auth/sso/login')
      .expect(302);
    expect(login.headers.location).toBe('https://idp.example.test/authorize');
    expect(login.headers['set-cookie']).toEqual(
      expect.arrayContaining([
        expect.stringContaining('ssoVerifier=test-verifier;'),
        expect.stringContaining('Path=/api/v1/auth/sso'),
      ]),
    );
    const callback = await request(app.getHttpServer())
      .get('/api/v1/auth/sso/callback?error=login_required')
      .expect(302);
    expect(
      callback.headers['set-cookie'].every((cookie: string) =>
        cookie.includes('Path=/api/v1/auth/sso'),
      ),
    ).toBe(true);
    await request(app.getHttpServer())
      .post('/api/v1/auth/sso/backchannel-logout')
      .send({ logout_token: 'test-logout' })
      .expect(200, {});
    expect(auth.revokeSession).toHaveBeenCalledWith('test-sid', 'test-sub');
  });

  it('completes SSO at the new callback and clears matching cookie paths on logout', async () => {
    const callback = await request(app.getHttpServer())
      .get('/api/v1/auth/sso/callback?code=test-code&state=test-state')
      .set('Cookie', 'ssoVerifier=test-verifier; ssoState=test-state')
      .expect(302);
    expect(sso.exchange).toHaveBeenCalledWith(
      new URL(
        'http://localhost:3001/api/v1/auth/sso/callback?code=test-code&state=test-state',
      ),
      'test-verifier',
      'test-state',
    );
    const idCookie = callback.headers['set-cookie'].find((cookie: string) =>
      cookie.startsWith('ssoIdToken='),
    );
    expect(idCookie).toContain('Path=/api/v1/auth/sso');
    const logout = await request(app.getHttpServer())
      .get('/api/v1/auth/sso/logout')
      .set('Cookie', 'ssoIdToken=test-id-token')
      .expect(302);
    expect(logout.headers.location).toBe('https://idp.example.test/logout');
    expect(
      logout.headers['set-cookie'].find((cookie: string) =>
        cookie.startsWith('ssoIdToken='),
      ),
    ).toContain('Path=/api/v1/auth/sso');
  });

  it('keeps Swagger UI stable and emits complete versioned operation paths', async () => {
    await request(app.getHttpServer()).get('/api/docs').expect(200);
    await request(app.getHttpServer()).get('/api/docs/').expect(200);
    for (const asset of [
      'swagger-ui-init.js',
      'swagger-ui-bundle.js',
      'swagger-ui-standalone-preset.js',
      'swagger-ui.css',
    ])
      await request(app.getHttpServer()).get(`/api/docs/${asset}`).expect(200);
    await request(app.getHttpServer())
      .get('/api/docs/openapi.yaml')
      .expect(200)
      .expect(({ text }) => expect(text).toContain('/api/v1/auth/login:'));
    for (const path of [
      '/docs',
      '/docs-json',
      '/docs-yaml',
      '/api/api/docs',
      '/api/api/docs/openapi.json',
      '/api/docs-json',
      '/api/docs-yaml',
      '/api/v1/docs',
    ])
      await request(app.getHttpServer()).get(path).expect(404);
    const response = await request(app.getHttpServer())
      .get('/api/docs/openapi.json')
      .expect(200);
    const document = SwaggerModule.createDocument(app, buildSwaggerConfig());
    expect(response.body.paths).toEqual(document.paths);
    expect(Object.keys(document.paths)).toContain('/api/v1/auth/login');
    expect(Object.keys(document.paths)).toContain('/api/v1/health');
    expect(
      Object.keys(document.paths).every(
        (path) => path === '/api/v1' || path.startsWith('/api/v1/'),
      ),
    ).toBe(true);
    const rootResponse = document.paths['/api/v1'].get?.responses['200'];
    expect(rootResponse).toHaveProperty(
      'content.application/json.schema.$ref',
      '#/components/schemas/ApiInfo',
    );
    expect(document.components?.schemas?.ApiInfo).toMatchObject({
      required: ['name', 'apiVersion', 'docs'],
      properties: {
        name: { example: 'Nestplate API' },
        apiVersion: { example: API_VERSION },
        docs: { example: SWAGGER_UI_PATH },
      },
    });
    expect(
      Object.keys(
        (document.components?.schemas?.ApiInfo as { properties: object })
          .properties,
      ).sort(),
    ).toEqual(['apiVersion', 'docs', 'name']);
    expect(document.paths['/api/v1/health'].get?.responses).toHaveProperty(
      '200',
    );
    expect(document.paths['/api/v1/health'].get?.responses).toHaveProperty(
      '503',
    );
    expect(document.servers ?? []).toEqual([]);
    expect(document.components?.securitySchemes?.bearer).toEqual({
      scheme: 'bearer',
      bearerFormat: 'JWT',
      type: 'http',
    });
  });
});
