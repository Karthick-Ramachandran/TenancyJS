# Acceptance Criteria: Policy Apply

## Criteria

- `defineTenancyRuntime({ admin })` accepts a `{ query(sql) }` connection and rejects a non-connection.
- `tenancy policy --apply --table t --role r` runs the exact SQL `tenancy policy` prints through
  `runtime.admin.query`, and reports the applied table count + role.
- With no `admin` on the runtime, `--apply` fails closed with a clear "needs a privileged admin
  connection" message.
- Invalid `--table`/`--role`/`--tenant-column` throw before the runtime is loaded (no DB access).
- Verified against real PostgreSQL: applying the generated DDL enables + forces RLS and creates the
  `<table>_tenant_isolation` policy, idempotently.
- The parser allows `--apply` (and `--config`) for `policy`; `--apply` stays rejected on other
  non-init commands.

## Out Of Scope

- Role creation; policy hashing/versioning; a CLI Postgres dependency.
