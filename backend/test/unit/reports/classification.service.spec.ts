import { describe, beforeEach, afterEach, expect, it, jest } from 'bun:test';
import { ClassificationService } from '../../../src/reports/classification.service';
import {
  ClassificationStatus,
  WasteCategory,
} from '../../../src/reports/entities/report.entity';
import type { Media } from '../../../src/media/entities/media.entity';

const media = {
  id: 7,
  filename: 'waste.jpg',
  mimetype: 'image/jpeg',
  storageProfile: 'primary',
  provider: 's3',
  storageFingerprint: 'fingerprint',
} as Media;

describe('ClassificationService', () => {
  const originalFetch = globalThis.fetch;
  let service: ClassificationService;
  let fetchMock: ReturnType<typeof jest.fn>;

  beforeEach(() => {
    const config = {
      get: jest.fn((key: string) => {
        if (key === 'ML_SERVICE_URL') return 'http://ml:8000';
        if (key === 'ML_SERVICE_TIMEOUT_MS') return 5000;
        return undefined;
      }),
    };
    const storage = {
      forMedia: jest.fn(() => ({
        getSignedUrl: jest.fn(() => Promise.resolve('https://media/file')),
      })),
    };
    service = new ClassificationService(config as never, storage as never);
    fetchMock = jest.fn();
    globalThis.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('maps ML class names to stored waste categories', async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(4)),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            predicted_class: 'plastic',
            confidence: 0.94,
            model_version: '1.0.0',
          }),
      });

    const result = await service.classify(media);

    expect(result).toEqual({
      status: ClassificationStatus.COMPLETED,
      category: WasteCategory.PLASTIC_WASTE,
      confidence: 0.94,
      modelVersion: '1.0.0',
      errorCode: null,
    });
  });

  it('stores a failed result instead of inventing a category', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(4)),
    });
    fetchMock.mockResolvedValueOnce({ ok: false, status: 500 });

    const result = await service.classify(media);

    expect(result.status).toBe(ClassificationStatus.FAILED);
    expect(result.category).toBeNull();
    expect(result.confidence).toBeNull();
    expect(result.errorCode).toBe('ML_UNAVAILABLE');
  });

  it('rejects unknown classes from the ML response', async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(4)),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({ predicted_class: 'metal', confidence: 0.9 }),
      });

    const result = await service.classify(media);

    expect(result.status).toBe(ClassificationStatus.FAILED);
    expect(result.errorCode).toBe('ML_INVALID_RESPONSE');
  });

  it('fails clearly when no ML service is configured', async () => {
    const unconfigured = new ClassificationService(
      { get: jest.fn(() => undefined) } as never,
      {} as never,
    );

    const result = await unconfigured.classify(media);

    expect(result).toEqual({
      status: ClassificationStatus.FAILED,
      category: null,
      confidence: null,
      modelVersion: null,
      errorCode: 'ML_UNAVAILABLE',
    });
  });
});
