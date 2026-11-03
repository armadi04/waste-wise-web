import 'reflect-metadata';
import { resolve } from 'node:path';
import type {
  Type,
  InjectionToken,
  ValueProvider,
  CanActivate,
  NestInterceptor,
  CallHandler,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { createHttpAdapter } from '@/config/http';
import { ConfigService } from '@nestjs/config';
import {
  GUARDS_METADATA,
  INTERCEPTORS_METADATA,
} from '@nestjs/common/constants';
import { SwaggerModule } from '@nestjs/swagger';
import { configureApiRouting } from '@/config/api-routing';
import { buildSwaggerConfig } from '@/config/swagger.config';

/** Compile real controllers and DTO metadata, without business modules or database connections. */
export async function contractSnapshot() {
  const controllers: Type<unknown>[] = [];
  const providers = new Map<InjectionToken, ValueProvider>();
  const guards = new Set<CanActivate | Type<CanActivate>>();
  const interceptors = new Set<NestInterceptor | Type<NestInterceptor>>();
  for (const file of [
    ...new Bun.Glob('src/**/*.controller.ts').scanSync(),
  ].sort()) {
    const exports = (await import(resolve(file))) as Record<string, unknown>;
    for (const candidate of Object.values(exports)) {
      if (
        typeof candidate !== 'function' ||
        !Reflect.hasMetadata('path', candidate)
      )
        continue;
      const controller = candidate as Type<unknown>;
      controllers.push(controller);
      for (const token of metadata<InjectionToken>(
        'design:paramtypes',
        controller,
      ))
        providers.set(token, { provide: token, useValue: {} });
      const prototype = controller.prototype as Record<string, unknown>;
      for (const target of [
        controller,
        ...Object.getOwnPropertyNames(prototype)
          .map((key) => prototype[key])
          .filter(
            (value): value is (...args: unknown[]) => unknown =>
              typeof value === 'function',
          ),
      ]) {
        for (const guard of metadata<CanActivate | Type<CanActivate>>(
          GUARDS_METADATA,
          target,
        ))
          guards.add(guard);
        for (const interceptor of metadata<
          NestInterceptor | Type<NestInterceptor>
        >(INTERCEPTORS_METADATA, target))
          interceptors.add(interceptor);
      }
    }
  }
  providers.set(ConfigService, {
    provide: ConfigService,
    useValue: new ConfigService(),
  });
  const builder = Test.createTestingModule({
    controllers,
    providers: [...providers.values()],
  });
  for (const guard of guards)
    builder.overrideGuard(guard).useValue({ canActivate: () => true });
  for (const interceptor of interceptors)
    builder.overrideInterceptor(interceptor).useValue({
      intercept: (_ctx: unknown, next: CallHandler) => next.handle(),
    });
  const module = await builder.compile();
  const app = module.createNestApplication(createHttpAdapter(), {
    logger: false,
  });
  configureApiRouting(app);
  try {
    return SwaggerModule.createDocument(app, buildSwaggerConfig());
  } finally {
    await app.close();
  }
}

function metadata<T>(key: string, target: object): T[] {
  return (Reflect.getMetadata(key, target) as T[] | undefined) ?? [];
}
