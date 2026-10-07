import {
  HttpException,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { EntityManager } from 'typeorm';

export const CAMPAIGN_LOCK_TIMEOUT_MS = 5000;
export const CAMPAIGN_SLOW_LOCK_MS = 250;
export const CAMPAIGN_SLOW_OPERATION_MS = 1000;
const logger = new Logger('CampaignTransactions');

export function databaseErrorCode(error: unknown): string | undefined {
  if (!error || typeof error !== 'object') return undefined;
  const value = error as { code?: unknown; driverError?: { code?: unknown } };
  const code = value.driverError?.code ?? value.code;
  return typeof code === 'string' &&
    (/^[A-Z0-9]{5}$/.test(code) ||
      ['ECONNRESET', 'ECONNREFUSED', 'ETIMEDOUT', 'EPIPE'].includes(code))
    ? code
    : undefined;
}

export async function observeCampaign<T>(
  operation: string,
  work: () => Promise<T>,
): Promise<T> {
  const started = performance.now();
  try {
    const value = await work();
    const durationMs = Math.round(performance.now() - started);
    if (durationMs >= CAMPAIGN_SLOW_OPERATION_MS)
      logger.warn({
        event: 'campaign_transaction_slow',
        operation,
        durationMs,
      });
    return value;
  } catch (error) {
    if (error instanceof HttpException && error.getStatus() < 500) throw error;
    const code = databaseErrorCode(error);
    logger.error({
      event: 'campaign_transaction_failed',
      operation,
      durationMs: Math.round(performance.now() - started),
      databaseCode: code,
      errorType: error instanceof Error ? error.name : 'Unknown',
    });
    if (
      code &&
      [
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
      ].includes(code)
    )
      throw new ServiceUnavailableException(
        'Campaign transaction temporarily unavailable; retry the same operation and idempotency key',
      );
    throw error;
  }
}

export async function campaignLock(
  manager: EntityManager,
  exclusive: boolean,
  userId?: number,
) {
  const started = performance.now();
  try {
    await manager.query(
      `SET LOCAL lock_timeout = '${CAMPAIGN_LOCK_TIMEOUT_MS}ms'`,
    );
    if (userId === undefined)
      await manager.query("SET LOCAL statement_timeout = '15s'");
    if (userId !== undefined)
      await manager.query('SELECT pg_advisory_xact_lock(71402, $1)', [userId]);
    else
      await manager.query(
        exclusive
          ? 'SELECT pg_advisory_xact_lock(71403, 0)'
          : 'SELECT pg_advisory_xact_lock_shared(71403, 0)',
      );
  } finally {
    const waitMs = Math.round(performance.now() - started);
    if (waitMs >= CAMPAIGN_SLOW_LOCK_MS)
      logger.warn({
        event: 'campaign_lock_wait',
        lock: userId === undefined ? 'attribution' : 'user',
        exclusive,
        waitMs,
      });
  }
}
