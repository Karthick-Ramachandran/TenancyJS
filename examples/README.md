# Examples

The runnable example apps live in a **separate repository**, not here — each one installs TenancyJS
from the published npm packages (not workspace source), so it doubles as proof the library works as a
real consumer would use it.

Every example runs a two-tenant adversarial isolation test: both tenants write the same primary key,
each reads back only its own row, and unscoped access **throws** (fail-closed). The RLS examples also
assert the database policy itself denies access with no tenant context set.

| Example          | Stack                            | Isolation  |
| ---------------- | -------------------------------- | ---------- |
| `express-prisma` | Express 5 + Prisma 7             | facade     |
| `nextjs-prisma`  | Next.js 16 App Router + Prisma 7 | facade     |
| `nestjs-typeorm` | NestJS 11 + TypeORM              | forced RLS |
| `adonis-lucid`   | AdonisJS 7 + Lucid               | forced RLS |

This page will carry the public link once the examples repository is pushed.
