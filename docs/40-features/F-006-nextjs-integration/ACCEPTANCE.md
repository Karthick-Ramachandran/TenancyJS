# Acceptance Criteria: Nextjs Integration

## Criteria

- AC-NEXT-REF-01: Route Handlers and Server Actions resolve only in Node and expose the correct tenant
  through the canonical manager across concurrent invocations and failures.
- AC-NEXT-REF-02: Missing, invalid, unknown, suspended, ambiguous, and forged hints fail before tenant
  code and never select central context.
- AC-NEXT-REF-03: Edge middleware performs no registry/database/context work; hints remain untrusted
  until Node resolver/store validation.
- AC-NEXT-REF-04: Wrapper cleanup follows handler/action promise settlement; streamed-body tenant data
  access is explicitly unsupported.
- AC-NEXT-REF-05: Cache documentation/tests prevent shared cross-tenant reuse and require tenant-aware
  keys or no-store behavior.
- AC-NEXT-REF-06: Production build/start E2E proves Next + Prisma/PostgreSQL two-tenant isolation on
  Node 22/24 with clean package-consumer evidence.

## Out Of Scope

- Pages Router, Edge ORM access, signed identity issuance, and other adapters.
