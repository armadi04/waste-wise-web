import type { ConfigService } from '@nestjs/config';
import {
  memoryStorage,
  type MultipartOptions,
} from '@nestjs/platform-fastify/multipart';
import { DEFAULT_MEDIA_MAX_FILE_SIZE } from './media-upload.pipe';

export function mediaMultipartOptions(config: ConfigService): MultipartOptions {
  return {
    storage: memoryStorage(),
    limits: {
      fileSize: Number(
        config.get('MEDIA_MAX_FILE_SIZE') ?? DEFAULT_MEDIA_MAX_FILE_SIZE,
      ),
      files: 1,
      fields: 20,
      parts: 21,
    },
  };
}
