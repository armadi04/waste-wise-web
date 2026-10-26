import 'reflect-metadata';
import { Controller, Get, Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

class BenchmarkController {
  get() {
    return {
      status: 'ok',
      items: Array.from({ length: 10 }, (_, id) => ({
        id,
        name: `item-${id}`,
      })),
    };
  }
}
class BenchmarkModule {}
Controller('benchmark')(BenchmarkController);
Get()(
  BenchmarkController.prototype,
  'get',
  Object.getOwnPropertyDescriptor(BenchmarkController.prototype, 'get')!,
);
Module({ controllers: [BenchmarkController] })(BenchmarkModule);
const adapterName = process.argv[2] ?? 'fastify';
if (!['express', 'fastify'].includes(adapterName))
  throw new Error('Expected express or fastify');
const adapter =
  adapterName === 'fastify'
    ? new (await import('@nestjs/platform-fastify')).FastifyAdapter()
    : undefined;
const app = adapter
  ? await NestFactory.create(BenchmarkModule, adapter, { logger: false })
  : await NestFactory.create(BenchmarkModule, { logger: false });
await app.listen(0, '127.0.0.1');
const url = `${await app.getUrl()}/benchmark`;
// Both adapters run the exact same deterministic JSON endpoint on Bun, no DB or providers.
async function load(count: number) {
  const latencies: number[] = [];
  let index = 0;
  await Promise.all(
    Array.from({ length: 20 }, async () => {
      while (index++ < count) {
        const start = performance.now();
        const response = await fetch(url);
        if (response.status !== 200)
          throw new Error(`Unexpected ${response.status}`);
        await response.arrayBuffer();
        latencies.push(performance.now() - start);
      }
    }),
  );
  return latencies.sort((a, b) => a - b);
}
await load(1000);
const trials = [];
for (let i = 0; i < 3; i++) {
  const cpu = process.cpuUsage();
  const start = performance.now();
  const values = await load(10000);
  const elapsed = performance.now() - start;
  const used = process.cpuUsage(cpu);
  trials.push({
    requests: 10000,
    concurrency: 20,
    elapsedMs: elapsed,
    requestsPerSecond: 10000 / (elapsed / 1000),
    p50Ms: values[5000],
    p95Ms: values[9500],
    cpuMs: (used.user + used.system) / 1000,
    cpuPercent: ((used.user + used.system) / 1000 / elapsed) * 100,
    rssMiB: process.memoryUsage().rss / 1024 / 1024,
    heapUsedMiB: process.memoryUsage().heapUsed / 1024 / 1024,
  });
}
console.log(
  JSON.stringify({ adapter: adapterName, bun: Bun.version, trials }, null, 2),
);
await app.close();
