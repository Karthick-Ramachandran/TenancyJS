# Test Plan: Tenancyjs Platform

## Unit Tests

- Async context isolation across `Promise.all`, timers, nested tenant scopes, central scopes, throws,
  rejected promises, and bootstrapper setup/revert failures.
- Resolver normalization, precedence, ambiguity, suspension, and typed failure behavior.
- Adapter query transformation per operation and capability flag.
- Integration lifecycle state machines independent of concrete HTTP servers.
- CLI detection, plan generation, redaction, path validation, merge preconditions, and result schemas.

## Integration Tests

- Run the shared adapter contract against real PostgreSQL for Prisma, Sequelize, Knex, and Lucid.
- Run framework harnesses for Express, Next.js production server, NestJS, and AdonisJS.
- Generate projects from clean and existing fixtures, apply twice, build/typecheck/test them, and
  compare reviewed golden outputs.
- Exercise locally installed ORM migration commands with disposable databases and fake delegates for
  failure/cancellation edge cases.
- Test each advertised vertical slice in a clean package-consumer fixture, not only the monorepo.

## Security Tests

- Two-tenant negative tests for read, update, delete, count, aggregate, bulk, nested write, relation,
  transaction, and supported raw-access boundaries.
- Missing, malformed, forged, unknown, suspended, and ambiguous tenant resolution.
- Context cleanup after handler, adapter, bootstrapper, and native-command failures.
- Central-context and unsafe-bypass APIs cannot be activated from request values.
- CLI traversal, absolute-path escape, symlink escape, overwrite conflict, partial write, executable
  substitution, argument injection, secret redaction, and hostile project metadata.

## Contract And Compatibility Matrix

| Suite | Express | Next.js | NestJS | AdonisJS |
|---|---:|---:|---:|---:|
| Core lifecycle contract | shared | shared | shared | shared |
| Framework lifecycle contract | required | required | required | required |
| Prisma E2E | v0.1 | v0.2 | v0.4 | experimental |
| Sequelize E2E | post-v0.4 evidence | experimental | v0.4 | experimental |
| Knex E2E | v0.3 | experimental | experimental | internal support path |
| Lucid E2E | unsupported | unsupported | unsupported | v0.3 |

Cells are targets, not current support. The published table must be generated or audited against CI
evidence so a theoretically composable pair is never mislabeled stable.

## Non-Functional Tests

- Benchmark context lookup and middleware overhead without setting a pass threshold until baseline data
  exists; prevent statistically significant regressions after baselines are accepted.
- Verify package exports and types under supported Node/TypeScript versions.
- Verify ESM consumer behavior, package tarball contents, and CLI startup/exit behavior.

## Release Gates

For every stable package or slice: lint, typecheck, unit tests, relevant conformance suite, real-database
integration, example E2E, package-consumer test, docs snippet test, security review, and `persist doctor`.
Skipped lanes or unsupported operations must be explicit in release evidence.
