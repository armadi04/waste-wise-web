import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';
import pino from 'pino';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UsersModule } from './users/users.module';
import { InvitationsModule } from './invitations/invitations.module';
import { AuthModule } from './auth/auth.module';
import { RolesModule } from './roles/roles.module';
import { PermissionsModule } from './permissions/permissions.module';
import { MediaModule } from './media/media.module';
import { ReportsModule } from './reports/reports.module';
import { SeederModule } from './database/seeder/seeder.module';
import { CacheModule as AppCacheModule } from './common/cache/cache.module';
import { CacheModule, CacheModuleOptions } from '@nestjs/cache-manager';
import { createClient, createKeyv } from '@keyv/redis';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { NotificationsModule } from './notifications/notifications.module';
import { MailModule } from './mail/mail.module';
import { HealthModule } from './health/health.module';
import { OAuthModule } from './oauth/oauth.module';
import { SessionsModule } from './sessions/sessions.module';
import { ScheduleModule } from '@nestjs/schedule';
import { AuditModule } from './audit/audit.module';
import { StatsModule } from './stats/stats.module';
import { ChangelogModule } from './changelog/changelog.module';
import { AppRefreshModule } from './app-refresh/app-refresh.module';
import { GraphqlApiModule } from './graphql/graphql-api.module';
import { TimeZoneModule } from './time-zone/time-zone.module';
import { GqlThrottlerGuard } from './common/guards/gql-throttler.guard';
import env from './config/env';
import { requestLoggerOptions } from './config/logging';
import { SessionCsrfGuard } from './auth/session-csrf.guard';

const initLogger = pino({
  name: 'AppModule',
  timestamp: pino.stdTimeFunctions.isoTime,
});

@Module({
  imports: [
    LoggerModule.forRoot({ pinoHttp: requestLoggerOptions }),
    EventEmitterModule.forRoot(),
    ConfigModule.forRoot({
      isGlobal: true,
      ignoreEnvFile: process.env.NODE_ENV === 'test',
    }),
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => [
        {
          name: 'default',
          ttl: configService.get<number>('THROTTLE_TTL') ?? 60_000,
          limit: configService.get<number>('THROTTLE_LIMIT') ?? 100,
        },
      ],
      inject: [ConfigService],
    }),
    CacheModule.registerAsync({
      isGlobal: true,
      imports: [ConfigModule],
      useFactory: async (
        configService: ConfigService,
      ): Promise<CacheModuleOptions> => {
        const redisHost = configService.get<string>('REDIS_HOST');
        const redisPort = configService.get<number>('REDIS_PORT') || 6379;
        const redisTtl = configService.get<number>('REDIS_TTL') || 3600;
        const redisUsername = configService.get<string>('REDIS_USERNAME');
        const redisPassword = configService.get<string>('REDIS_PASSWORD');

        if (!redisHost) {
          initLogger.info('Redis not configured, using in-memory cache');
          return { ttl: redisTtl * 1000 };
        }

        try {
          // cache-manager 7 takes Keyv stores. Connect the client eagerly so an
          // unreachable Redis falls back to the in-memory cache here instead of
          // failing on the first cache read.
          const client = createClient({
            socket: {
              host: redisHost,
              port: redisPort,
              connectTimeout: 5000,
            },
            username: redisUsername,
            password: redisPassword,
          });

          client.on('error', (err: Error) => {
            initLogger.error({ err }, 'Redis connection error');
          });

          await client.connect();

          initLogger.info('Redis cache connected');
          // @nestjs/cache-manager is ESM and @keyv/redis resolves to Keyv's CJS
          // declarations from this (CJS) file, so the two Keyv types are
          // structurally identical but nominally distinct.
          const store = createKeyv(client) as unknown as NonNullable<
            CacheModuleOptions['stores']
          >;

          return { stores: store, ttl: redisTtl * 1000 };
        } catch (error) {
          initLogger.warn(
            { err: error },
            'Redis unavailable, falling back to in-memory cache',
          );
          return { ttl: redisTtl * 1000 };
        }
      },
      inject: [ConfigService],
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => {
        // Fail closed: synchronize is only ever on when explicitly enabled via
        // the validated env flag. Never derive it from NODE_ENV — a missing or
        // mistyped NODE_ENV must not silently enable schema sync (which can drop
        // columns) on a production database.
        const synchronize = env.DB_SYNCHRONIZE;
        return {
          type: 'postgres',
          useUTC: true,
          extra: { options: '-c timezone=UTC' },
          host: configService.get<string>('DB_HOST'),
          port: configService.get<number>('DB_PORT'),
          username: configService.get<string>('DB_USERNAME'),
          password: configService.get<string>('DB_PASSWORD'),
          database: configService.get<string>('DB_NAME'),
          entities: [__dirname + '/**/*.entity{.ts,.js}'],
          migrations: [__dirname + '/database/migrations/*{.ts,.js}'],
          synchronize,
          // When synchronize is off (prod), apply pending migrations on boot.
          // Reset scripts disable this during bootstrap, then run migrations
          // explicitly after dropping the schema.
          migrationsRun:
            !synchronize && process.env.DB_SKIP_MIGRATIONS !== 'true',
        };
      },
      inject: [ConfigService],
    }),
    UsersModule,
    InvitationsModule,
    AuthModule,
    RolesModule,
    PermissionsModule,
    MediaModule,
    ReportsModule,
    SeederModule,
    AppCacheModule,
    NotificationsModule,
    MailModule,
    HealthModule,
    OAuthModule,
    SessionsModule,
    ScheduleModule.forRoot(),
    AuditModule,
    StatsModule,
    ChangelogModule,
    AppRefreshModule,
    TimeZoneModule,
    // Opt-in GraphQL API — mounted only when GRAPHQL_ENABLED=true.
    ...(env.GRAPHQL_ENABLED ? [GraphqlApiModule] : []),
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // Express CSRF middleware rejected invalid session writes before throttling.
    { provide: APP_GUARD, useClass: SessionCsrfGuard },
    {
      provide: APP_GUARD,
      useClass: GqlThrottlerGuard,
    },
  ],
})
export class AppModule {}
