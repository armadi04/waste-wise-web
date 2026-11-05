import type { UploadedMultipartFile } from '@nestjs/platform-fastify/multipart';
export type MediaProvider = 's3';

export interface StoredObject {
  path: string | null;
  remoteName?: string | null;
  userId?: number | null;
}

export interface MediaStorage {
  upload(
    file: UploadedMultipartFile,
    object: StoredObject,
    onReserved: (object: StoredObject) => Promise<void>,
  ): Promise<StoredObject>;
  getSignedUrl(object: StoredObject): Promise<string>;
  delete(object: StoredObject): Promise<void>;
}
