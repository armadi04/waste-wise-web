import { BadRequestException } from '@nestjs/common';
// @nestjs/apollo is ESM, so it sees Apollo's ESM type declarations. These files
// compile as CJS, so the plugin type has to be resolved the same way or the two
// declarations of ApolloServerPlugin are treated as unrelated.
import type { ApolloServerPlugin } from '@apollo/server' with {
  'resolution-mode': 'import',
};

/**
 * Enforces persisted queries: a request may present ONLY a persisted-query hash
 * (`extensions.persistedQuery`), never raw `query` text. This blocks Apollo's
 * Automatic Persisted Queries *registration* path — where a caller sends
 * `query` + a matching sha256 hash to register and run arbitrary operations —
 * so only queries already registered (hash-only lookups) execute. It shrinks
 * request payloads and prevents ad-hoc queries against the API.
 *
 * Gated by `GRAPHQL_PERSISTED_ONLY` (intended for production) — off by default
 * so local development and introspection keep working with raw queries.
 *
 * Runs in `requestDidStart` (before APQ resolves the hash to a document) and
 * throws an HttpException so the shared exception filter surfaces a clean client
 * error. A registered hash-only request has no `query` text at this phase, so it
 * passes; a registration attempt (hash + query) or a plain ad-hoc query (query,
 * no hash) is rejected.
 */
export function persistedQueriesOnlyPlugin(): ApolloServerPlugin {
  return {
    requestDidStart(requestContext) {
      const { request } = requestContext;
      const hasHash = Boolean(request.extensions?.persistedQuery);
      const hasRawQuery = Boolean(request.query);

      // Reject anything that carries raw query text: a plain ad-hoc query, or an
      // APQ *registration* (hash + query) that would otherwise safelist an
      // attacker-chosen operation. Only a bare hash lookup is allowed through.
      if (hasRawQuery || !hasHash) {
        throw new BadRequestException(
          'Only persisted queries are allowed; send the query hash without query text',
        );
      }
      return Promise.resolve();
    },
  };
}
