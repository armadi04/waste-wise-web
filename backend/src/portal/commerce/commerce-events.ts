import { Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { DataSource, EntityManager, IsNull } from 'typeorm';
import { PortalCommerceOutbox } from '@/portal/commerce/entities/portal-commerce-outbox.entity';

export async function enqueueCommerceEvent(
  manager: EntityManager,
  operationKey: string,
  eventName: string,
  payload: Record<string, unknown>,
) {
  const repo = manager.getRepository(PortalCommerceOutbox);
  if (!(await repo.findOneBy({ operationKey })))
    await repo.save(
      repo.create({ operationKey, eventName, payload, deliveredAt: null }),
    );
}

// After this many failed deliveries an event is dead-lettered (failedAt).
export const COMMERCE_EVENT_MAX_ATTEMPTS = 5;
const logger = new Logger('CommerceEvents');

/**
 * Delivers up to 100 pending events oldest first. Each event succeeds or fails
 * on its own: a failing listener is recorded on that row (attempts, lastError)
 * and dead-lettered after COMMERCE_EVENT_MAX_ATTEMPTS, so it never holds back
 * the events behind it. Returns how many events were attempted.
 */
export async function deliverCommerceEvents(
  source: DataSource,
  events: EventEmitter2,
): Promise<number> {
  try {
    return await source.transaction(async (manager) => {
      const repo = manager.getRepository(PortalCommerceOutbox);
      const pending = await repo.find({
        where: { deliveredAt: IsNull(), failedAt: IsNull() },
        order: { id: 'ASC' },
        take: 100,
        lock: { mode: 'pessimistic_write' },
      });
      for (const event of pending) {
        try {
          await events.emitAsync(event.eventName, {
            ...event.payload,
            eventId: event.operationKey,
          });
          event.deliveredAt = new Date();
          event.lastError = null;
        } catch (error) {
          event.attempts += 1;
          event.lastError =
            error instanceof Error ? error.message : String(error);
          if (event.attempts >= COMMERCE_EVENT_MAX_ATTEMPTS)
            event.failedAt = new Date();
          logger.error(
            `Commerce event #${event.id} (${event.eventName}) failed, attempt ${event.attempts}/${COMMERCE_EVENT_MAX_ATTEMPTS}${event.failedAt ? ' — dead-lettered' : ''}: ${event.lastError}`,
          );
        }
        await repo.save(event);
      }
      return pending.length;
    });
  } catch (error) {
    // Reading or saving the outbox itself failed; rows stay pending for the
    // next run. Consumers deduplicate eventId.
    logger.error(
      `Commerce event delivery failed: ${error instanceof Error ? error.message : String(error)}`,
    );
    return 0;
  }
}

/**
 * Delivers batches until the outbox is empty (or a batch fails), for bulk
 * fan-out such as broadcasts where the per-minute worker would be too slow.
 */
export async function drainCommerceEvents(
  source: DataSource,
  events: EventEmitter2,
  maxBatches = 1000,
) {
  let delivered = 0;
  for (let batch = 0; batch < maxBatches; batch += 1) {
    const count = await deliverCommerceEvents(source, events);
    delivered += count;
    if (count < 100) break;
  }
  return delivered;
}
