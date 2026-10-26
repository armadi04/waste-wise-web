import { randomUUID } from 'node:crypto';
import pino from 'pino';
import type { Options } from 'pino-http';
import { requestLogSerializers } from '@/common/utils/request-logging';

export const requestLoggerOptions: Options = {
  timestamp: pino.stdTimeFunctions.isoTime,
  autoLogging: true,
  genReqId: (req) => (req.headers['x-request-id'] as string) || randomUUID(),
  customProps: (req) => ({ requestId: req.id }),
  serializers: requestLogSerializers,
  transport:
    process.env.NODE_ENV !== 'production'
      ? { target: 'pino-pretty', options: { colorize: true, singleLine: true } }
      : undefined,
  level: process.env.LOG_LEVEL || 'info',
};
