# ADR-0034: Dual ESM And CJS Package Builds

## Status

Accepted

## Context

Every `tenancyjs-*` package shipped ESM-only (`"type": "module"`, `exports` with only
`import`/`types`). A real consumer running the NestJS + Prisma setup-agent prompt hit the predictable
wall: a default `nest new` project is CommonJS (ts-node + Jest via ts-jest), and it cannot `require()`
an ESM-only package, so the app would not start and Jest would not run until the whole project was
converted to ESM. CommonJS is still the default for a large part of the Node ecosystem (NestJS,
many existing services), so ESM-only makes adoption unnecessarily hard right before a stable release.

Crucially, feasibility is unblocked: every package's runtime dependencies are **only other
`tenancyjs-*` packages** plus consumer-provided peer deps — there are no external ESM-only runtime
dependencies that would prevent a CommonJS build.

## Decision

Ship a **dual ESM + CommonJS build** for all published library packages. `tsc -b` remains the single
source of truth for type-checking and `.d.ts` and continues to emit ESM to `dist/`. A new
`scripts/build-cjs.mjs` step runs after it and uses **esbuild** to transpile the same source to
CommonJS in `dist/cjs/`, with every bare import left external (a runtime `require(...)`) so each
package resolves its workspace and peer deps through their own `exports` maps. A
`dist/cjs/package.json` (`{"type":"commonjs"}`) marks that directory as CommonJS. Each package's
`exports` gains a `require` condition (for `.` and every subpath), `main` points at the CJS entry, and
`module` at the ESM entry.

The **CLI (`tenancyjs-cli`) stays ESM-only**: it is a `bin` executed directly by Node (its entry uses
top-level await, which CommonJS cannot express) and no consumer `require()`s it.

## Alternatives Considered

- **`tsc` twice (ESM + a CommonJS tsconfig).** Rejected: the source uses `.js` import specifiers, which
  a `module: commonjs` + classic (`node10`) resolution pass cannot resolve, and `NodeNext` ties the
  emitted format to the package's `"type"`, so `tsc` cannot cleanly produce CommonJS from this source.
- **Migrate the whole build to tsup/unbuild.** Rejected for now: replacing the working `tsc -b`
  project-reference build across 16 packages is higher risk than adding a focused CJS emit step.
- **Stay ESM-only and document the ESM conversion.** Rejected: it pushes real, repeated friction onto
  every CommonJS consumer for the life of the library.

## Consequences

- CommonJS consumers (default NestJS, older toolchains) can `require()` TenancyJS with **no ESM
  conversion**. Verified end-to-end: a `type`-less CommonJS project installs the packed tarballs and
  `require()`s core, identifiers, the Nest integration (internal deps), the adapters, and the
  `/edge` + `/provider` subpaths, then runs a scoped callback and observes fail-closed behavior.
- Package tarballs grow by a `dist/cjs/` tree; `files` now also includes `dist/**/package.json` so the
  CommonJS marker ships.
- esbuild becomes a build-time devDependency. Runtime stays dependency-light; the CLI stays zero-dep.
- Types are shared across both conditions (one `.d.ts`). If a future divergence needs `.d.cts`, revisit.

## Related Documents

- PRD:
- Architecture: docs/10-architecture/ARCHITECTURE.md
- Security:
- Feature:
