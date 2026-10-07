import {
  BUSINESS_TIME_ZONE,
  BUSINESS_TIME_ZONES,
  businessDateInputToISO,
  toBusinessDateInput,
} from '@/common/utils/business-time';
import { BadRequestException } from '@nestjs/common';
export type CreatedInPreset = 'today' | '7d' | '1m' | '3m';
/** Local calendar boundaries; upper bound is the next day, exclusively. */
export function createdInRange(
  preset?: CreatedInPreset,
  now = new Date(),
  timeZone = BUSINESS_TIME_ZONE,
) {
  if (!preset) return undefined;
  if (!(BUSINESS_TIME_ZONES as readonly string[]).includes(timeZone))
    throw new BadRequestException('Invalid report timezone');
  const daysBack = { today: 0, '7d': 6, '1m': 30, '3m': 90 }[preset];
  const calendar = new Date(
    `${toBusinessDateInput(now, timeZone).slice(0, 10)}T00:00:00Z`,
  );
  const start = new Date(calendar.getTime() - daysBack * 86_400_000);
  const end = new Date(calendar.getTime() + 86_400_000);
  return {
    from: new Date(
      businessDateInputToISO(
        start.toISOString().slice(0, 10) + 'T00:00:00',
        timeZone,
      ),
    ),
    to: new Date(
      businessDateInputToISO(
        end.toISOString().slice(0, 10) + 'T00:00:00',
        timeZone,
      ),
    ),
  };
}
