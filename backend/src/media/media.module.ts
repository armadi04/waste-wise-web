import { Module } from '@nestjs/common';
import { AvatarCleanupService } from '@/media/avatar-cleanup.service';
import { MediaService } from './media.service';
import { MediaController } from './media.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Media } from './entities/media.entity';
import { MulterModule } from '@nestjs/platform-express';
import * as multer from 'multer';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Module({
  imports: [
    TypeOrmModule.forFeature([Media]),
    // Use memory storage - the Depot SDK handles the upload to S3
    MulterModule.register({
      storage: multer.memoryStorage(),
    }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET') || 'secretKey',
        signOptions: { expiresIn: '60m' },
      }),
      inject: [ConfigService],
    }),
    ConfigModule,
  ],
  controllers: [MediaController],
  providers: [MediaService, AvatarCleanupService],
  exports: [MediaService, MulterModule],
})
export class MediaModule {}
