import { Injectable, Logger } from '@nestjs/common';

/**
 * The "everyone reload" signal.
 *
 * A deploy swaps the served bundle, but a browser holding an old service-worker
 * precache keeps running the previous one until it happens to update. This lets
 * an operator push every client onto the new build.
 *
 * The signal is a timestamp rather than a flag: clients remember the last one
 * they applied, so a reload is idempotent and a client that was offline when it
 * was issued still refreshes on its next connection (the gateway replays the
 * stored value on connect).
 *
 * It is held in memory, deliberately. `NotificationsGateway` broadcasts through
 * a plain Socket.IO server with no Redis adapter, so a broadcast already only
 * reaches clients connected to this instance — persisting the signal elsewhere
 * would not make it cross instances, only look like it did. A restart clears
 * it, which is fine: the signal only matters in the window right after a deploy,
 * and a restart is itself a fresh deploy.
 */
@Injectable()
export class AppRefreshService {
  private readonly logger = new Logger(AppRefreshService.name);

  private issuedAt: string | null = null;

  /** ISO timestamp of the standing signal, or null when none is outstanding. */
  current(): string | null {
    return this.issuedAt;
  }

  /** Issue a new signal and return it. */
  issue(): string {
    this.issuedAt = new Date().toISOString();
    this.logger.log(`Force-refresh signal issued at ${this.issuedAt}`);
    return this.issuedAt;
  }
}
