import { afterEach, expect, it, mock, spyOn } from 'bun:test';
import {
  ConflictException,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  databaseErrorCode,
  observeCampaign,
} from '@/portal/campaigns/campaign-observation';

afterEach(() => mock.restore());

it('returns a retryable 503 for transaction contention and emits no secret error payload', async () => {
  const log = spyOn(Logger.prototype, 'error').mockImplementation(
    () => undefined,
  );
  for (const code of [
    '55P03',
    '57014',
    '40P01',
    '40001',
    '08006',
    '08003',
    '57P01',
    'ECONNRESET',
    'ECONNREFUSED',
    'ETIMEDOUT',
    'EPIPE',
  ]) {
    try {
      await observeCampaign('payment', () =>
        Promise.reject(
          Object.assign(new Error('PRIVATE-CODE-and-credentials'), {
            driverError: { code },
          }),
        ),
      );
      throw new Error('Expected a failure');
    } catch (error) {
      expect(error).toBeInstanceOf(ServiceUnavailableException);
      expect((error as ServiceUnavailableException).getStatus()).toBe(503);
    }
  }
  expect(log).toHaveBeenCalledTimes(11);
  expect(JSON.stringify(log.mock.calls)).not.toContain('PRIVATE-CODE');
  expect(JSON.stringify(log.mock.calls)).toContain(
    'campaign_transaction_failed',
  );
});

it('does not report expected business conflicts as operational failures', async () => {
  const log = spyOn(Logger.prototype, 'error').mockImplementation(
    () => undefined,
  );
  await expect(
    observeCampaign('adjustment', () =>
      Promise.reject(new ConflictException('Duplicate')),
    ),
  ).rejects.toBeInstanceOf(ConflictException);
  expect(log).not.toHaveBeenCalled();
});

it('preserves unknown failures and rejects untrusted database-code strings', async () => {
  spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  const failure = new Error('Failure');
  await expect(
    observeCampaign('payment', () => Promise.reject(failure)),
  ).rejects.toBe(failure);
  expect(databaseErrorCode({ code: 'password=secret' })).toBeUndefined();
  expect(await observeCampaign('payment', () => Promise.resolve('ok'))).toBe(
    'ok',
  );
});
