---
"@tenancyjs/cli": minor
---

`tenancy init` now detects AdonisJS 7.3 + Lucid 22.4 projects and scaffolds `config/tenancy.ts` and
`app/middleware/tenant_middleware.ts` alongside the existing Express + Prisma templates, using the same
preview-first, conflict-aware, non-overwriting change plan.
