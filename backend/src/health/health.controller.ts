import { DatabaseHealthService } from './database-health.service';
import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  HealthCheck,
  HealthCheckService,
  type HealthIndicatorResult,
  MemoryHealthIndicator,
} from '@nestjs/terminus';
import { SkipThrottle } from '@nestjs/throttler';

@ApiTags('Health')
@Controller('health')
@SkipThrottle()
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly db: DatabaseHealthService,
    private readonly memory: MemoryHealthIndicator,
  ) {}

  @Get()
  @HealthCheck()
  @ApiOperation({
    summary: 'Service health and PostgreSQL connectivity',
    description:
      'Checks PostgreSQL connectivity with a dedicated pool (1 second acquisition timeout, 1 second server statement timeout, 1.5 second transport fallback) and a 300 MiB heap limit. This does not validate schema or business operations. Returns HTTP 200 when both checks succeed, otherwise HTTP 503 with sanitized dependency status.',
  })
  check() {
    return this.health.check([
      () => this.checkDatabase(),
      () => this.checkMemory(),
    ]);
  }

  private async checkDatabase(): Promise<HealthIndicatorResult> {
    try {
      const result = await this.db.check();
      return this.sanitizeIndicator('database', result);
    } catch {
      return { database: { status: 'down', message: 'Database unavailable' } };
    }
  }

  private async checkMemory(): Promise<HealthIndicatorResult> {
    try {
      const result = await this.memory.checkHeap(
        'memory_heap',
        300 * 1024 * 1024,
      );
      return this.sanitizeIndicator('memory_heap', result);
    } catch {
      return { memory_heap: { status: 'down', message: 'Heap check failed' } };
    }
  }

  private sanitizeIndicator(
    key: string,
    result: HealthIndicatorResult,
  ): HealthIndicatorResult {
    const details: Record<string, unknown> = result[key];
    const status = details.status === 'up' ? 'up' : 'down';
    return {
      [key]: {
        status,
        ...(typeof details.responseTime === 'number'
          ? { responseTime: details.responseTime }
          : {}),
        ...(status === 'down'
          ? {
              message:
                key === 'database'
                  ? 'Database unavailable'
                  : 'Heap check failed',
            }
          : {}),
      },
    };
  }
}
