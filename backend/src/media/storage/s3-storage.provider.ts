import type { UploadedMultipartFile } from '@nestjs/platform-fastify/multipart';
import { S3Client } from 'bun';
import type { MediaStorage, StoredObject } from './media-storage';

export type S3StorageOptions = ConstructorParameters<typeof S3Client>[0];

export class S3StorageProvider implements MediaStorage {
  private readonly client: S3Client;
  constructor(options: S3StorageOptions) {
    this.client = new S3Client(options);
  }

  async upload(
    file: UploadedMultipartFile,
    object: StoredObject,
    onReserved: (object: StoredObject) => Promise<void>,
  ): Promise<StoredObject> {
    if (!object.path) throw new Error('Missing durable object key');
    await onReserved(object);
    const url = this.client.presign(object.path, {
      expiresIn: 60,
      method: 'PUT',
      type: file.mimetype,
    });
    const response = await fetch(url, {
      method: 'PUT',
      body: new Uint8Array(file.buffer!).buffer,
      headers: { 'Content-Type': file.mimetype },
      signal: AbortSignal.timeout(30_000),
    });
    await response.body?.cancel();
    if (!response.ok) throw new Error('S3 upload failed');
    return object;
  }
  getSignedUrl(object: StoredObject): Promise<string> {
    if (!object.path) throw new Error('Missing object key');
    return Promise.resolve(
      this.client.presign(object.path, { expiresIn: 300, method: 'GET' }),
    );
  }
  async delete(object: StoredObject): Promise<void> {
    if (!object.path) throw new Error('Missing object key');
    const url = this.client.presign(object.path, {
      expiresIn: 60,
      method: 'DELETE',
    });
    const response = await fetch(url, {
      method: 'DELETE',
      signal: AbortSignal.timeout(30_000),
    });
    await response.body?.cancel();
    if (!response.ok && response.status !== 404)
      throw new Error('S3 deletion failed');
  }
}
