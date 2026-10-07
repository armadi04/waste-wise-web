import { BUSINESS_TIME_ZONE } from '@/common/utils/business-time';
export const dateLabel = (
  value: Date | string,
  timeZone = BUSINESS_TIME_ZONE,
) =>
  new Date(value).toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone,
  });
