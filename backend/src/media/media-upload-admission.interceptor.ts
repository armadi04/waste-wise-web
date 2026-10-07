import {
  CallHandler,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { defer, finalize } from 'rxjs';

/** Runs before multipart buffering. Shared between media uploads and avatar updates. */
@Injectable()
export class MediaUploadAdmissionInterceptor implements NestInterceptor {
  private active = 0;
  constructor(private readonly config: ConfigService) {}
  intercept(_context: ExecutionContext, next: CallHandler) {
    return defer(() => {
      const limit = Number(
        this.config.get('MEDIA_MAX_CONCURRENT_UPLOADS') ?? 4,
      );
      if (this.active >= limit)
        throw new HttpException(
          'Too many concurrent upload requests',
          HttpStatus.TOO_MANY_REQUESTS,
        );
      this.active += 1;
      return next.handle().pipe(
        finalize(() => {
          this.active -= 1;
        }),
      );
    });
  }
}
