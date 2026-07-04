# ADR-0015: Examples Live In A Separate Repository

## Status

Accepted

## Context

The runnable example apps (AdonisJS/Lucid, Next.js/Prisma, Express/Prisma, Knex/PostgreSQL) were
committed inside this monorepo under `examples/*` and wired into the gate as workspace packages. That
arrangement has a structural flaw: the examples depend on the libraries via `workspace:*`, so they
exercise local source, not the packages an adopter actually installs from npm. They therefore cannot
substantiate the core promise — "install `@tenancyjs/*` from npm and it works." They also drag their own
toolchains (Next/Turbopack, the AdonisJS starter kit, Prisma generators) into the monorepo gate, and the
examples are not publishable until the packages are on npm anyway.

## Decision

The runnable examples do not live in this repository. They move to a **separate GitHub repository**,
published after the `@tenancyjs/*` packages are live on npm, where each example installs the **published**
packages the way a real adopter does and is tested E2E against them.

This repository keeps only `packages/*` and their tests. `examples/` retains a single placeholder
`examples/README.md` that states the examples move to a separate repo, what will and will not work, and
that it is empty until publication. The monorepo gate no longer builds or runs any example (removed from
`pnpm-workspace.yaml`, `tsconfig.json` references, `tsconfig.test.json`/`vitest` includes,
`tests/workspace.test.ts`, and the `fixtures:generate` / `examples:build` / `test:run` scripts).

The current example source is preserved outside the repo in the maintainer's local working area (the
seed of the separate repo) so nothing is lost in the interim.

## Alternatives Considered

- **Keep examples in-repo with `workspace:*`.** Rejected: never a true consumer test; couples unrelated
  toolchains to the monorepo gate.
- **Keep examples in-repo but install the published packages there.** Rejected: creates a
  chicken-and-egg with publication and still bloats this repo's toolchain and gate.
- **Delete the examples outright.** Rejected: the E2E examples are real compatibility evidence
  (see LESSONS — the real apps caught genuine integration bugs); they are preserved and relocated, not
  discarded.

## Consequences

- Improves: this repository is libraries-only; the gate is faster and free of framework/ORM toolchains;
  the "install from npm" claim will be backed by an honest consumer test once the separate repo ships.
- Worsens/risks: until the separate repo is published and linked, there is no in-repo example E2E signal;
  the examples must be re-validated against the published packages before they can be trusted or linked.
- Follow-up: publish npm → stand up the separate examples repo from the preserved source, tested against
  the published packages → link it from `examples/README.md`.

## Related Documents

- PRD: docs/00-product/PRD.md
- Architecture: docs/10-architecture/ARCHITECTURE.md
- Security:
- Feature:
