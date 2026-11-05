import { ACCESS_TOKEN_TTL } from '@/sessions/session-policy';
import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { UsersModule } from '../users/users.module';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtStrategy } from './jwt.strategy';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BlacklistedToken } from './entities/blacklisted-token.entity';
import { PasswordResetToken } from './entities/password-reset-token.entity';
import { EmailVerificationToken } from './entities/email-verification-token.entity';
import { TwoFactorRecoveryCode } from './entities/two-factor-recovery-code.entity';
import { User } from '../users/entities/user.entity';

import { IsUniqueConstraint } from '../common/validators/is-unique.validator';
import { TurnstileService } from './turnstile.service';
import { TwoFactorService } from './two-factor.service';
import { SessionsModule } from '../sessions/sessions.module';

@Module({
  imports: [
    UsersModule,
    PassportModule,
    SessionsModule,
    TypeOrmModule.forFeature([
      BlacklistedToken,
      PasswordResetToken,
      EmailVerificationToken,
      TwoFactorRecoveryCode,
      User,
    ]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET') || 'secretKey',
        signOptions: { expiresIn: ACCESS_TOKEN_TTL },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtStrategy,
    IsUniqueConstraint,
    TurnstileService,
    TwoFactorService,
  ],
  exports: [AuthService, TwoFactorService, TurnstileService],
})
export class AuthModule {}
