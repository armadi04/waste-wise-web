import { Mutation, Query, Resolver } from '@nestjs/graphql';

/**
 * Minimal resolver proving the GraphQL endpoint is wired and reachable, and
 * backing the root `Mutation._noop` placeholder so feature schemas have a
 * `Mutation` type to `extend`. Feature resolvers live alongside this file.
 */
@Resolver()
export class HealthResolver {
  @Query('_health')
  health(): string {
    return 'ok';
  }

  @Mutation('_noop')
  noop(): string {
    return 'ok';
  }
}
