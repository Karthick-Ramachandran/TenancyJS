import process from "node:process";

const SCHEMA = "knex_example";
const RUNTIME_ROLE = process.env.TENANCY_RUNTIME_ROLE;

export async function up(knex) {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(RUNTIME_ROLE ?? "")) {
    throw new Error("TENANCY_RUNTIME_ROLE must be a PostgreSQL identifier.");
  }

  await knex.schema.createSchemaIfNotExists(SCHEMA);
  await knex.schema.withSchema(SCHEMA).createTable("tenants", (table) => {
    table.string("id").primary();
    table.string("name").notNullable();
  });
  await knex.schema.withSchema(SCHEMA).createTable("posts", (table) => {
    table.uuid("id").primary().defaultTo(knex.fn.uuid());
    table.string("tenant_id").notNullable().index();
    table.string("title").notNullable();
  });
  await knex.raw(`alter table ${SCHEMA}.posts enable row level security`);
  await knex.raw(`alter table ${SCHEMA}.posts force row level security`);
  await knex.raw(`
    create policy posts_tenant_isolation on ${SCHEMA}.posts
    using (
      current_setting('tenancyjs.is_central', true) = 'true'
      or tenant_id = nullif(current_setting('tenancyjs.tenant_id', true), '')
    )
    with check (
      current_setting('tenancyjs.is_central', true) = 'true'
      or tenant_id = nullif(current_setting('tenancyjs.tenant_id', true), '')
    )
  `);
  await knex.raw(`grant usage on schema ${SCHEMA} to ${RUNTIME_ROLE}`);
  await knex.raw(
    `grant select, insert, update, delete on ${SCHEMA}.posts, ${SCHEMA}.tenants to ${RUNTIME_ROLE}`,
  );
}

export async function down(knex) {
  await knex.schema.dropSchemaIfExists(SCHEMA, true);
}
