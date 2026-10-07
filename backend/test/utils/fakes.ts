import { jest } from 'bun:test';
import type { MediaStorage } from '@/media/storage/media-storage';

export interface FakeMailService {
  sendVerificationEmail: jest.Mock;
  sendInvitationEmail: jest.Mock;
  sendPasswordReset: jest.Mock;
}
export function makeFakeMail(): FakeMailService {
  return {
    sendVerificationEmail: jest.fn(async () => undefined),
    sendInvitationEmail: jest.fn(async () => undefined),
    sendPasswordReset: jest.fn(async () => undefined),
  };
}
export const fakeTurnstile = { verify: async (): Promise<void> => undefined };
export const passThroughGuard = { canActivate: (): boolean => true };

export function makeFakeStorage(): MediaStorage {
  let nextId = 1;
  return {
    upload: async (file, object, onReserved) => {
      const id = nextId++;
      const stored = {
        ...object,
        path: `uploads/${id}-${file.originalname}`,
        depotFileId: id,
      };
      await onReserved(stored);
      return stored;
    },
    getSignedUrl: async (object) =>
      `https://depot.test/signed/${object.depotFileId}`,
    delete: async () => undefined,
  };
}
