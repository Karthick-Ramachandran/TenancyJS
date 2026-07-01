# Contributing to TenancyJS

TenancyJS treats tenant isolation as a security boundary. Contributions are welcome, but a package or
compatibility claim is not complete until its tests and repository memory agree with the code.

## Before you start

1. Read `AGENTS.md` and the required repository memory it names.
2. Find the relevant feature task and module ownership under `docs/`.
3. Open an issue before changing a public API, dependency, isolation behavior, or package boundary.
4. Record architecture decisions with Persist OS rather than leaving rationale only in a discussion.

## Local setup

```bash
corepack enable
pnpm install
pnpm check
```

Supported CI runtimes are Node.js 22 and 24 LTS. Use the pinned pnpm version from `package.json`.

## Pull requests

- Keep one implementation task per pull request.
- Add tests derived from acceptance criteria and isolation risks.
- Update feature/module memory when behavior, boundaries, or risks change.
- Add a changeset for published behavior; omit it for documentation and repository-only changes.
- Report every skipped check and remaining risk.
- Never claim a framework/adapter combination stable without its conformance and E2E lane.

Run before review:

```bash
pnpm check
```

## Commit and release policy

Use clear imperative commit subjects. Maintainers use Changesets to version packages and publish
release notes. Breaking public API changes require an accepted ADR or an accepted superseding ADR.

## Security

Do not include real tenant data, credentials, connection URLs, or `.env` contents in tests, issues, or
logs. Report vulnerabilities privately through the process in `SECURITY.md`.
