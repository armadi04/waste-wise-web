import {
  FastifyAdapter,
  type NestFastifyApplication,
} from '@nestjs/platform-fastify';
import cookie from '@fastify/cookie';
import type {} from '@fastify/multipart';
import { parseTrustProxy } from '@/common/utils/request-logging';
import { BadRequestException, PayloadTooLargeException } from '@nestjs/common';
import qs from 'qs';
import { randomUUID } from 'node:crypto';

/** Shared by runtime, contract tooling and isolated HTTP tests. */
export function createHttpAdapter(trustProxy = process.env.TRUST_PROXY) {
  const adapter = new FastifyAdapter({
    requestIdHeader: 'x-request-id',
    genReqId: () => randomUUID(),
    trustProxy: parseTrustProxy(trustProxy),
    // Match Express' JSON/urlencoded default; multipart has independent explicit limits.
    bodyLimit: 100 * 1024,
    // Preserve Multer's unbounded defaults outside MediaModule. Its upload
    // interceptors override all four limits; no body is buffered at plugin registration.
    multipart: {
      limits: {
        fileSize: Infinity,
        files: Infinity,
        fields: Infinity,
        parts: Infinity,
        fieldSize: 1024 * 1024,
      },
    },
    routerOptions: {
      ignoreTrailingSlash: true,
      caseSensitive: false,
      maxParamLength: 8192,
    },
  });
  // Nest's Express adapter used urlencoded({ extended: true }). Keep indexed
  // array/nested fields instead of Fastify's flat querystring interpretation.
  adapter.registerParserMiddleware('/api');
  const jsonParser = adapter
    .getInstance()
    .getDefaultJsonParser('error', 'error');
  adapter.getInstance().removeContentTypeParser('application/json');
  adapter.useBodyParser(
    'application/json',
    false,
    {},
    (request, body, done) => {
      // Express treats Content-Length: 0 JSON as an empty object, including refresh/logout.
      if (!body.length) return done(null, {});
      return jsonParser(request, body.toString(), (error, value) => {
        done(error ? new BadRequestException(error.message) : null, value);
      });
    },
  );
  adapter
    .getInstance()
    .removeContentTypeParser('application/x-www-form-urlencoded');
  adapter.useBodyParser(
    'application/x-www-form-urlencoded',
    false,
    {},
    (_request, body, done) => {
      const input = body.toString();
      const count = input ? input.split('&', 1001).length : 0;
      if (count > 1000)
        return done(new PayloadTooLargeException('too many parameters'));
      try {
        done(
          null,
          qs.parse(input, {
            depth: 32,
            strictDepth: true,
            parameterLimit: 1000,
            arrayLimit: Math.max(100, count),
          }),
        );
      } catch {
        done(new BadRequestException('The input exceeded the depth'));
      }
    },
  );
  return adapter;
}

export async function registerHttpPlugins(app: NestFastifyApplication) {
  // Express used cookieParser() without a signing secret. Existing cookies stay unsigned.
  await app.register(cookie, { hook: 'onRequest' });
  app
    .getHttpAdapter()
    .getInstance()
    .addHook('onRequest', (request, _reply, done) => {
      // Preserve cookie-parser's JSON-cookie handling; malformed JSON remains a string.
      const cookies = request.cookies as Record<string, unknown>;
      for (const [name, value] of Object.entries(cookies)) {
        if (typeof value === 'string' && value.startsWith('j:')) {
          try {
            const parsed: unknown = JSON.parse(value.slice(2));
            if (parsed) cookies[name] = parsed;
          } catch {
            /* retain original */
          }
        }
      }
      done();
    });
}

export function configureHttpCors(
  app: NestFastifyApplication,
  origins = process.env.ALLOWED_ORIGINS ?? '*',
) {
  const allowedOrigins = origins.split(',');
  const useWildcard = allowedOrigins.includes('*');

  // Reflecting an arbitrary Origin together with credentials:true is the classic
  // CORS misconfiguration — any site could then make credentialed requests and
  // read the response. So credentials are only enabled when an explicit origin
  // allow-list is configured; a wildcard config serves non-credentialed CORS.
  const allowCredentials = !useWildcard;

  app.enableCors({
    strictPreflight: false,
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, curl, etc.)
      if (!origin) {
        callback(null, true);
        return;
      }

      // Wildcard: allow the origin but WITHOUT credentials (set below).
      if (useWildcard) {
        callback(null, true);
        return;
      }

      // Check if origin is in the allowed list
      if (allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error('Not allowed by CORS'), false);
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    credentials: allowCredentials,
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'Accept',
      'X-CSRF-Token',
      'Idempotency-Key',
    ],
  });
}
