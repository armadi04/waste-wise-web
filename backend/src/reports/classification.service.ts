import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Media } from '../media/entities/media.entity';
import { MediaStorageService } from '../media/storage/media-storage.service';
import { ClassificationStatus, WasteCategory } from './entities/report.entity';

export interface ClassificationResult {
  status: ClassificationStatus;
  category: WasteCategory | null;
  confidence: number | null;
  modelVersion: string | null;
  errorCode: string | null;
}

const CATEGORY_MAP: Record<string, WasteCategory> = {
  organic: WasteCategory.ORGANIC_WASTE,
  plastic: WasteCategory.PLASTIC_WASTE,
  paper: WasteCategory.PAPER_WASTE,
};

@Injectable()
export class ClassificationService {
  private readonly logger = new Logger(ClassificationService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly storage: MediaStorageService,
  ) {}

  async classify(media: Media): Promise<ClassificationResult> {
    const baseUrl = this.config.get<string>('ML_SERVICE_URL');
    if (!baseUrl) return this.failed('ML_UNAVAILABLE');

    const timeout = this.config.get<number>('ML_SERVICE_TIMEOUT_MS') ?? 15000;
    // One deadline for the whole classification (media fetch + inference), so a
    // slow storage read cannot push the request past the client's own timeout.
    const signal = AbortSignal.timeout(timeout);
    const token = this.config.get<string>('ML_SERVICE_TOKEN');

    let bytes: ArrayBuffer;
    try {
      const signedUrl = await this.storage.forMedia(media).getSignedUrl(media);
      const imageResponse = await fetch(signedUrl, { signal });
      if (!imageResponse.ok) return this.failed('MEDIA_UNAVAILABLE');
      bytes = await imageResponse.arrayBuffer();
    } catch {
      return this.failed('MEDIA_UNAVAILABLE');
    }

    try {
      const form = new FormData();
      form.append(
        'file',
        new Blob([bytes], { type: media.mimetype }),
        media.filename,
      );
      const response = await fetch(
        `${baseUrl.replace(/\/+$/, '')}/api/v1/predict`,
        {
          method: 'POST',
          body: form,
          headers: token ? { 'X-Internal-Token': token } : undefined,
          signal,
        },
      );
      if (!response.ok) {
        this.logger.warn(`Classification request failed: ${response.status}`);
        return this.failed(
          [400, 413, 415].includes(response.status)
            ? 'ML_REJECTED_IMAGE'
            : 'ML_UNAVAILABLE',
        );
      }
      const payload = (await response.json()) as {
        predicted_class?: unknown;
        confidence?: unknown;
        model_version?: unknown;
      };
      const category =
        typeof payload.predicted_class === 'string'
          ? CATEGORY_MAP[payload.predicted_class]
          : undefined;
      const confidence =
        typeof payload.confidence === 'number' &&
        Number.isFinite(payload.confidence) &&
        payload.confidence >= 0 &&
        payload.confidence <= 1
          ? payload.confidence
          : undefined;
      if (!category || confidence === undefined)
        return this.failed('ML_INVALID_RESPONSE');
      const minConfidence = this.config.get<number>('ML_MIN_CONFIDENCE');
      if (minConfidence !== undefined && confidence < minConfidence) {
        this.logger.warn(
          `Classification below minimum confidence: ${confidence} < ${minConfidence}`,
        );
        return this.failed('ML_LOW_CONFIDENCE');
      }
      return {
        status: ClassificationStatus.COMPLETED,
        category,
        confidence,
        modelVersion:
          typeof payload.model_version === 'string'
            ? payload.model_version
            : null,
        errorCode: null,
      };
    } catch {
      this.logger.warn('Classification request unavailable');
      return this.failed('ML_UNAVAILABLE');
    }
  }

  private failed(errorCode: string): ClassificationResult {
    return {
      status: ClassificationStatus.FAILED,
      category: null,
      confidence: null,
      modelVersion: null,
      errorCode,
    };
  }
}
