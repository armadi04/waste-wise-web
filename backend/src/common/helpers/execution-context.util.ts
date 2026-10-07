import { ExecutionContext } from '@nestjs/common';
import { GqlContextType, GqlExecutionContext } from '@nestjs/graphql';
import type { IAuthRequest } from '@/auth/interfaces/auth-request.interface';

/**
 * Returns the underlying request regardless of transport, so guards work
 * unchanged whether they run over a REST route or a GraphQL resolver.
 *
 * For GraphQL, the request lives on the Apollo context (`{ req }`) rather than
 * on the HTTP argument at index 0, so `switchToHttp()` would yield the resolver
 * root object instead of the request.
 */
export function getRequest<T = IAuthRequest>(context: ExecutionContext): T {
  if (context.getType<GqlContextType>() === 'graphql') {
    return GqlExecutionContext.create(context).getContext<{ req: T }>().req;
  }
  return context.switchToHttp().getRequest<T>();
}
