import { Inject, Injectable } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';

/**
 * The shape of a node-redis client, duck-typed because the adapter only exposes
 * it as `unknown`. cache-manager 7 keeps stores as Keyv instances, so the Redis
 * client lives at `keyv.store.client`.
 */
interface RedisClientLike {
  scan: (
    cursor: string,
    options: { MATCH: string; COUNT: number },
  ) => Promise<{ cursor: string; keys: string[] } | [string, string[]]>;
  del: (keys: string[]) => Promise<unknown>;
}

function globToRegExp(pattern: string): RegExp {
  const escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, (char) =>
    char === '*' ? '.*' : `\\${char}`,
  );
  return new RegExp(`^${escaped}$`);
}

@Injectable()
export class CacheService {
  constructor(@Inject(CACHE_MANAGER) private cacheManager: Cache) {}

  async clearKeys(pattern: string): Promise<void> {
    for (const store of this.cacheManager.stores) {
      const client = (store.store as { client?: RedisClientLike } | undefined)
        ?.client;

      if (client && typeof client.scan === 'function') {
        await this.clearRedisKeys(client, pattern);
        continue;
      }

      // Non-Redis stores (the in-memory fallback) have no SCAN, so walk the
      // store when it is iterable and drop the keys that match.
      if (typeof store.iterator === 'function') {
        const matcher = globToRegExp(pattern);
        for await (const [key] of store.iterator(undefined)) {
          if (typeof key === 'string' && matcher.test(key)) {
            await store.delete(key);
          }
        }
      }
    }
  }

  private async clearRedisKeys(
    client: RedisClientLike,
    pattern: string,
  ): Promise<void> {
    let cursor = '0';
    do {
      const reply = await client.scan(cursor, { MATCH: pattern, COUNT: 100 });

      // node-redis returns { cursor, keys }; ioredis-style clients return
      // [cursor, keys].
      const [nextCursor, keys] = Array.isArray(reply)
        ? [String(reply[0]), reply[1]]
        : [String(reply.cursor), reply.keys];
      cursor = nextCursor;

      if (keys.length > 0) {
        await client.del(keys);
      }
    } while (cursor !== '0');
  }
}
