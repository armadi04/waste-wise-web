import 'reflect-metadata';
import '@nestjs/core';
import { describe, expect, it } from 'bun:test';
import { Controller, Get } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Logger, LoggerModule } from 'nestjs-pino';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { Writable } from 'node:stream';
import { requestLoggerOptions } from '@/config/logging';
import { createHttpAdapter } from '@/config/http';
import { configureApiRouting } from '@/config/api-routing';

@Controller('logging')
class LoggingController {
  constructor(private readonly logger: Logger) {}
  @Get() get() {
    this.logger.log('HTTP handler reached');
    return { ok: true };
  }
}

describe('Pino raw HTTP middleware on Fastify', () => {
  it('keeps request correlation and redacts credentials from URL and headers', async () => {
    let output = '';
    const stream = new Writable({
      write(chunk, _encoding, done) {
        output += String(chunk);
        done();
      },
    });
    const module = await Test.createTestingModule({
      imports: [
        LoggerModule.forRoot({
          pinoHttp: [
            { ...requestLoggerOptions, level: 'info', transport: undefined },
            stream,
          ],
        }),
      ],
      controllers: [LoggingController],
    }).compile();
    const app = module.createNestApplication<NestFastifyApplication>(
      createHttpAdapter(),
      { logger: false },
    );
    configureApiRouting(app);
    try {
      await app.init();
      await app.getHttpAdapter().getInstance().ready();
      const res = await app.inject({
        url: '/api/v1/logging?token=query-secret',
        headers: {
          'x-request-id': 'correlation-1',
          authorization: 'Bearer header-secret',
          cookie: 'accessToken=cookie-secret',
        },
      });
      expect(res.statusCode).toBe(200);
      // inject() uses a synthetic raw response. A real loopback request verifies
      // pino-http's finish/close classification as well as its middleware context.
      await app.listen(0, '127.0.0.1');
      const network = await fetch(
        `${await app.getUrl()}/api/v1/logging?token=query-secret`,
        {
          headers: {
            'x-request-id': 'correlation-1',
            authorization: 'Bearer header-secret',
            cookie: 'accessToken=cookie-secret',
          },
        },
      );
      await network.text();
      expect(network.status).toBe(200);
      const records = output
        .trim()
        .split('\n')
        .map((line) => JSON.parse(line));
      expect(
        records.some(
          (record) =>
            record.msg === 'HTTP handler reached' &&
            record.requestId === 'correlation-1',
        ),
      ).toBe(true);
      expect(
        records.some(
          (record) =>
            record.msg === 'request completed' &&
            record.req.id === 'correlation-1' &&
            record.req.url === '/api/v1/logging',
        ),
      ).toBe(true);
      for (const credential of [
        'query-secret',
        'header-secret',
        'cookie-secret',
      ])
        expect(output).not.toContain(credential);
    } finally {
      await app.close();
    }
  });
});
