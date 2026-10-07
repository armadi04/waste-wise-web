import { describe, expect, it } from 'bun:test';
import { ConfigService } from '@nestjs/config';
import { Subject, lastValueFrom, of, throwError } from 'rxjs';
import type { ExecutionContext } from '@nestjs/common';
import { MediaUploadPipe } from '@/media/media-upload.pipe';
import { MediaUploadAdmissionInterceptor } from '@/media/media-upload-admission.interceptor';
import { MediaBulkDeleteDto } from '@/media/dto/media-deletion.dto';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

const pipe = (values = {}) => new MediaUploadPipe(new ConfigService(values));
const pdf = Buffer.from('%PDF-1.7\n1 0 obj\n<<>>\nendobj\n%%EOF');
const file = (buffer = pdf) =>
  ({
    buffer,
    size: buffer.length,
    originalname: 'document.pdf',
    mimetype: 'text/html',
  }) as Express.Multer.File;

describe('media upload validation', () => {
  it('rejects missing/empty files and oversized buffers before storage', async () => {
    await expect(pipe().transform(undefined)).rejects.toThrow('nonempty');
    await expect(pipe().transform(file(Buffer.alloc(0)))).rejects.toThrow(
      'nonempty',
    );
    await expect(
      pipe({ MEDIA_MAX_FILE_SIZE: 5 }).transform(file()),
    ).rejects.toThrow('size limit');
  });
  it('detects bytes instead of trusting claimed MIME and normalizes size', async () => {
    expect(await pipe().transform({ ...file(), size: 999 })).toMatchObject({
      mimetype: 'application/pdf',
      size: pdf.length,
    });
    await expect(
      pipe().transform(file(Buffer.from('<script>alert(1)</script>'))),
    ).rejects.toThrow('not allowed');
    await expect(
      pipe({ MEDIA_ALLOWED_MIME_TYPES: 'image/png' }).transform(file()),
    ).rejects.toThrow('not allowed');
  });
  it('bounds buffering concurrency and releases slots after success/failure', async () => {
    const interceptor = new MediaUploadAdmissionInterceptor(
      new ConfigService({ MEDIA_MAX_CONCURRENT_UPLOADS: 1 }),
    );
    const context = {} as ExecutionContext;
    const subject = new Subject<number>();
    const pending = lastValueFrom(
      interceptor.intercept(context, { handle: () => subject }),
    );
    await expect(
      lastValueFrom(interceptor.intercept(context, { handle: () => of(1) })),
    ).rejects.toThrow('Too many');
    subject.next(1);
    subject.complete();
    await pending;
    await expect(
      lastValueFrom(
        interceptor.intercept(context, {
          handle: () => throwError(() => new Error('parser failed')),
        }),
      ),
    ).rejects.toThrow('parser failed');
    expect(
      await lastValueFrom(
        interceptor.intercept(context, { handle: () => of(2) }),
      ),
    ).toBe(2);
  });
  it('rejects duplicate, invalid and oversized deletion batches', async () => {
    for (const ids of [
      [1, 1],
      [-1],
      [1.5],
      [],
      Array.from({ length: 101 }, (_, index) => index + 1),
    ])
      expect(
        (await validate(plainToInstance(MediaBulkDeleteDto, { ids }))).length,
      ).toBeGreaterThan(0);
  });
});
