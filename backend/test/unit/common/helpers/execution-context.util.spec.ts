import { ExecutionContext } from '@nestjs/common';
import { describe, it, expect } from 'bun:test';
import { getRequest } from '../../../../src/common/helpers/execution-context.util';

function httpContext(req: unknown): ExecutionContext {
  return {
    getType: () => 'http',
    switchToHttp: () => ({ getRequest: () => req }),
  } as unknown as ExecutionContext;
}

function gqlContext(req: unknown): ExecutionContext {
  // GqlExecutionContext.create() rebuilds from getArgs/getClass/getHandler and
  // exposes the resolver's third argument (the context) via getContext().
  const args = [undefined, undefined, { req }, undefined];
  return {
    getType: () => 'graphql',
    getArgs: () => args,
    getClass: () => class {},
    getHandler: () => () => undefined,
  } as unknown as ExecutionContext;
}

describe('getRequest', () => {
  it('reads the request from the HTTP context', () => {
    const req = { user: { userId: 1 } };
    expect(getRequest<typeof req>(httpContext(req))).toBe(req);
  });

  it('reads the request from the GraphQL context', () => {
    const req = { user: { userId: 2 } };
    expect(getRequest<typeof req>(gqlContext(req))).toBe(req);
  });
});
