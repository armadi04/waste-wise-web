import type {
  CategoryFilter,
  ClassificationStatus,
  ReportStatus,
  WasteCategory,
} from '@/types/api'

export const REPORT_STATUS_VALUES = [
  'PENDING',
  'IN_PROGRESS',
  'COMPLETED',
  'REJECTED',
] as const satisfies ReadonlyArray<ReportStatus>

export const WASTE_CATEGORY_VALUES = [
  'ORGANIC_WASTE',
  'PLASTIC_WASTE',
  'PAPER_WASTE',
] as const satisfies ReadonlyArray<WasteCategory>

export const CATEGORY_FILTER_VALUES = [
  ...WASTE_CATEGORY_VALUES,
  'UNCLASSIFIED',
] as const satisfies ReadonlyArray<CategoryFilter>

export const REPORT_STATUS_LABEL: Record<ReportStatus, string> = {
  PENDING: 'Pending',
  IN_PROGRESS: 'In Progress',
  COMPLETED: 'Completed',
  REJECTED: 'Rejected',
}

export const REPORT_STATUS_COLOR: Record<
  ReportStatus,
  'default' | 'primary' | 'success' | 'warning' | 'danger'
> = {
  PENDING: 'warning',
  IN_PROGRESS: 'primary',
  COMPLETED: 'success',
  REJECTED: 'danger',
}

export const WASTE_CATEGORY_LABEL: Record<WasteCategory, string> = {
  ORGANIC_WASTE: 'Organic Waste',
  PLASTIC_WASTE: 'Plastic Waste',
  PAPER_WASTE: 'Paper Waste',
}

export const CATEGORY_FILTER_LABEL: Record<CategoryFilter, string> = {
  ...WASTE_CATEGORY_LABEL,
  UNCLASSIFIED: 'Unclassified',
}

export const WASTE_CATEGORY_COLOR: Record<
  WasteCategory,
  'default' | 'primary' | 'success' | 'warning' | 'danger'
> = {
  ORGANIC_WASTE: 'success',
  PLASTIC_WASTE: 'primary',
  PAPER_WASTE: 'warning',
}

export const REPORT_STATUS_TRANSITIONS: Record<
  ReportStatus,
  Array<ReportStatus>
> = {
  PENDING: ['IN_PROGRESS', 'REJECTED'],
  IN_PROGRESS: ['COMPLETED', 'REJECTED'],
  COMPLETED: [],
  REJECTED: [],
}

export const CLASSIFICATION_STATUS_LABEL: Record<ClassificationStatus, string> =
  {
    COMPLETED: 'Classified',
    FAILED: 'Classification failed',
  }

export const CLASSIFICATION_ERROR_LABEL: Record<string, string> = {
  ML_UNAVAILABLE: 'AI service is unavailable. Category was not saved.',
  ML_REJECTED_IMAGE: 'AI service rejected the photo. Category was not saved.',
  ML_INVALID_RESPONSE: 'AI service returned an invalid result.',
  MEDIA_UNAVAILABLE: 'Report photo could not be read by the AI service.',
}

export const REPORT_IMAGE_MAX_BYTES = 5 * 1024 * 1024
export const REPORT_IMAGE_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
] as const
