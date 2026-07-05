# Examples

The runnable example apps do **not** live in this repository.

They will be published as a **separate GitHub repository** once the `tenancyjs-*`
packages are live on npm. The examples must install TenancyJS the way a real adopter
does — from the published npm packages — not through in-repo `workspace:*` links, which
only exercise local source and cannot prove "install it and it works."

> **Status: empty for now.** Nothing is linked yet because nothing is published yet.
> This page will carry the link and per-example status once the examples repo exists.

## What the examples will cover

| Example          | Stack                                     | Expected to work                                 |
| ---------------- | ----------------------------------------- | ------------------------------------------------ |
| `adonis-lucid`   | AdonisJS 7 + Lucid, PostgreSQL RLS        | Yes — the integration is the most complete slice |
| `next-prisma`    | Next.js (App Router) + Prisma, PostgreSQL | Yes                                              |
| `express-prisma` | Express + Prisma, PostgreSQL / MySQL      | Yes                                              |
| `knex-postgres`  | Knex, PostgreSQL RLS                      | Reference runtime                                |

## What will not work (yet)

- Databases other than **PostgreSQL** and **MySQL** (MongoDB is a non-goal).
- Non-Prisma ORMs on MySQL — Knex and Lucid are PostgreSQL-RLS-only by design.
- Operational CLI commands (list / migrate / seed / provision) — roadmapped, not shipped.

Until the separate repo is published, this repository ships only the libraries under
`packages/*` and their tests.
