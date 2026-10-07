import { createRequire } from 'node:module';
import { BadRequestException } from '@nestjs/common';
// @nestjs/apollo is ESM, so it sees Apollo's ESM type declarations. These files
// compile as CJS, so the plugin type has to be resolved the same way or the two
// declarations of ApolloServerPlugin are treated as unrelated.
import type { ApolloServerPlugin } from '@apollo/server' with {
  'resolution-mode': 'import',
};
import type {
  getComplexity as GetComplexity,
  simpleEstimator as SimpleEstimator,
} from 'graphql-query-complexity';

// graphql-query-complexity's "exports" map resolves to its ESM build by default,
// which pulls a second `graphql` instance and breaks schema traversal ("Cannot
// use GraphQLObjectType from another module or realm"). Loading it through
// createRequire forces the CJS build, sharing the one graphql realm that the
// (CommonJS) @nestjs/graphql schema is built with.
const cjsRequire = createRequire(__filename);
const { getComplexity, simpleEstimator } = cjsRequire(
  'graphql-query-complexity',
) as {
  getComplexity: typeof GetComplexity;
  simpleEstimator: typeof SimpleEstimator;
};

/**
 * Rejects queries whose estimated cost exceeds `maxComplexity` before they
 * execute. Each field costs 1 (simpleEstimator), so cost grows with breadth and
 * depth — the guard the single `/graphql` endpoint needs in place of per-route
 * throttling. Runs in `didResolveOperation`, where the parsed document, schema
 * and variables are all available (the validation-rule form is unreliable on
 * Apollo Server 4+). Throws an HttpException for a clean client-facing error.
 */
export function complexityPlugin(maxComplexity: number): ApolloServerPlugin {
  return {
    requestDidStart() {
      return Promise.resolve({
        didResolveOperation(requestContext) {
          const { request, document, schema } = requestContext;
          const complexity = getComplexity({
            schema,
            operationName: request.operationName,
            query: document,
            variables: request.variables,
            estimators: [simpleEstimator({ defaultComplexity: 1 })],
          });
          if (complexity > maxComplexity) {
            throw new BadRequestException(
              `Query is too complex: ${complexity}. Maximum allowed complexity: ${maxComplexity}`,
            );
          }
          return Promise.resolve();
        },
      });
    },
  };
}
