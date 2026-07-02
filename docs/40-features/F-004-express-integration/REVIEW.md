# Review: Express Integration

## Status

Planning review pending ADR-0008 acceptance. Implementation review has not started.

## Findings

- The lifecycle cannot end when Express `next()` returns because downstream async work continues.
- Response `finish` alone is insufficient; close, abort, and synchronous failure are terminal paths.
- The integration must reuse `TenancyManager` and `TenantResolutionOutcome`, not create request-global
  tenancy state or duplicate resolution semantics.
- Express 5.2.x is the initial evidence target; Express 4 remains unsupported until tested separately.
