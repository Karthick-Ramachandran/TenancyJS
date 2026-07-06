# ADR-0035: First Class Tenant Membership Authorization Hook

## Status

Accepted

## Context

Tenant resolution establishes tenant *identity* from transport the client controls (a header such as
`x-tenant-id`, or the host) and validates only that the tenant **exists and is active** —
`TenantStore.find(identifier)` receives the identifier and nothing else. It never sees the
authenticated principal, so there is structurally no place to check that *this user may act as this
tenant*.

Consequence: in an authenticated app wired with `HeaderTenantResolver`, any logged-in user can send
`x-tenant-id: <victim>` and every subsequent query is scoped to the victim tenant — a full cross-tenant
read/write. Forced RLS does **not** help: it constrains queries to the *current* tenant, and the current
tenant is whatever was resolved from the spoofed header. This holds for row-level, schema-per-tenant,
and database-per-tenant alike — the isolation strategy defends against code bugs, never against a forged
identity. Today the library neither requires nor guides the membership check, and the docs demonstrate
the insecure default. For a fail-closed security toolkit that is the wrong default.

## Decision

Make membership authorization a **first-class, must-decide** step in resolution, so the secure path is
the default and skipping it is an explicit, reviewed choice.

- **Principal in the resolution context.** The resolve call accepts an app-supplied `principal`
  (opaque to the library — typically the authenticated user + their memberships). Integrations extract
  it (e.g. Express `principal: (req) => req.user`) and run after the app's authentication.
- **`authorize` hook.** `TenantResolutionChain` gains
  `authorize(ctx: { tenant, identifier, principal }): boolean | Promise<boolean>`. After a tenant
  resolves (exists + active), the chain calls it; `false`/throw → a new fail-closed outcome
  `{ status: "forbidden" }`.
- **Hard to skip.** Constructing a chain with neither `authorize` nor an explicit
  `trustResolution: true` (the escape hatch for trusted service-to-service callers) throws a config
  error at construction. Every deployment must decide.
- **The insecure shape is unconstructable.** `trustResolution` cannot be combined with a *spoofable*
  resolver — one that reads client-controllable transport (a header/host). Trusting a value the client
  set is the hole itself, so a spoofable resolver must go through `authorize`. Built-in transport
  resolvers (`HeaderTenantResolver`, `HostTenantResolver`, `SubdomainTenantResolver`) declare
  `spoofable: true`; a resolver with no marker is treated as spoofable (fail closed). To assert a
  deployment secures a transport (a gateway that strips inbound client headers, service-to-service),
  wrap it in `trustedTransport(resolver)` — an explicit, named acknowledgment. So the only ways to skip
  a membership check are a resolver you deliberately marked trusted, or a custom resolver reading a
  verified claim.
- **No enumeration leak.** `forbidden` maps to the **same sanitized 404** as unknown/suspended tenants,
  so an attacker cannot distinguish "tenant doesn't exist" from "you're not a member." The distinct
  outcome status is kept internally for logging.

## Alternatives Considered

- **Docs-only warning.** Rejected: the footgun remains; a security tool should not rely on readers
  noticing a caveat at the wiring site.
- **Optional `authorize`, default allow + a runtime warning.** Rejected: still skippable silently; does
  not change the default.
- **Thread the principal into `store.find` and let it return `[]`.** Viable but conflates identity
  lookup with authorization; the explicit `authorize` hook keeps the two concerns separate and legible.

## Consequences

- **Breaking API** (constructing a chain now requires `authorize` or `trustResolution`). Acceptable in
  beta, and the break is the point: existing insecure wirings fail loudly at startup instead of leaking
  at runtime.
- Integrations (Express, Next.js, NestJS, AdonisJS) gain principal extraction and map `forbidden` to the
  sanitized 404. The Nest guard path can authorize before the scope opens.
- Docs: the resolving-tenants guide and setup-agent prompts show the authorize step as the default; the
  `x-tenant-id`-only wiring is reframed as trusted-caller-only.

## Related Documents

- PRD: docs/40-features/F-016-tenant-membership-authorization/PRD.md
- Architecture: docs/10-architecture/ARCHITECTURE.md
- Security: docs/20-security/SECURITY_MODEL.md
- Feature: docs/40-features/F-016-tenant-membership-authorization
