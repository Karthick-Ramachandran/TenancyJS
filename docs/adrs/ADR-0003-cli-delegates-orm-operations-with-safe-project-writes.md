# ADR-0003: CLI Delegates ORM Operations With Safe Project Writes

## Status

Accepted

## Context

The CLI must scaffold existing applications and run tenant operations across unlike migration tools.
Reimplementing each ORM creates semantic drift. Patching real projects introduces traversal, symlink,
overwrite, partial-write, executable injection, and secret-disclosure risks.

## Decision

The CLI owns stack analysis, a typed change plan, templates/structured transforms, diagnostics, tenant
iteration, and normalized results. It delegates schema/migration/seed work to locally installed Prisma,
Sequelize, Knex, and Lucid/Ace tooling through reviewed driver interfaces.

Every mutation supports dry-run, validates that real target paths remain inside the project, rejects
symlink escapes, detects precondition/conflict failures, and applies staged writes with rollback or a
clear recovery report. Existing files are not silently overwritten. Native tools are resolved locally
and spawned directly with argument arrays, never through a shell or remote package runner. Secrets are
passed through the child environment only when needed and redacted from all output.

## Alternatives Considered

- Implement a universal migration engine: cannot preserve ORM-native metadata and workflows.
- Shell command strings: compact but expose quoting, argument injection, and platform risks.
- Text append/overwrite templates: easy initially but non-idempotent and destructive in existing apps.
- Framework-owned duplicate CLIs: familiar entry points but divergent behavior; Ace commands should be
  thin wrappers over shared services instead.

## Consequences

Users retain native migration semantics while receiving one tenancy-oriented command model. Safe plans
make project changes reviewable and repeatable. Driver capability differences must be explicit, and
tests require fixture projects plus locally installed fake/real executables. Atomicity across file and
database operations is not possible, so commands need staged phases, idempotency, and recovery output.

## Related Documents

- PRD: `docs/00-product/PRD.md`
- Architecture: `docs/10-architecture/ARCHITECTURE.md`
- Security: `docs/20-security/SECURITY_MODEL.md`
- Feature: `docs/40-features/F-001-tenancyjs-platform/ARCHITECTURE_IMPACT.md`
