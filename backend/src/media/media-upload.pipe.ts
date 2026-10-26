import type { UploadedMultipartFile } from '@nestjs/platform-fastify/multipart';
import {
  BadRequestException,
  Injectable,
  PayloadTooLargeException,
  PipeTransform,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { fileTypeFromBuffer } from 'file-type';

export const DEFAULT_MEDIA_MAX_FILE_SIZE = 20 * 1024 * 1024;
export const DEFAULT_MEDIA_MIME_TYPES =
  'image/jpeg,image/png,image/webp,image/gif,application/pdf,video/mp4,audio/mpeg,audio/wav,application/zip';

@Injectable()
export class MediaUploadPipe implements PipeTransform {
  constructor(private readonly config: ConfigService) {}
  async transform(
    file: UploadedMultipartFile | undefined,
  ): Promise<UploadedMultipartFile> {
    if (!file || !Buffer.isBuffer(file.buffer) || !file.buffer.length)
      throw new BadRequestException('A nonempty file is required');
    const max = Number(
      this.config.get('MEDIA_MAX_FILE_SIZE') ?? DEFAULT_MEDIA_MAX_FILE_SIZE,
    );
    if (file.buffer.length > max)
      throw new PayloadTooLargeException('File exceeds the upload size limit');
    if (
      !file.originalname ||
      file.originalname.length > 255 ||
      file.originalname.includes('\0')
    )
      throw new BadRequestException('Invalid filename');
    let detected: Awaited<ReturnType<typeof fileTypeFromBuffer>>;
    try {
      detected = await fileTypeFromBuffer(file.buffer);
    } catch {
      throw new UnsupportedMediaTypeException('Malformed or unsupported file');
    }
    const allowed = String(
      this.config.get('MEDIA_ALLOWED_MIME_TYPES') ?? DEFAULT_MEDIA_MIME_TYPES,
    )
      .split(',')
      .map((value) => value.trim());
    if (!detected || !allowed.includes(detected.mime))
      throw new UnsupportedMediaTypeException('File type is not allowed');
    return { ...file, size: file.buffer.length, mimetype: detected.mime };
  }
}
