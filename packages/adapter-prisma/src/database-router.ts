import type {
  MaybePromise,
  TenancyManager,
  TenantRecord,
} from "@tenancyjs/core";
import { TenantContextError } from "@tenancyjs/core";
import {
  createTenantResourceCache,
  type TenantResourceCache,
} from "@tenancyjs/adapter-shared";

import { PrismaTenancyConfigurationError } from "./errors.js";

const DEFAULT_MAX_CONNECTIONS = 25;

/**
 * A per-tenant Prisma client the host supplies for database-per-tenant.
 * `key` is an opaque cache key (never a URL/credentials); `create` builds the
 * tenant's `PrismaClient` (typically `new PrismaClient({ adapter })`).
 */
export interface PrismaDatabasePlacement<TClient extends object> {
  readonly key: string;
  readonly create: () => MaybePromise<TClient>;
}

export interface PrismaDatabaseTenancyOptions<
  TTenant extends TenantRecord,
  TClient extends object,
> {
  readonly manager: TenancyManager<TTenant>;
  readonly connection: (tenant: TTenant) => PrismaDatabasePlacement<TClient>;
  /** Dispose a leased client on eviction/shutdown, e.g. `(c) => c.$disconnect()`. */
  readonly disconnect: (client: TClient) => MaybePromise<void>;
  readonly maxConnections?: number;
}

export interface PrismaDatabaseTenancy<TClient extends object> {
  /**
   * Run within the active tenant's own database. Resolves the current tenant,
   * leases its cached client, and passes it to the callback. Fails closed:
   * no tenant context, or central context, throws — the central/landlord
   * database is accessed directly, not through this router.
   */
  run<TResult>(
    callback: (client: TClient) => MaybePromise<TResult>,
  ): Promise<TResult>;
  close(): Promise<void>;
}

export function createPrismaDatabaseTenancy<
  TTenant extends TenantRecord = TenantRecord,
  TClient extends object = object,
>(
  options: PrismaDatabaseTenancyOptions<TTenant, TClient>,
): PrismaDatabaseTenancy<TClient> {
  if (
    options === null ||
    typeof options !== "object" ||
    typeof options.manager?.getContext !== "function" ||
    typeof options.connection !== "function" ||
    typeof options.disconnect !== "function"
  ) {
    throw new PrismaTenancyConfigurationError(
      "Prisma database-per-tenant requires a manager, a connection resolver, and a disconnect callback.",
    );
  }
  const maxConnections = options.maxConnections ?? DEFAULT_MAX_CONNECTIONS;
  if (!Number.isSafeInteger(maxConnections) || maxConnections <= 0) {
    throw new PrismaTenancyConfigurationError(
      "Prisma database-per-tenant requires a positive maxConnections.",
    );
  }
  const cache: TenantResourceCache<TClient> =
    createTenantResourceCache<TClient>({
      capacity: maxConnections,
      destroy: (client) => options.disconnect(client),
    });

  return Object.freeze({
    async run<TResult>(
      callback: (client: TClient) => MaybePromise<TResult>,
    ): Promise<TResult> {
      if (typeof callback !== "function") {
        throw new PrismaTenancyConfigurationError(
          "Prisma database-per-tenant run requires a callback.",
        );
      }
      const context = options.manager.getContext();
      if (context === undefined) throw new TenantContextError("missing");
      if (context.mode !== "tenant") {
        throw new PrismaTenancyConfigurationError(
          "Prisma database-per-tenant requires a tenant context; access the central database directly.",
        );
      }
      const placement = options.connection(context.tenant);
      return cache.lease(
        context.tenant.id,
        placement.key,
        placement.create,
        (client) => callback(client),
      );
    },
    async close(): Promise<void> {
      await cache.close();
    },
  });
}
