import { jest } from 'bun:test';
import type { MediaStorage } from '@/media/storage/media-storage';
import {
  ClassificationStatus,
  WasteCategory,
} from '@/reports/entities/report.entity';
import type { Media } from '@/media/entities/media.entity';
import type { ClassificationResult } from '@/reports/classification.service';

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
      };
      await onReserved(stored);
      return stored;
    },
    getSignedUrl: async (object) =>
      `https://storage.test/signed/${object.path}`,
    delete: async () => undefined,
  };
}

export interface FakeClassifier {
  classify: jest.Mock<Promise<ClassificationResult>, [Media]>;
}

export function makeFakeClassifier(
  result: ClassificationResult = {
    status: ClassificationStatus.COMPLETED,
    category: WasteCategory.PLASTIC_WASTE,
    confidence: 0.94,
    modelVersion: '1.0.0',
    errorCode: null,
  },
): FakeClassifier {
  return {
    classify: jest.fn(async () => result),
  };
}
