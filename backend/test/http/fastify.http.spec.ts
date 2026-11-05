import 'reflect-metadata';
import '@nestjs/core';
import { afterAll, beforeAll, describe, expect, it, mock } from 'bun:test';
import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  ValidationPipe,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { GqlThrottlerGuard } from '@/common/guards/gql-throttler.guard';
import { SessionCsrfGuard } from '@/auth/session-csrf.guard';
import { ConfigService } from '@nestjs/config';
import { CacheModule } from '@nestjs/cache-manager';
import { JwtService } from '@nestjs/jwt';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  FileInterceptor,
  MultipartModule,
  type UploadedMultipartFile,
} from '@nestjs/platform-fastify/multipart';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import type { FastifyRequest } from 'fastify';
import type { Logger } from 'nestjs-pino';
import { AuthController } from '@/auth/auth.controller';
import { AuthService } from '@/auth/auth.service';
import { JwtStrategy } from '@/auth/jwt.strategy';
import { CookieCsrfGuard } from '@/auth/cookie-csrf.guard';
import { TurnstileService } from '@/auth/turnstile.service';
import { TwoFactorService } from '@/auth/two-factor.service';
import { SessionsService } from '@/sessions/sessions.service';
import { UsersController } from '@/users/users.controller';
import { UsersService } from '@/users/users.service';
import { MediaController } from '@/media/media.controller';
import { MediaService } from '@/media/media.service';
import { MediaUploadPipe } from '@/media/media-upload.pipe';
import { mediaMultipartOptions } from '@/media/media-multipart.config';
import { MediaUploadAdmissionInterceptor } from '@/media/media-upload-admission.interceptor';
import { CacheService } from '@/common/cache/cache.service';
import { AllExceptionsFilter } from '@/common/filters/all-exceptions.filter';
import {
  createHttpAdapter,
  registerHttpPlugins,
  configureHttpCors,
} from '@/config/http';
import { configureApiRouting } from '@/config/api-routing';
import { ManageRolesDto } from '@/users/dto/manage-roles.dto';

const secret = 'isolated-http-test-secret';
const jwt = new JwtService({ secret });
const token = jwt.sign({ sub: 1, email: 'user@example.test' });
const profile = {
  id: 1,
  email: 'user@example.test',
  emailVerifiedAt: new Date(),
  roles: [
    {
      name: 'admin',
      permissions: [{ name: 'media.create' }, { name: 'media.read' }],
    },
  ],
  permissions: [],
};
const tokens = () => ({
  accessToken: token,
  refreshToken: 'legacy-refresh',
  sessionExpiresAt: new Date(Date.now() + 3600_000),
});
const config = new ConfigService({
  JWT_SECRET: secret,
  MEDIA_MAX_FILE_SIZE: 2 * 1024 * 1024,
  MEDIA_MAX_CONCURRENT_UPLOADS: 1,
});
const auth = {
  validateUser: mock(async () => profile),
  login: mock(async () => tokens()),
  refresh: mock(async () => tokens()),
  isTokenBlacklisted: mock(async () => false),
  getProfile: mock(async () => profile),
  blacklistToken: mock(async () => undefined),
  switchRole: mock(async () => tokens()),
};
const uploadPipe = new MediaUploadPipe(config);
const upload = mock(async (file: UploadedMultipartFile, userId: number) => {
  const validated = await uploadPipe.transform(file);
  return {
    id: 7,
    userId,
    name: validated.originalname,
    size: validated.size,
    mimeType: validated.mimetype,
  };
});
const updateUser = mock(async (_user: unknown, id: number, dto: object) => ({
  id,
  ...dto,
}));

@Controller('fixture')
class FixtureController {
  @Post('form') form(@Body() body: ManageRolesDto) {
    return body;
  }
  @Get('ip') ip(@Req() req: FastifyRequest) {
    return {
      ip: req.ip,
      ips: req.ips,
      protocol: req.protocol,
      hostname: req.hostname,
    };
  }
  @Get('error') error() {
    throw new Error('secret-provider-details');
  }
  @Post('cookie-write') @UseGuards(CookieCsrfGuard) cookieWrite() {
    return { ok: true };
  }
  @Post('parts')
  @UseInterceptors(FileInterceptor('file', { limits: { parts: 2 } }))
  parts(@UploadedFile() file: UploadedMultipartFile, @Body() body: object) {
    return { size: file?.size, body };
  }
}

type Part = { name: string; value: string | Buffer; filename?: string };
function multipart(parts: Part[]) {
  const boundary = 'nestplate-http-test-boundary';
  const payload = Buffer.concat([
    ...parts.flatMap((part) => [
      Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="${part.name}"${part.filename === undefined ? '' : `; filename="${part.filename}"`}\r\n${part.filename === undefined ? '' : 'Content-Type: application/octet-stream\r\n'}\r\n`,
      ),
      Buffer.from(part.value),
      Buffer.from('\r\n'),
    ]),
    Buffer.from(`--${boundary}--\r\n`),
  ]);
  return {
    payload,
    headers: {
      'content-type': `multipart/form-data; boundary=${boundary}`,
      authorization: `Bearer ${token}`,
    },
  };
}
const png = Buffer.from(
  '89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c489',
  'hex',
);
const filePart = (value = png, name = 'file'): Part => ({
  name,
  filename: 'pixel.png',
  value,
});

async function createFixture(
  trustProxy?: string,
  origins = 'https://app.example.test',
  throttle?: number,
) {
  const module = await Test.createTestingModule({
    imports: [
      CacheModule.register(),
      MultipartModule.register(mediaMultipartOptions(config)),
      ...(throttle
        ? [ThrottlerModule.forRoot([{ ttl: 60000, limit: throttle }])]
        : []),
    ],
    controllers: [
      AuthController,
      MediaController,
      UsersController,
      FixtureController,
    ],
    providers: [
      { provide: APP_GUARD, useClass: SessionCsrfGuard },
      ...(throttle
        ? [{ provide: APP_GUARD, useClass: GqlThrottlerGuard }]
        : []),
      JwtStrategy,
      MediaUploadAdmissionInterceptor,
      { provide: ConfigService, useValue: config },
      { provide: AuthService, useValue: auth },
      {
        provide: TurnstileService,
        useValue: { verify: async () => undefined },
      },
      { provide: TwoFactorService, useValue: { isEnabled: () => false } },
      { provide: SessionsService, useValue: { revokeBySessionId: mock() } },
      { provide: EventEmitter2, useValue: { emit: mock() } },
      {
        provide: MediaService,
        useValue: {
          uploadFile: upload,
          findOne: async () => ({ id: 7, userId: 1, isPrivate: false }),
          getSignedUrl: async () => 'https://storage.example.test/file',
        },
      },
      { provide: UsersService, useValue: { updateAs: updateUser } },
      {
        provide: CacheService,
        useValue: { clearKeys: mock(async () => undefined) },
      },
    ],
  }).compile();
  const app = module.createNestApplication<NestFastifyApplication>(
    createHttpAdapter(trustProxy),
    { logger: false },
  );
  await registerHttpPlugins(app);
  configureHttpCors(app, origins);
  configureApiRouting(app);
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
  app.useGlobalFilters(
    new AllExceptionsFilter({ error: mock() } as unknown as Logger),
  );
  await app.init();
  await app.getHttpAdapter().getInstance().ready();
  return app;
}

describe('Fastify HTTP integration without database or external services', () => {
  let app: NestFastifyApplication;
  beforeAll(async () => {
    app = await createFixture();
  });
  afterAll(async () => {
    await app?.close();
  });

  it('accepts legacy unsigned JWT cookies and Bearer tokens, never query tokens, through real Passport', async () => {
    for (const options of [
      { headers: { cookie: `accessToken=${encodeURIComponent(token)}` } },
      { headers: { authorization: `Bearer ${token}` } },
    ]) {
      const res = await app.inject({ url: '/api/v1/auth/me', ...options });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toMatchObject({
        userId: 1,
        emailVerified: true,
        roles: ['admin'],
      });
    }
    expect(
      (await app.inject({ url: '/api/v1/auth/me', query: { token } }))
        .statusCode,
    ).toBe(401);
    for (const value of [
      'bad',
      `s:${token}.invalid`,
      `j:${JSON.stringify({ token })}`,
    ]) {
      const res = await app.inject({
        url: '/api/v1/auth/me',
        headers: { cookie: `accessToken=${encodeURIComponent(value)}` },
      });
      expect(res.statusCode).toBe(401);
      expect(res.json().code).toBe('UNAUTHORIZED');
    }
  });

  it('rejects refresh and two-factor JWTs on authenticated HTTP routes', async () => {
    for (const tokenType of ['refresh', '2fa']) {
      const res = await app.inject({
        url: '/api/v1/auth/me',
        headers: { authorization: `Bearer ${jwt.sign({ sub: 1, tokenType })}` },
      });
      expect(res.statusCode).toBe(401);
    }
  });

  it('preserves JSON, urlencoded and multipart login with cookie lifetimes and flags', async () => {
    for (const data of [
      { payload: { email: profile.email, password: 'test-password' } },
      {
        payload: `email=${encodeURIComponent(profile.email)}&password=test-password`,
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
      },
      multipart([
        { name: 'email', value: profile.email },
        { name: 'password', value: 'test-password' },
      ]),
    ]) {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        ...data,
      });
      expect(res.statusCode).toBe(201);
      expect(res.json().accessToken).toBe(token);
      const cookies = res.headers['set-cookie'] as string[];
      expect(cookies).toHaveLength(4);
      for (const name of [
        'accessToken',
        'refreshToken',
        'authenticated',
        'csrfToken',
      ]) {
        const cookie = cookies.find((value) => value.startsWith(`${name}=`))!;
        expect(cookie).toContain('Path=/');
        expect(cookie).toContain('Expires=');
        const age = Number(cookie.match(/Max-Age=(\d+)/)![1]);
        expect(age).toBeGreaterThanOrEqual(3598);
        expect(age).toBeLessThanOrEqual(3600);
        expect(cookie.includes('HttpOnly')).toBe(
          ['accessToken', 'refreshToken'].includes(name),
        );
        expect(cookie).toContain(
          `SameSite=${name === 'csrfToken' ? 'Lax' : 'Strict'}`,
        );
      }
    }
  });

  it('keeps strict CSRF before Passport for session writes, including Bearer requests', async () => {
    for (const route of ['refresh', 'logout', 'switch-role']) {
      for (const headers of [
        {},
        { authorization: `Bearer ${token}` },
        { cookie: 'csrfToken=old', 'x-csrf-token': 'wrong' },
      ]) {
        const res = await app.inject({
          method: 'POST',
          url: `/api/v1/auth/${route}`,
          headers,
        });
        expect(res.statusCode).toBe(403);
        expect(res.json()).toEqual({
          statusCode: 403,
          message: 'Invalid CSRF token',
          error: 'Forbidden',
          code: 'FORBIDDEN',
        });
      }
    }
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/refresh',
      headers: {
        cookie:
          'refreshToken=legacy-refresh; csrfToken=%61aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        'x-csrf-token': 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      },
    });
    expect(res.statusCode).toBe(201);
    expect(
      (res.headers['set-cookie'] as string[]).some((cookie) =>
        cookie.startsWith('csrfToken=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa;'),
      ),
    ).toBe(true);
    const logout = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/logout',
      headers: {
        cookie: `accessToken=${token}; refreshToken=legacy-refresh; csrfToken=old`,
        'x-csrf-token': 'old',
      },
    });
    expect(logout.statusCode).toBe(201);
    expect(logout.headers['set-cookie']).toHaveLength(4);
    for (const cookie of logout.headers['set-cookie'] as string[]) {
      expect(cookie).toContain('Path=/');
      expect(cookie).toContain('Max-Age=0');
    }
  });

  it('accepts empty JSON refresh bodies and preserves nested urlencoded form arrays', async () => {
    const refresh = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/refresh',
      headers: {
        'content-type': 'application/json',
        cookie: 'refreshToken=legacy-refresh; csrfToken=old',
        'x-csrf-token': 'old',
      },
      payload: '',
    });
    expect(refresh.statusCode).toBe(201);
    const roles = await app.inject({
      method: 'POST',
      url: '/api/v1/fixture/form',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      payload: 'roles[0]=1&roles[1]=2',
    });
    expect(roles.statusCode).toBe(201);
    expect(roles.json()).toEqual({ roles: [1, 2] });
    const tooMany = await app.inject({
      method: 'POST',
      url: '/api/v1/fixture/form',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      payload: Array.from({ length: 1001 }, (_, i) => `field${i}=x`).join('&'),
    });
    expect(tooMany.statusCode).toBe(413);
    expect(tooMany.json()).toMatchObject({
      message: 'too many parameters',
      code: 'REQUEST_FAILED',
    });
  });

  it('retains the existing conditional cookie CSRF guard semantics', async () => {
    for (const [headers, status] of [
      [{ cookie: `accessToken=${token}` }, 403],
      [
        {
          cookie: `accessToken=${token}; csrfToken=old`,
          'x-csrf-token': 'old',
        },
        201,
      ],
      [
        { cookie: `accessToken=${token}`, authorization: `Bearer ${token}` },
        201,
      ],
      [{}, 201],
    ] as const) {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/fixture/cookie-write',
        headers,
      });
      expect(res.statusCode).toBe(status);
    }
  });

  it('rejects invalid CSRF before throttling, matching the former Express middleware order', async () => {
    const throttled = await createFixture(
      undefined,
      'https://app.example.test',
      1,
    );
    const headers = {
      cookie: 'refreshToken=legacy-refresh; csrfToken=old',
      'x-csrf-token': 'old',
    };
    try {
      const first = await throttled.inject({
        method: 'POST',
        url: '/api/v1/auth/refresh',
        headers,
      });
      expect(first.statusCode).toBe(201);
      const limited = await throttled.inject({
        method: 'POST',
        url: '/api/v1/auth/refresh',
        headers,
      });
      expect(limited.statusCode).toBe(429);
      const invalid = await throttled.inject({
        method: 'POST',
        url: '/api/v1/auth/refresh',
      });
      expect(invalid.statusCode).toBe(403);
      expect(invalid.json().message).toBe('Invalid CSRF token');
    } finally {
      await throttled.close();
    }
  });

  it('uploads media and avatars larger than the JSON body limit, and supports text-only avatar updates', async () => {
    const contents = Buffer.concat([png, Buffer.alloc(1100 * 1024)]);
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/media/upload',
      ...multipart([filePart(contents)]),
    });
    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({
      size: contents.length,
      mimeType: 'image/png',
      name: 'pixel.png',
    });
    const avatar = await app.inject({
      method: 'PATCH',
      url: '/api/v1/users/1',
      ...multipart([filePart(png, 'avatar')]),
    });
    expect(avatar.statusCode).toBe(200);
    expect(avatar.json().avatarId).toBe(7);
    const textOnly = await app.inject({
      method: 'PATCH',
      url: '/api/v1/users/1',
      ...multipart([{ name: 'fullname', value: 'Updated Name' }]),
    });
    expect(textOnly.statusCode).toBe(200);
    expect(textOnly.json().fullname).toBe('Updated Name');
  });

  it('preserves fileSize/files/fields/parts status and error payloads', async () => {
    const atLimit = await app.inject({
      method: 'POST',
      url: '/api/v1/media/upload',
      ...multipart([
        filePart(
          Buffer.concat([png, Buffer.alloc(2 * 1024 * 1024 - png.length)]),
        ),
      ]),
    });
    expect(atLimit.statusCode).toBe(201);
    expect(atLimit.json().size).toBe(2 * 1024 * 1024);
    const scenarios = [
      {
        parts: [filePart(Buffer.alloc(2 * 1024 * 1024 + 1))],
        status: 413,
        message: 'File too large',
      },
      {
        parts: [filePart(), filePart()],
        status: 400,
        message: 'Too many files',
      },
      {
        parts: Array.from({ length: 21 }, (_, i) => ({
          name: `field${i}`,
          value: 'x',
        })),
        status: 400,
        message: 'Too many fields',
      },
      {
        parts: [filePart(png, 'unexpected')],
        status: 400,
        message: 'Unexpected field - unexpected',
      },
      {
        parts: [filePart(Buffer.from('invalid content'))],
        status: 415,
        message: 'File type is not allowed',
      },
      {
        parts: [filePart(Buffer.alloc(0))],
        status: 400,
        message: 'A nonempty file is required',
      },
    ];
    for (const scenario of scenarios) {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/media/upload',
        ...multipart(scenario.parts),
      });
      expect(res.statusCode).toBe(scenario.status);
      expect(res.json()).toMatchObject({
        statusCode: scenario.status,
        message: scenario.message,
        code: scenario.status === 400 ? 'BAD_REQUEST' : 'REQUEST_FAILED',
      });
    }
    const exact = await app.inject({
      method: 'POST',
      url: '/api/v1/media/upload',
      ...multipart([
        filePart(),
        ...Array.from({ length: 20 }, (_, i) => ({
          name: `field${i}`,
          value: 'x',
        })),
      ]),
    });
    expect(exact.statusCode).toBe(201);
    const parts = await app.inject({
      method: 'POST',
      url: '/api/v1/fixture/parts',
      ...multipart([
        { name: 'one', value: '1' },
        { name: 'two', value: '2' },
        filePart(),
      ]),
    });
    expect(parts.statusCode).toBe(400);
    expect(parts.json()).toMatchObject({
      message: 'Too many parts',
      code: 'BAD_REQUEST',
    });
  });

  it('rejects files on form-only endpoints and malformed multipart without leaking parser internals', async () => {
    const file = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      ...multipart([filePart()]),
    });
    expect(file.statusCode).toBe(400);
    expect(file.json()).toMatchObject({
      message: 'Unexpected field - file',
      code: 'BAD_REQUEST',
    });
    const malformed = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      headers: { 'content-type': 'multipart/form-data' },
      payload: 'bad-body',
    });
    expect(malformed.statusCode).toBe(400);
    expect(malformed.json().code).toBe('BAD_REQUEST');
  });

  it('applies admission before buffering and releases the slot after completion', async () => {
    let release!: () => void;
    let entered!: () => void;
    const active = new Promise<void>((resolve) => {
      entered = resolve;
    });
    const hold = new Promise<void>((resolve) => {
      release = resolve;
    });
    upload.mockImplementationOnce(async () => {
      entered();
      await hold;
      return {
        id: 7,
        userId: 1,
        name: 'pixel.png',
        size: png.length,
        mimeType: 'image/png',
      };
    });
    const first = app.inject({
      method: 'POST',
      url: '/api/v1/media/upload',
      ...multipart([filePart()]),
    });
    try {
      await active;
      const rejected = await app.inject({
        method: 'POST',
        url: '/api/v1/media/upload',
        ...multipart([filePart(Buffer.alloc(2 * 1024 * 1024 + 1))]),
      });
      expect(rejected.statusCode).toBe(429);
      expect(rejected.json().code).toBe('RATE_LIMITED');
    } finally {
      release();
      await first;
    }
    const next = await app.inject({
      method: 'POST',
      url: '/api/v1/media/upload',
      ...multipart([filePart()]),
    });
    expect(next.statusCode).toBe(201);
  });

  it('preserves redirect status and masks unknown service errors', async () => {
    const redirect = await app.inject('/api/v1/media/7/view');
    expect(redirect.statusCode).toBe(302);
    expect(redirect.headers.location).toBe('https://storage.example.test/file');
    const res = await app.inject('/api/v1/fixture/error');
    expect(res.statusCode).toBe(500);
    expect(res.json().code).toBe('INTERNAL_SERVER_ERROR');
    expect(res.body).not.toContain('secret-provider-details');
  });

  it('keeps CORS allowlists and never permits credentialed wildcard origins', async () => {
    const noOrigin = await app.inject({
      method: 'OPTIONS',
      url: '/api/v1/auth/login',
    });
    expect(noOrigin.statusCode).toBe(204);
    const allowed = await app.inject({
      url: '/api/v1/fixture/ip',
      headers: { origin: 'https://app.example.test' },
    });
    expect(allowed.headers['access-control-allow-origin']).toBe(
      'https://app.example.test',
    );
    expect(allowed.headers['access-control-allow-credentials']).toBe('true');
    const denied = await app.inject({
      url: '/api/v1/fixture/ip',
      headers: { origin: 'https://attacker.example.test' },
    });
    expect(denied.headers['access-control-allow-origin']).toBeUndefined();
    const wildcard = await createFixture(undefined, '*');
    try {
      const res = await wildcard.inject({
        method: 'OPTIONS',
        url: '/api/v1/auth/login',
        headers: {
          origin: 'https://any.example.test',
          'access-control-request-method': 'POST',
        },
      });
      expect(res.statusCode).toBe(204);
      expect(res.headers['access-control-allow-credentials']).toBeUndefined();
    } finally {
      await wildcard.close();
    }
  });

  it('ignores spoofed forwarding headers unless the immediate peer is trusted', async () => {
    const headers = {
      'x-forwarded-for': '198.51.100.9',
      'x-forwarded-proto': 'https',
      'x-forwarded-host': 'forged.example.test',
      host: 'backend.test',
    };
    const direct = await app.inject({
      url: '/api/v1/fixture/ip',
      remoteAddress: '203.0.113.5',
      headers,
    });
    expect(direct.json()).toMatchObject({
      ip: '203.0.113.5',
      protocol: 'http',
      hostname: 'backend.test',
    });
    const trusted = await createFixture('10.20.0.2/32, 10.30.0.3/32');
    try {
      const untrusted = await trusted.inject({
        url: '/api/v1/fixture/ip',
        remoteAddress: '203.0.113.5',
        headers,
      });
      expect(untrusted.json()).toMatchObject({
        ip: '203.0.113.5',
        protocol: 'http',
        hostname: 'backend.test',
      });
      const proxy = await trusted.inject({
        url: '/api/v1/fixture/ip',
        remoteAddress: '10.20.0.2',
        headers: {
          ...headers,
          'x-forwarded-for': '192.0.2.99, 198.51.100.9, 10.30.0.3',
        },
      });
      expect(proxy.json().ip).toBe('198.51.100.9');
      expect(proxy.json().ips).not.toContain('192.0.2.99');
    } finally {
      await trusted.close();
    }
  });
});
