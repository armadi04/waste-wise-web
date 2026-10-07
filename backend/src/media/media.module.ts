import { Module } from '@nestjs/common';
import { MediaStorageService } from './storage/media-storage.service';
import { MediaCleanupService } from './media-cleanup.service';
import {
  MediaUploadPipe,
  DEFAULT_MEDIA_MAX_FILE_SIZE,
} from './media-upload.pipe';
import { MediaUploadAdmissionInterceptor } from './media-upload-admission.interceptor';
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
    // Storage adapters upload the validated in-memory file.
    MulterModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        storage: multer.memoryStorage(),
        limits: {
          fileSize: Number(
            config.get('MEDIA_MAX_FILE_SIZE') ?? DEFAULT_MEDIA_MAX_FILE_SIZE,
          ),
          files: 1,
          fields: 20,
          parts: 21,
        },
      }),
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
  providers: [
    MediaService,
    MediaStorageService,
    MediaCleanupService,
    MediaUploadPipe,
    MediaUploadAdmissionInterceptor,
  ],
  exports: [
    MediaService,
    MediaStorageService,
    MulterModule,
    MediaUploadAdmissionInterceptor,
  ],
})
export class MediaModule {}
