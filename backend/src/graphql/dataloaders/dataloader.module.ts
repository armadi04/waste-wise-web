import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Role } from '@/roles/entities/role.entity';
import { User } from '@/users/entities/user.entity';
import { DataloaderService } from './dataloader.service';

/**
 * Provides {@link DataloaderService} (and the repositories it batches over) so
 * the GraphQL context factory can mint per-request loaders.
 */
@Module({
  imports: [TypeOrmModule.forFeature([User, Role])],
  providers: [DataloaderService],
  exports: [DataloaderService],
})
export class DataloaderModule {}
