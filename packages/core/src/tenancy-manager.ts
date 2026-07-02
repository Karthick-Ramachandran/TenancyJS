import { AsyncLocalStorage } from "node:async_hooks";

import {
  DuplicateBootstrapperError,
  InvalidBootstrapperError,
  InvalidTenantError,
  TenancyLifecycleError,
  TenantContextError,
} from "./errors.js";
import type {
  CentralContext,
  MaybePromise,
  TenancyBootstrapper,
  TenancyLifecycleEventName,
  TenancyLifecycleListener,
  TenancyManagerOptions,
  TenantContext,
  TenantExecutionContext,
  TenantRecord,
} from "./types.js";

const CENTRAL_CONTEXT: CentralContext = Object.freeze({ mode: "central" });
const EVENT_NAMES = new Set<TenancyLifecycleEventName>([
  "tenancy.initializing",
  "tenancy.initialized",
  "tenancy.ending",
  "tenancy.ended",
]);

export class TenancyManager<TTenant extends TenantRecord = TenantRecord> {
  readonly #storage = new AsyncLocalStorage<TenantContext<TTenant>>();
  readonly #bootstrappers: readonly TenancyBootstrapper<TTenant>[];
  readonly #listeners = new Map<
    TenancyLifecycleEventName,
    TenancyLifecycleListener<TTenant>[]
  >();

  constructor(options: TenancyManagerOptions<TTenant> = {}) {
    this.#bootstrappers = validateBootstrappers(options.bootstrappers ?? []);
  }

  getContext(): TenantContext<TTenant> | undefined {
    return this.#storage.getStore();
  }

  getTenant(): Readonly<TTenant> | null {
    const context = this.getContext();
    return context?.mode === "tenant" ? context.tenant : null;
  }

  getTenantOrFail(): Readonly<TTenant> {
    const context = this.getContext();
    if (context === undefined) {
      throw new TenantContextError("missing");
    }
    if (context.mode === "central") {
      throw new TenantContextError("central");
    }
    return context.tenant;
  }

  isInitialized(): boolean {
    return this.getContext() !== undefined;
  }

  on(
    event: TenancyLifecycleEventName,
    listener: TenancyLifecycleListener<TTenant>,
  ): () => void {
    if (!EVENT_NAMES.has(event)) {
      throw new TypeError(`Unknown tenancy lifecycle event: ${event}`);
    }
    if (typeof listener !== "function") {
      throw new TypeError("Tenancy lifecycle listener must be a function.");
    }

    const listeners = this.#listeners.get(event) ?? [];
    listeners.push(listener);
    this.#listeners.set(event, listeners);

    let subscribed = true;
    return () => {
      if (!subscribed) return;
      subscribed = false;
      const index = listeners.indexOf(listener);
      if (index >= 0) listeners.splice(index, 1);
    };
  }

  async runWithTenant<TResult>(
    tenant: TTenant,
    callback: () => MaybePromise<TResult>,
  ): Promise<TResult> {
    if (typeof callback !== "function") {
      throw new TypeError("Tenant callback must be a function.");
    }

    const context = createTenantContext(tenant);
    return this.#storage.run(context, () => this.#execute(context, callback));
  }

  async runInCentralContext<TResult>(
    callback: () => MaybePromise<TResult>,
  ): Promise<TResult> {
    if (typeof callback !== "function") {
      throw new TypeError("Central callback must be a function.");
    }

    return this.#storage.run(CENTRAL_CONTEXT, async () => callback());
  }

  async #execute<TResult>(
    context: TenantExecutionContext<TTenant>,
    callback: () => MaybePromise<TResult>,
  ): Promise<TResult> {
    const completed: TenancyBootstrapper<TTenant>[] = [];
    let result: TResult | undefined;
    let primaryError: unknown;
    let hasPrimaryError = false;

    try {
      await this.#emit("tenancy.initializing", context);
      for (const bootstrapper of this.#bootstrappers) {
        await bootstrapper.bootstrap(context);
        completed.push(bootstrapper);
      }
      await this.#emit("tenancy.initialized", context);
      result = await callback();
    } catch (error) {
      hasPrimaryError = true;
      primaryError = error;
    }

    const cleanupErrors: unknown[] = [];
    await this.#emitCollecting("tenancy.ending", context, cleanupErrors);

    for (const bootstrapper of completed.reverse()) {
      await collectError(() => bootstrapper.revert(context), cleanupErrors);
    }

    await this.#emitCollecting("tenancy.ended", context, cleanupErrors);

    if (cleanupErrors.length > 0) {
      throw new TenancyLifecycleError(
        hasPrimaryError ? primaryError : undefined,
        cleanupErrors,
        hasPrimaryError,
      );
    }
    if (hasPrimaryError) {
      throw primaryError;
    }

    return result as TResult;
  }

  async #emit(
    event: TenancyLifecycleEventName,
    context: TenantExecutionContext<TTenant>,
  ): Promise<void> {
    const listeners = [...(this.#listeners.get(event) ?? [])];
    for (const listener of listeners) {
      await listener(context);
    }
  }

  async #emitCollecting(
    event: "tenancy.ending" | "tenancy.ended",
    context: TenantExecutionContext<TTenant>,
    errors: unknown[],
  ): Promise<void> {
    const listeners = [...(this.#listeners.get(event) ?? [])];
    for (const listener of listeners) {
      await collectError(() => listener(context), errors);
    }
  }
}

function createTenantContext<TTenant extends TenantRecord>(
  tenant: TTenant,
): TenantExecutionContext<TTenant> {
  if (
    tenant === null ||
    typeof tenant !== "object" ||
    Array.isArray(tenant) ||
    typeof tenant.id !== "string" ||
    tenant.id.trim() === ""
  ) {
    throw new InvalidTenantError();
  }

  const snapshot = Object.freeze({ ...tenant }) as Readonly<TTenant>;
  return Object.freeze({ mode: "tenant", tenant: snapshot });
}

function validateBootstrappers<TTenant extends TenantRecord>(
  bootstrappers: readonly TenancyBootstrapper<TTenant>[],
): readonly TenancyBootstrapper<TTenant>[] {
  const ids = new Set<string>();
  const snapshot = [...bootstrappers];

  for (const bootstrapper of snapshot) {
    if (
      bootstrapper === null ||
      typeof bootstrapper !== "object" ||
      typeof bootstrapper.id !== "string" ||
      bootstrapper.id.trim() === "" ||
      typeof bootstrapper.bootstrap !== "function" ||
      typeof bootstrapper.revert !== "function"
    ) {
      throw new InvalidBootstrapperError();
    }
    if (ids.has(bootstrapper.id)) {
      throw new DuplicateBootstrapperError(bootstrapper.id);
    }
    ids.add(bootstrapper.id);
  }

  return Object.freeze(snapshot);
}

async function collectError(
  operation: () => MaybePromise<void>,
  errors: unknown[],
): Promise<void> {
  try {
    await operation();
  } catch (error) {
    errors.push(error);
  }
}
