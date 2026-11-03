import { join } from 'path';
import { Module } from '@nestjs/common';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { DateTimeResolver } from 'graphql-scalars';
import depthLimit from 'graphql-depth-limit';
import { graphqlContext } from './graphql-context';
// @nestjs/apollo is ESM, so it sees Apollo's ESM type declarations. These files
// compile as CJS, so the plugin type has to be resolved the same way or the two
// declarations of ApolloServerPlugin are treated as unrelated.
import type { ApolloServerPlugin } from '@apollo/server' with {
  'resolution-mode': 'import',
};
import env from '@/config/env';
import { UsersModule } from '@/users/users.module';
import { RolesModule } from '@/roles/roles.module';
import { PermissionsModule } from '@/permissions/permissions.module';
import { MediaModule } from '@/media/media.module';
import { NotificationsModule } from '@/notifications/notifications.module';
import { InvitationsModule } from '@/invitations/invitations.module';
import { HealthResolver } from './resolvers/health.resolver';
import { PermissionResolver } from './resolvers/permission.resolver';
import { RoleResolver } from './resolvers/role.resolver';
import { UserResolver } from './resolvers/user.resolver';
import { MediaResolver } from './resolvers/media.resolver';
import { NotificationResolver } from './resolvers/notification.resolver';
import { InvitationResolver } from './resolvers/invitation.resolver';
import { DataloaderModule } from './dataloaders/dataloader.module';
import { DataloaderService } from './dataloaders/dataloader.service';
import { complexityPlugin } from './plugins/complexity.plugin';
import { persistedQueriesOnlyPlugin } from './plugins/persisted-queries-only.plugin';

/**
 * Opt-in GraphQL API mounted at `/graphql`, sitting beside the REST surface.
 *
 * Only imported by {@link AppModule} when `GRAPHQL_ENABLED=true`, so a REST-only
 * deployment carries zero GraphQL overhead. Schema-first: the contract lives in
 * `schema/**\/*.graphql` (SDL is the source of truth) and resolvers back it.
 */
@Module({
  imports: [
    UsersModule,
    RolesModule,
    PermissionsModule,
    MediaModule,
    NotificationsModule,
    InvitationsModule,
    GraphQLModule.forRootAsync<ApolloDriverConfig>({
      driver: ApolloDriver,
      imports: [DataloaderModule],
      inject: [DataloaderService],
      useFactory: (dataloaderService: DataloaderService) => {
        const isProd = env.NODE_ENV === 'production';
        const plugins: ApolloServerPlugin[] = [
          complexityPlugin(env.GRAPHQL_MAX_COMPLEXITY),
        ];
        if (env.GRAPHQL_PERSISTED_ONLY) {
          plugins.push(persistedQueriesOnlyPlugin());
        }
        return {
          // __dirname resolves to src/graphql (dev) or dist/graphql (prod); the
          // SDL files are copied into dist via nest-cli `assets`.
          typePaths: [join(__dirname, 'schema', '**', '*.graphql')],
          path: '/graphql',
          sortSchema: true,
          // Bind the SDL `scalar DateTime` to a real ISO-8601 implementation.
          resolvers: { DateTime: DateTimeResolver },
          // Introspection (and any schema exploration) is disabled in production
          // unless GRAPHQL_PLAYGROUND is explicitly turned on.
          introspection: !isProd || env.GRAPHQL_PLAYGROUND,
          // Never leak stack traces to clients in production.
          includeStacktraceInErrorResponses: !isProd,
          // Reject overly deep queries before execution — the single /graphql
          // endpoint can't be protected by per-route throttling. Query cost is
          // enforced separately by complexityPlugin (see plugins below).
          validationRules: [depthLimit(env.GRAPHQL_MAX_DEPTH)],
          plugins,
          // Expose req/res (for request-scoped guards like rate limiting) plus a
          // fresh set of DataLoaders per request to batch relation lookups.
          context: graphqlContext(dataloaderService),
        };
      },
    }),
  ],
  providers: [
    HealthResolver,
    PermissionResolver,
    RoleResolver,
    UserResolver,
    MediaResolver,
    NotificationResolver,
    InvitationResolver,
  ],
})
export class GraphqlApiModule {}
