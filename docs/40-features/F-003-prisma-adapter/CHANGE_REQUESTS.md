# Change Requests: Prisma Adapter

## CR-001: Make The Supported Security Boundary The Product Contract

Status: Accepted by the human owner on 2026-07-02.

### Requirements

- Lead with guarantees for explicitly supported ORM operations, not a list of missing features.
- State that isolation is guaranteed only inside the documented operation matrix and secured client.
- Reject anything that cannot be reliably intercepted and enforced; explain why raw SQL cannot be
  generically scoped.
- Keep the safe path identical to native ORM APIs and make rejection errors educational.
- Validate static configuration at startup; resolve the tenant once per request into core context and
  perform no tenant-registry/database lookup per query.
- Publish an Adapter Security Contract, per-adapter operation matrix, unsupported-pattern migration
  guide, and repeatable runtime-overhead benchmark.
- Position v1 primarily for greenfield adoption with an incremental path for existing applications.
- Expand support only with reliable enforcement and conformance evidence; never use best effort.
- Specify future `tenancy doctor` detection for unsupported patterns and migration estimation.

### Delivery Impact

- T-04 adds the shared security contract, Prisma migration guide, educational errors, startup-validation
  guidance, benchmark harness, and evidence.
- T-06 owns `tenancy doctor` code/pattern analysis. T-04 records its required diagnostic surface but
  does not add CLI behavior to the adapter package.
- ADR-0007 remains unchanged because CR-001 clarifies and strengthens its accepted fail-closed boundary;
  it does not change package direction, supported operations, or bypass semantics.
