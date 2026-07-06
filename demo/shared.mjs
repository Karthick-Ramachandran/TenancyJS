// Shared wiring for the Express + Sequelize database-per-tenant demo.
// Each tenant lives in its own PostgreSQL database; TenancyJS leases the
// tenant's own connection per scope, so isolation is by construction.
import { DataTypes, Sequelize } from "sequelize";
import { TenancyManager } from "tenancyjs-core";
import { createSequelizeTenancy } from "tenancyjs-adapter-sequelize";

// A superuser/admin connection is used only to CREATE/DROP tenant databases
// (provisioning). Tenant queries never touch it.
export const ADMIN_URL =
  process.env.DATABASE_URL ??
  process.env.TEST_DATABASE_URL ??
  "postgres://postgres:postgres@localhost:5432/postgres";

// The two demo tenants. `database` is the per-tenant database name.
export const TENANTS = [
  { id: "acme", database: "tenancy_demo_acme" },
  { id: "globex", database: "tenancy_demo_globex" },
];

const MODEL_NAME = "Post";

export function urlFor(database) {
  const url = new URL(ADMIN_URL);
  url.pathname = `/${database}`;
  return url.toString();
}

// Every per-tenant Sequelize instance defines the SAME model name/table, so the
// adapter can re-bind the model onto the leased instance.
export function makeSequelize(url) {
  const sequelize = new Sequelize(url, {
    dialect: "postgres",
    logging: false,
    pool: { min: 0, max: 2 },
  });
  sequelize.define(
    MODEL_NAME,
    {
      id: { type: DataTypes.STRING, primaryKey: true },
      title: { type: DataTypes.STRING, allowNull: false },
    },
    { tableName: "posts", timestamps: false },
  );
  return sequelize;
}

/**
 * Build the manager + database-per-tenant adapter. Returns the model handle and
 * a `run(tenant, cb)` that enters the tenant scope and then the adapter scope.
 */
export function buildTenancy() {
  const manager = new TenancyManager();
  // The base instance is required by the adapter (central mode / dialect
  // checks) but tenant data always flows through the leased per-tenant one.
  const base = makeSequelize(ADMIN_URL);
  const post = base.models[MODEL_NAME];

  const tenancy = createSequelizeTenancy({
    manager,
    sequelize: base,
    strategy: "databasePerTenant",
    tenantModels: [{ model: post, table: "posts" }],
    connection: (tenant) => ({
      key: tenant.database,
      create: () => makeSequelize(urlFor(tenant.database)),
    }),
  });

  const run = (tenant, callback) =>
    manager.runWithTenant(tenant, () => tenancy.run(callback));

  return { manager, tenancy, base, post, run };
}
