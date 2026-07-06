import { AdapterTenancyError } from "tenancyjs-adapter-shared";

export type KnexTenancyErrorCode =
  | "TENANCY_KNEX_CONFIGURATION"
  | "TENANCY_KNEX_POLICY_VALIDATION"
  | "TENANCY_KNEX_TENANT_FIELD_CONFLICT"
  | "TENANCY_KNEX_UNREGISTERED_TABLE"
  | "TENANCY_KNEX_UNSUPPORTED_OPERATION";

export class KnexTenancyError extends AdapterTenancyError<KnexTenancyErrorCode> {}

export class KnexTenancyConfigurationError extends KnexTenancyError {
  constructor(message: string) {
    super(message, "TENANCY_KNEX_CONFIGURATION");
  }
}

export class KnexPolicyValidationError extends KnexTenancyError {
  constructor() {
    super(
      "Call and check `await tenancy.validate()` at startup — the adapter refuses to run queries until the isolation contract (RLS policy / schema / config) is verified. Docs: https://tenancyjs.pages.dev/docs/concepts/security",
      "TENANCY_KNEX_POLICY_VALIDATION",
    );
  }
}

export class KnexUnregisteredTableError extends KnexTenancyError {
  readonly table: string;

  constructor(table: string) {
    super(
      `Table "${table}" isn't registered as a tenant table. Add it to \`tenantTables\` (or \`centralTables\` if it's shared across tenants) before querying through the scoped client.`,
      "TENANCY_KNEX_UNREGISTERED_TABLE",
    );
    this.table = table;
  }
}

export class KnexTenantFieldConflictError extends KnexTenancyError {
  readonly operation: string;
  readonly table: string;

  constructor(table: string, operation: string) {
    super(
      `${table}.${operation} set a tenant id that doesn't match the current tenant. Omit it (TenancyJS injects it for you) or use the active tenant's id — rows can't move between tenants.`,
      "TENANCY_KNEX_TENANT_FIELD_CONFLICT",
    );
    this.table = table;
    this.operation = operation;
  }
}

export class KnexUnsupportedOperationError extends KnexTenancyError {
  readonly operation: string;
  readonly table: string | undefined;

  constructor(operation: string, table?: string) {
    super(
      table === undefined
        ? `Operation "${operation}" isn't a supported scoped operation. Raw SQL, native handles, and complex or nested operations are rejected fail-closed because they can't be proven tenant-safe — use a supported operation, or a database-per-tenant scope's \`unrestricted()\`. Docs: https://tenancyjs.pages.dev/docs/concepts/limitations`
        : `${table}.${operation} isn't a supported scoped operation. Raw SQL, native handles, and complex or nested operations are rejected fail-closed because they can't be proven tenant-safe — use a supported operation, or a database-per-tenant scope's \`unrestricted()\`. Docs: https://tenancyjs.pages.dev/docs/concepts/limitations`,
      "TENANCY_KNEX_UNSUPPORTED_OPERATION",
    );
    this.operation = operation;
    this.table = table;
  }
}
