# Module Delivery Workflow

Use this workflow when a change creates a new responsibility boundary or materially changes an
existing module. Small fixes inside an established boundary need focused tests and an accurate task
entry, not new planning ceremony.

## Start

1. Read the product PRD, architecture, security model, engineering standards, conventions, and lessons.
2. For a new module, run `persist module create <name>` and link it to the owning feature.
3. Confirm the feature PRD/acceptance and accepted ADRs define the behavior and security boundary.
4. Do not overwrite an accepted ADR. A changed decision requires human confirmation and
   `persist adr supersede`.

## Required Module Memory

- `MODULE.md`: purpose, ownership, non-responsibilities, public interfaces, and dependency boundaries.
- `DECISIONS.md`: durable module decisions and authoritative ADR links.
- `TEST_PLAN.md`: unit, integration, adversarial/security, and release evidence expected for the module.
- `TASKS.md`: current work and evidence-backed status; distinguish local completion from hosted or
  published-package evidence.

Keep these files concise. Link feature documents instead of copying their full requirements.

## Implement

1. Reuse the canonical primitives in `docs/60-engineering/CONVENTIONS.md`.
2. Keep dependency direction consistent with `docs/10-architecture/ARCHITECTURE.md`.
3. Add risk-based tests before promoting a capability. Isolation capabilities require the real
   two-tenant adversarial evidence defined by the feature test plan.
4. Record non-obvious failures or tempting unsafe approaches in `LESSONS.md`.
5. Update package and website guides when public behavior changes; examples must use the actual public
   API and state the enforcement tier honestly.

## Review And Finish

1. Review architecture drift, conventions reuse, security boundaries, and dependency changes.
2. Update the feature `REVIEW.md` and `COMPLETION_REPORT.md` with concrete commands and results.
3. Mark tasks complete only when their acceptance evidence exists. Keep hosted CI and published npm
   consumption explicit when they cannot be proven locally.
4. Run the relevant focused tests, the full quality gate, dependency audit, packed-consumer check, docs
   production build when docs changed, and `persist doctor`.
5. Never claim completion while Doctor reports an error or a required environment lane was skipped.
