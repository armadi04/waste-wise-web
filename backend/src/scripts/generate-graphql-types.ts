import { join } from 'path';
import { GraphQLDefinitionsFactory } from '@nestjs/graphql';

/**
 * Generates TypeScript typings from the schema-first SDL so resolvers stay bound
 * to the contract at compile time (drift is caught by `bun run build`). Mirrors
 * the `spec:generate` workflow — regenerate whenever a `*.graphql` file changes.
 */
const factory = new GraphQLDefinitionsFactory();

void factory.generate({
  typePaths: [join(process.cwd(), 'src/graphql/schema/**/*.graphql')],
  path: join(process.cwd(), 'src/graphql/generated/graphql.ts'),
  outputAs: 'interface',
  emitTypenameField: true,
  skipResolverArgs: false,
});
