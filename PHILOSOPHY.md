# Why I built TenancyJS

This is the honest version of _why_ this exists. The README tells you what it does. This tells you the
problem I kept hitting and the deliberate choices I made because of it.

## The problem I kept running into

Multi-tenancy is easy to get to a working shape and catastrophic to get subtly wrong. The dangerous
part isn't the code that throws - it's the code that _doesn't_. Forget a `WHERE tenant_id = ?` on one
query and nothing breaks in the demo. No error, no crash. You just quietly returned one customer's data
to another customer, and you find out from a support ticket, or you don't find out at all.

Every team rebuilds the same scaffolding - thread a tenant id through everything, hope no query forgets
it, bolt on row-level security later, cross your fingers around raw SQL and background jobs. The
guarantee you actually want ("this can never leak across tenants") lives in discipline and code review,
not in the system. And the tools that promise to solve it tend to want to _own_ your stack: a specific
ORM, a hosted control plane, a framework you have to adopt wholesale.

## What I wanted instead

I wanted the isolation guarantee to be a property of the system, not of my vigilance - and I wanted it
on top of the framework and ORM I already use, not instead of them.

So the core bet is **fail-closed**. Tenant identity rides the async execution scope, so I'm not
threading an id through every call. And if tenant-aware data access happens without a valid tenant
context, it **throws** - it never falls back to unscoped data. The safe default is "refuse," not
"return everything." A missing context is a loud error at the boundary, not a silent leak three hops
later.

> A forgotten `WHERE` clause should be a crash, not a data breach.

## The bet: honesty over faith

The second bet is that I don't get to _claim_ isolation - I have to _prove_ it. A capability in
TenancyJS only flips to "supported" after a real two-tenant adversarial test on a real database: tenant
A and tenant B with colliding ids, and a test that fails if A can ever see B's row. If I haven't run
that test for a given adapter and strategy, it isn't marked supported - and the CLI's `tenant check`
tells you so, to your face, instead of pretending. I would rather ship a smaller matrix I can stand
behind than a big one I'm hoping about. When Prisma's schema-per-tenant turned out not to route the way
the docs implied, the answer wasn't a clever hack - it was to mark it unsupported and write down why.

That honesty extends to the boundaries I refuse to own. TenancyJS doesn't run your database or host your
tenants. The registry is bring-your-own - your table, your API, your Prisma model - hardened at the
edge so a buggy store can't hand back the wrong tenant. The operational CLI orchestrates but never
invents ORM behaviour it hasn't tested: provisioning and migrations delegate to hooks you write around
your own migrator. And tenant identity is explicitly _not_ authorization - your app still owns auth.
TenancyJS owns exactly one thing, and tries to own it completely: that one tenant's data never becomes
another's.

## Why it's a toolkit, not a framework

I kept it as small, composable packages on purpose. A framework-neutral core, adapters that enforce
isolation _inside_ the ORM you chose, thin integrations that bind context to the request lifecycle. You
install the three or four pieces your stack needs and nothing else. If you outgrow a piece, you can see
exactly where the boundary is. The goal was never to be the center of your architecture - it was to be
the part you stop worrying about.
