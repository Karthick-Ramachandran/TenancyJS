# Module Decisions: Cli

Record durable module decisions here.

## Current Decisions

- ADR-0003 governs typed plans, safe writes, and argument-array local tool execution.
- Foundation supports only Express 5.2 + Prisma 7.8 row-level projects.
- `init` previews by default, writes only with `--apply`, and never overwrites.
- Doctor is deterministic static analysis; it reports evidence gaps and never claims runtime isolation.
- Leak testing requires an explicit contained JavaScript test file executed by Node; no remote fallback.
  The trusted file is not sandboxed, receives an allowlisted environment, and has time/output bounds.
