import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { GqlContextType } from '@nestjs/graphql';
import type { Logger } from 'nestjs-pino';
import type {
  FastifyRequest as Request,
  FastifyReply as Response,
} from 'fastify';

/**
 * Catch-all exception filter.
 *
 * - `HttpException`s are passed through with their original status and body so
 *   the response shape the clients already rely on is preserved.
 * - Any other (unhandled) error is logged with its stack and returned as a
 *   generic 500 so internal details never leak to the client.
 *
 * Over GraphQL there is no HTTP response to write to, so the exception is
 * handed back to Apollo (which formats it into the `errors` array); unhandled
 * errors are logged and masked the same way as on the REST side.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  constructor(private readonly logger: Logger) {}

  catch(exception: unknown, host: ArgumentsHost): unknown {
    if (host.getType<GqlContextType>() === 'graphql') {
      return this.handleGraphql(exception);
    }

    const ctx = host.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const exceptionResponse = exception.getResponse();
      const body =
        typeof exceptionResponse === 'object' && exceptionResponse !== null
          ? exceptionResponse
          : { message: exceptionResponse };
      const explicitCode = (body as { code?: unknown }).code;
      const code =
        typeof explicitCode === 'string'
          ? explicitCode
          : this.codeForStatus(status);
      const payload = { ...body, code };
      // Nest 12.1.2's Fastify multipart interceptor spells this differently
      // from Multer. Keep the existing public validation message.
      if (
        request.isMultipart?.() &&
        'message' in payload &&
        typeof payload.message === 'string'
      ) {
        payload.message = payload.message.replace(
          /^Unexpected file field(?= - |$)/,
          'Unexpected field',
        );
      }
      response.status(status).send(payload);
      return;
    }

    this.logger.error(
      {
        err: exception,
        path: request?.url,
        method: request?.method,
      },
      'Unhandled exception',
    );

    response.status(HttpStatus.INTERNAL_SERVER_ERROR).send({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Internal server error',
      error: 'Internal Server Error',
      timestamp: new Date().toISOString(),
      path: request?.url,
    });
  }

  private codeForStatus(status: number): string {
    const knownCodes: Record<number, string> = {
      [HttpStatus.BAD_REQUEST]: 'BAD_REQUEST',
      [HttpStatus.UNAUTHORIZED]: 'UNAUTHORIZED',
      [HttpStatus.FORBIDDEN]: 'FORBIDDEN',
      [HttpStatus.NOT_FOUND]: 'NOT_FOUND',
      [HttpStatus.SERVICE_UNAVAILABLE]: 'SERVICE_UNAVAILABLE',
      [HttpStatus.CONFLICT]: 'CONFLICT',
      [HttpStatus.TOO_MANY_REQUESTS]: 'RATE_LIMITED',
    };
    return knownCodes[status] ?? 'REQUEST_FAILED';
  }

  /**
   * Returns the error Apollo should surface. Known `HttpException`s pass through
   * so clients keep the same messages; anything else is logged and masked.
   */
  private handleGraphql(exception: unknown): unknown {
    if (exception instanceof HttpException) {
      return exception;
    }

    this.logger.error({ err: exception }, 'Unhandled GraphQL exception');
    return new Error('Internal server error');
  }
}
