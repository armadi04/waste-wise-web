import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { SeederService } from './seeder.service';
import { Permission } from '@/permissions/entities/permission.entity';
import { Role } from '@/roles/entities/role.entity';
import { User } from '@/users/entities/user.entity';

@Module({
  imports: [ConfigModule, TypeOrmModule.forFeature([Permission, Role, User])],
  providers: [SeederService],
  exports: [SeederService],
})
export class SeederModule {}
