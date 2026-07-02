# Plan: Safe Cli Foundation

## Approach

1. Finalize F-005/module scope under accepted ADR-0003.
2. Implement metadata detection, typed plans, fixed templates, and safe staged application.
3. Implement Doctor inventory/redaction and local leak-test delegation.
4. Add unit, fixture, binary, malicious-path, rollback, package, and documentation evidence.
5. Run security/architecture/conventions review and the complete repository gate.

## Boundaries

- Reference slice only: Express 5.2 + Prisma 7.8 + row-level tenancy.
- Default is read-only preview; mutation requires `--apply`.
- Never read `.env`, execute project config/source, overwrite, follow symlinks, invoke a shell, or use a
  remote package runner.
- Static findings estimate migration work; they do not prove runtime isolation.
- Implementation tasks are selected in order under ADR-0003.
