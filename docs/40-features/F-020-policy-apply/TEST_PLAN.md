# Test Plan: Policy Apply

## Unit Tests

`packages/cli/test/policy-apply.test.ts` (branded config fixtures):

- Applies the generated DDL through the runtime admin connection (fixture records the SQL); asserts it
  contains the CREATE POLICY / FORCE RLS / GRANT for the requested tables + role.
- Fails closed when the runtime exposes no admin connection.
- Rejects empty `--table` and non-identifier `--role` before loading the runtime.

`packages/core/test/runtime.test.ts`:

- `defineTenancyRuntime` rejects a non-connection `admin` and keeps a valid one.

## Integration Tests

`packages/cli/test/policy-apply-postgresql.integration.test.ts` (real PostgreSQL):

- Executing `generatePolicySql` output enables + forces RLS and creates the reviewed policy in the
  catalog, idempotently (re-apply is a no-op).

## Security Tests

- Fail closed without an admin connection; identifiers validated before any DB access; `--apply` does
  not create the runtime role; DDL runs only through the host-provided privileged admin connection.
