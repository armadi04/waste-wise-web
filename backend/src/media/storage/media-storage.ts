export type MediaProvider = 'depot' | 's3';

export interface StoredObject {
  path: string | null;
  depotFileId?: number | null;
  remoteName?: string | null;
  userId?: number | null;
}

export interface MediaStorage {
  upload(
    file: Express.Multer.File,
    object: StoredObject,
    onReserved: (object: StoredObject) => Promise<void>,
  ): Promise<StoredObject>;
  getSignedUrl(object: StoredObject): Promise<string>;
  delete(object: StoredObject): Promise<void>;
}
