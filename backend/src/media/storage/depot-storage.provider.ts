import type { UploadedMultipartFile } from '@nestjs/platform-fastify/multipart';
import { DepotClient, DepotError, putToS3 } from '@univstekom/depot-sdk';
import type { MediaStorage, StoredObject } from './media-storage';

export class DepotStorageProvider implements MediaStorage {
  private readonly client: DepotClient;
  private readonly timedFetch: typeof fetch;

  constructor(baseUrl: string, apiKey: string) {
    this.timedFetch = Object.assign(
      (
        input: Parameters<typeof fetch>[0],
        init?: Parameters<typeof fetch>[1],
      ) => fetch(input, { ...init, signal: AbortSignal.timeout(15_000) }),
      { preconnect: fetch.preconnect },
    );
    this.client = new DepotClient({ baseUrl, apiKey, fetch: this.timedFetch });
  }

  async upload(
    file: UploadedMultipartFile,
    object: StoredObject,
    onReserved: (object: StoredObject) => Promise<void>,
  ): Promise<StoredObject> {
    if (!object.remoteName) throw new Error('Missing durable upload name');
    const reservation = await this.client.createUpload({
      name: object.remoteName,
      mime: file.mimetype,
      size: file.size,
      ownerUserId: object.userId ?? undefined,
    });
    const stored = {
      ...object,
      path: reservation.s3Key,
      depotFileId: reservation.fileId,
    };
    await onReserved(stored);
    await putToS3(
      reservation.uploadUrl,
      file.buffer!,
      file.mimetype,
      undefined,
      this.timedFetch,
    );
    await this.client.completeUpload(reservation.fileId);
    return stored;
  }
  async getSignedUrl(object: StoredObject): Promise<string> {
    if (!object.depotFileId) throw new Error('Missing Depot file identifier');
    return (await this.client.getUrl(object.depotFileId)).url;
  }
  async delete(object: StoredObject): Promise<void> {
    const ids = object.depotFileId ? [object.depotFileId] : [];
    if (!object.depotFileId) {
      if (!object.remoteName)
        throw new Error('Missing durable upload identifier');
      // Recover a reservation created before the process could persist its ID.
      let page = 1;
      let totalPages: number;
      do {
        const result = await this.client.list({
          search: object.remoteName,
          page,
          limit: 100,
        });
        ids.push(
          ...result.data
            .filter(
              (file) =>
                file.name === object.remoteName &&
                file.ownerUserId === object.userId,
            )
            .map((file) => file.id),
        );
        if (ids.length > 20)
          throw new Error(
            'Upload reservation recovery exceeded its bounded deletion batch',
          );
        totalPages = result.meta.totalPages;
        if (totalPages > 20)
          throw new Error(
            'Upload reservation recovery exceeded its bounded search',
          );
        page += 1;
      } while (page <= totalPages);
    }
    for (const id of ids) {
      try {
        await this.client.delete(id);
      } catch (error) {
        if (!(error instanceof DepotError && error.status === 404)) throw error;
      }
    }
  }
}
