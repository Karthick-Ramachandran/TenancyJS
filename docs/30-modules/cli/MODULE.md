# Module: Cli

## Purpose

Provide safe, deterministic project analysis, initialization plans, diagnostics, and explicit local
leak-test execution without replacing framework or ORM tooling.

## Owns

- `tenancy` binary parsing/output/exit codes; project detection; typed change plans; fixed templates;
  safe preview/apply; Doctor static inventory/redaction; local leak-test process delegation.

## Does Not Own

- Runtime tenancy, ORM isolation, authentication, registry, migrations/seeds, database connectivity,
  remote packages, network diagnostics, or interactive UI in the foundation.

## Public Interfaces

- `detectProject`, `createInitPlan`, `applyChangePlan`, `runDoctor`, `runLeakTest`, and `runCli`.
- Typed detection/plan/result/finding/output contracts.

## Boundaries

- Node built-ins only at runtime. Fixed dependency flow is CLI -> project files/public package names.
- ADR-0003 and file-write/security policy govern every read, write, and process action.
- Initial compatibility is Express 5.2 + Prisma 7.8 row-level only.
- The explicit leak-test file is trusted, not sandboxed; environment, time, output, path, and process
  invocation are constrained by the CLI.
