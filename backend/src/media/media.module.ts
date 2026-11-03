import { Module } from '@nestjs/common';
import { MediaStorageService } from './storage/media-storage.service';
import { MediaCleanupService } from './media-cleanup.service';
import { MediaUploadPipe } from './media-upload.pipe';
import { mediaMultipartOptions } from './media-multipart.config';
import { MediaUploadAdmissionInterceptor } from './media-upload-admission.interceptor';
import { MediaService } from './media.service';
import { MediaController } from './media.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Media } from './entities/media.entity';
import { MultipartModule } from '@nestjs/platform-fastify/multipart';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Module({
  imports: [
    TypeOrmModule.forFeature([Media]),
    // Storage adapters upload the validated in-memory file.
    MultipartModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: mediaMultipartOptions,
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
    MultipartModule,
    MediaUploadAdmissionInterceptor,
  ],
})
export class MediaModule {}
