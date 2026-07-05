import type { TenantRecord } from "tenancyjs-core";

import {
  createPrismaResourceTenancy,
  type PrismaDatabaseTenancy,
  type PrismaDatabaseTenancyOptions,
} from "./database-router.js";

/**
 * A Prisma client factory configured for one PostgreSQL schema. With Prisma 7
 * and `@prisma/adapter-pg`, create the client with
 * `new PrismaPg({ connectionString }, { schema })`.
 *
 * `key` is opaque and must not contain a URL or credentials.
 */
export type PrismaSchemaPlacement<TClient extends object> = Readonly<{
  key: string;
  create: () => TClient | Promise<TClient>;
}>;

export interface PrismaSchemaTenancyOptions<
  TTenant extends TenantRecord,
  TClient extends object,
> extends Omit<PrismaDatabaseTenancyOptions<TTenant, TClient>, "connection"> {
  readonly schema: (tenant: TTenant) => PrismaSchemaPlacement<TClient>;
}

export type PrismaSchemaTenancy<TClient extends object> =
  PrismaDatabaseTenancy<TClient>;

/**
 * Route an active tenant to a cached Prisma client whose PostgreSQL driver
 * adapter is bound to that tenant's schema. The client is valid only for the
 * callback lifetime and must not be retained.
 */
export function createPrismaSchemaTenancy<
  TTenant extends TenantRecord = TenantRecord,
  TClient extends object = object,
>(
  options: PrismaSchemaTenancyOptions<TTenant, TClient>,
): PrismaSchemaTenancy<TClient> {
  return createPrismaResourceTenancy(
    { ...options, connection: options.schema },
    "schema",
  );
}
