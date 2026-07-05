import type {
  CallHandler,
  ExecutionContext,
  NestInterceptor,
} from "@nestjs/common";
import type { Reflector } from "@nestjs/core";
import type { TenancyManager, TenantRecord } from "@tenancyjs/core";
import { Observable, type Subscriber, type Subscription } from "rxjs";

import { isTenantRoute } from "./guard.js";
import type { NestTenantResolutionStore } from "./resolution-store.js";
import type { NestTenancyExecutor } from "./types.js";

export class NestTenantContextInterceptor<
  TTenant extends TenantRecord = TenantRecord,
> implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly manager: TenancyManager<TTenant>,
    private readonly store: NestTenantResolutionStore<TTenant>,
    private readonly executor: NestTenancyExecutor | undefined,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (!isTenantRoute(this.reflector, context)) return next.handle();
    const request = context.switchToHttp().getRequest<object>();
    const tenant = this.store.consume(request);

    return new Observable((subscriber) => {
      let subscription: Subscription | undefined;
      let settle: (() => void) | undefined;
      let cancelled = false;
      const observe = (): Promise<void> =>
        new Promise<void>((resolve, reject) => {
          settle = resolve;
          if (cancelled) {
            resolve();
            return;
          }
          subscription = subscribe(next, subscriber, resolve, reject);
        });
      const execute = (): Promise<void> =>
        this.executor === undefined ? observe() : this.executor.run(observe);

      void this.manager
        .runWithTenant(tenant, execute)
        .catch((error: unknown) => {
          if (!subscriber.closed) subscriber.error(error);
        });

      return () => {
        cancelled = true;
        subscription?.unsubscribe();
        settle?.();
      };
    });
  }
}

function subscribe(
  next: CallHandler,
  subscriber: Subscriber<unknown>,
  resolve: () => void,
  reject: (reason: unknown) => void,
): Subscription {
  return next.handle().subscribe({
    next: (value: unknown) => subscriber.next(value),
    error: reject,
    complete: () => {
      subscriber.complete();
      resolve();
    },
  });
}
