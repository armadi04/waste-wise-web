import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { OAuthClient } from './entities/oauth-client.entity';
import { OAuthClientService } from './oauth-client.service';
import { OAuthController } from './oauth.controller';

/**
 * OAuth2 client-credentials support: admin CRUD for clients plus the public
 * token endpoint. Exposes {@link OAuthClientService} so the JWT strategy can
 * check client validity (enabling instant revocation on disable/delete).
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([OAuthClient]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET') || 'secretKey',
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [OAuthController],
  providers: [OAuthClientService],
  exports: [OAuthClientService],
})
export class OAuthModule {}
