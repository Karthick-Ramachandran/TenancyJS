# Security Policy

TenancyJS is a fail-closed multi-tenancy toolkit for Node.js. Isolation is the
product, so this policy is specific about what the library guarantees, what it
does not, and how to report a break.

## Reporting a vulnerability

Report privately through GitHub. On
[Karthick-Ramachandran/TenancyJS](https://github.com/Karthick-Ramachandran/TenancyJS),
open the **Security** tab -> **Advisories** -> **Report a vulnerability**
(GitHub private vulnerability reporting).

Do **not** open a public issue or pull request for a suspected vulnerability.

Please include:

- Affected package and version (e.g. `tenancyjs-core@0.1.3`).
- The placement / strategy in use (Postgres row-level, database-per-tenant,
  MySQL row-level, MongoDB/Mongoose, Prisma row-level, etc.).
- A minimal reproduction: the smallest code and schema that shows the leak or
  fail-open.

We aim to acknowledge a report within **3 business days**. Confirmed fixes ship
as a patch release on the current line with a coordinated disclosure, and we
credit the reporter unless anonymity is preferred.

## Supported versions

| Version        | Supported | Notes                                         |
| -------------- | --------- | --------------------------------------------- |
| 0.1.x (latest) | Yes       | Security fixes land on the latest 0.1.x patch |
| Older 0.1.x    | No        | Upgrade to the latest 0.1.x                   |
| Pre-release    | No        | Upgrade to the latest 0.1.x                   |

The library is pre-1.0. The public API may change between minor versions before
1.0; security fixes are only guaranteed on the latest 0.1.x.

## What counts as a vulnerability

In scope, where the library was used as documented (a supported operation on a
supported placement):

- A cross-tenant data leak: one tenant reading, writing, or otherwise observing
  another tenant's rows, documents, or connection.
- An isolation bypass through the scoped client's own intercept / transform path.
- A fail-**open**: a secured operation that executed and leaked instead of
  throwing before execution.

## What does not count

These are documented, fail-closed-by-design behaviors, not bugs. Each has a safe
alternative.

- **Using an ORM's base or unwrapped client instead of the tenancy-scoped
  client.** The base client is not tenant-aware; unscoped tenant access throws
  by design. Use the scoped client returned by TenancyJS. See
  `docs/20-security/SECURITY_MODEL.md`.
- **Disabling or not forcing Postgres RLS.** The RLS backstop requires `ENABLE`
  - `FORCE ROW LEVEL SECURITY`, a non-owner / non-superuser / non-BYPASSRLS
    runtime role, and a `<table>_tenant_isolation` policy whose `USING` and
    `WITH CHECK` read `tenancyjs.tenant_id` and `tenancyjs.is_central`. Keep the
    startup validation enabled. See `docs/20-security/SECURITY_MODEL.md`.
- **Running raw SQL or native driver handles through the scoped client.** These
  cannot be reliably intercepted, transformed, and proven, so they are rejected
  fail-closed. Model the operation through the supported API. See
  `docs/20-security/ADAPTER_SECURITY_CONTRACT.md`.
- **Relying on a facade-only placement against documented guidance.** MySQL
  row-level is experimental / facade-only, MongoDB/Mongoose is facade-only, and
  Prisma row-level is facade-only in its extension path (no DB backstop); an
  RLS-backed path (`createPrismaRowLevelTenancy`) exists for a database backstop.
  For a database backstop use Postgres row-level, the Prisma RLS-backed path, or
  database-per-tenant. See
  [`/docs/concepts/capability-matrix`](https://tenancyjs.pages.dev/docs/concepts/capability-matrix)
  and [`/docs/concepts/limitations`](https://tenancyjs.pages.dev/docs/concepts/limitations).
- **Resolving a tenant from a spoofable header** (e.g. `x-tenant-id`) without
  the required authorization decision or trusted transport. Per ADR-0035,
  resolution requires an explicit membership authorization decision or a trusted
  transport, so a spoofed header cannot reach another tenant. Wire in the
  membership check. See `docs/20-security/SECURITY_MODEL.md`.

## Security model

TenancyJS is fail-closed: unscoped tenant access throws, and any operation that
cannot be reliably intercepted, transformed, and proven through conformance
tests is rejected before it runs. As the product boundary rule states, "If an
operation cannot be reliably intercepted, transformed, and proven through
conformance tests, the secured client must fail before execution." On Postgres
row-level, a forced-RLS backstop (validated at startup) enforces isolation in
the database even if the application tier is bypassed; database-per-tenant
isolates by connection. Prisma row-level also has an RLS-backed path
(`createPrismaRowLevelTenancy`) with the same PostgreSQL backstop. Other
placements are enforced at the facade tier only and are documented as such
(MySQL row-level experimental, MongoDB facade-only, and the Prisma row-level
extension path facade-only), so they carry no database backstop.

Full detail: `docs/20-security/SECURITY_MODEL.md`,
`docs/20-security/ADAPTER_SECURITY_CONTRACT.md`, and the docs site pages
[`/docs/concepts/security`](https://tenancyjs.pages.dev/docs/concepts/security),
[`/docs/concepts/capability-matrix`](https://tenancyjs.pages.dev/docs/concepts/capability-matrix),
and [`/docs/concepts/limitations`](https://tenancyjs.pages.dev/docs/concepts/limitations).
