import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SsoService } from './sso.service';
import { SsoController } from './sso.controller';
import { AuthModule } from '../auth/auth.module';
import { UsersModule } from '../users/users.module';
import { Role } from '../roles/entities/role.entity';

@Module({
  imports: [
    ConfigModule,
    AuthModule, // reuse AuthService (login / session revocation)
    UsersModule, // reuse UsersService for provisioning
    TypeOrmModule.forFeature([Role]),
  ],
  controllers: [SsoController],
  providers: [SsoService],
})
export class SsoModule {}
