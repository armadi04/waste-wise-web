import { ArgumentsHost, NotFoundException } from '@nestjs/common';
import { Logger } from 'nestjs-pino';
import { describe, beforeEach, it, expect, jest } from 'bun:test';
import { AllExceptionsFilter } from '../../../../src/common/filters/all-exceptions.filter';

describe('AllExceptionsFilter', () => {
  let filter: AllExceptionsFilter;
  let logger: { error: jest.Mock };
  let send: jest.Mock;
  let status: jest.Mock;
  let host: ArgumentsHost;

  beforeEach(() => {
    logger = { error: jest.fn() };
    filter = new AllExceptionsFilter(logger as unknown as Logger);
    send = jest.fn();
    status = jest.fn(() => ({ send }));
    host = {
      getType: () => 'http',
      switchToHttp: () => ({
        getRequest: () => ({ url: '/api/widgets', method: 'GET' }),
        getResponse: () => ({ status }),
      }),
    } as unknown as ArgumentsHost;
  });

  it('should pass HttpExceptions through with their status and body', () => {
    filter.catch(new NotFoundException('nope'), host);

    expect(status).toHaveBeenCalledWith(404);
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'nope', code: 'NOT_FOUND' }),
    );
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('should log and mask unknown errors as a generic 500', () => {
    filter.catch(new Error('boom'), host);

    expect(logger.error).toHaveBeenCalled();
    expect(status).toHaveBeenCalledWith(500);
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 500,
        message: 'Internal server error',
        path: '/api/widgets',
      }),
    );
  });

  it('hands HttpExceptions back to Apollo over GraphQL', () => {
    const gqlHost = { getType: () => 'graphql' } as unknown as ArgumentsHost;
    const exception = new NotFoundException('nope');

    expect(filter.catch(exception, gqlHost)).toBe(exception);
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('logs and masks unknown errors over GraphQL', () => {
    const gqlHost = { getType: () => 'graphql' } as unknown as ArgumentsHost;

    const result = filter.catch(new Error('boom'), gqlHost) as Error;

    expect(result).toBeInstanceOf(Error);
    expect(result.message).toBe('Internal server error');
    expect(logger.error).toHaveBeenCalled();
  });
});
