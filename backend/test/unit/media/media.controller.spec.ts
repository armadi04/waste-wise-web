import 'reflect-metadata';
import { describe, expect, it } from 'bun:test';

// Bun's test runner cannot statically load @nestjs/throttler (pulled in by the
// auth guards) — see pass-qr.controller.spec.ts — so Nest-side imports are
// dynamic, in dependency order.
await import('@nestjs/core');
const { CacheInterceptor } = await import('@nestjs/cache-manager');
const { MediaController } = await import('@/media/media.controller');
// INTERCEPTORS_METADATA from @nestjs/common/constants.
const INTERCEPTORS_METADATA = '__interceptors__';

const interceptorsOf = (handler: unknown) =>
  (Reflect.getMetadata(INTERCEPTORS_METADATA, handler as object) ??
    []) as unknown[];

describe('MediaController caching', () => {
  // The response cache is keyed by URL alone; both reads depend on who asks
  // (own files vs media.read_all, and an in-handler ownership check).
  it('never serves media reads from the shared response cache', () => {
    expect(interceptorsOf(MediaController.prototype.findAll)).not.toContain(
      CacheInterceptor,
    );
    expect(interceptorsOf(MediaController.prototype.findOne)).not.toContain(
      CacheInterceptor,
    );
  });
});
