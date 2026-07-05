# Plan: Prisma Adapter

## Approach

1. Accept ADR-0007 and finalize the generic adapter capability/validation types.
2. Implement pure configuration and operation-policy functions before coupling them to Prisma.
3. Expose a shareable `$allModels.$allOperations` query extension that delegates each supported query
   exactly once after applying the policy.
4. Add the runner-neutral row-level adapter contract to `tenancyjs-testing`.
5. Generate a dedicated Prisma integration client and run the contract against disposable PostgreSQL.
6. Add package/consumer verification, documentation, Changeset, security review, and completion evidence.

## Delivery Order

- P1: Planning and ADR proposal — current.
- P2: Generic adapter contract and Prisma configuration/error primitives.
- P3: Supported operation transformations and extension factory.
- P4: Shared conformance contract and unit/security tests.
- P5: Real PostgreSQL integration, transaction tests, package verification, and documentation.
- P6: Architecture, conventions, and security review; quality gates and completion report.

## Boundaries

- Fail closed for an operation the adapter cannot classify or safely transform.
- Never mutate or hide the original Prisma client; applications must expose only the returned extended
  client to tenant-aware code.
- Do not use a process-global tenant, call a client-level method from extension query callbacks, or
  create a new connection that could escape an active transaction.
- Do not claim nested relation or raw-query isolation. Reject those paths on the extended client.
- Do not add database-per-tenant behavior, migrations, framework middleware, schema rewriting, or RLS.
- Do not mark the package stable until real PostgreSQL and consumer-package evidence pass.

ADR-0007 is accepted and P2 is selected for implementation.
