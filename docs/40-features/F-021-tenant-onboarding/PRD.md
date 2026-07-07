# PRD: Tenant Onboarding

## Purpose

After the provisioners (F-018), the last lifecycle friction is the signup path: a host still hand-writes
"record the tenant, then provision it, then migrate it" and the rollback if a step fails. Provide a
one-call `onboardTenant(runtime, input)` so a signup handler is a single line and a failed onboarding
never leaves a half-created tenant (friction-reduction-roadmap #4).

## In Scope

- `onboardTenant(runtime, input)` in `tenancyjs-core`: `store.create` → `provisioner.provision` →
  `provisioner.migrate`, returning the created tenant. Steps whose runtime hook is absent are skipped
  (row-level has no provisioner).
- Best-effort rollback (deprovision + store.delete) on a provision/migrate failure, then rethrow the
  original error. Throws when the runtime has no store.

## Non-Goals

- Auth/signup itself, email, billing — the host calls `onboardTenant` from its own handler.
- Transactional atomicity across store + DDL (no distributed transaction) — rollback is best-effort.
- Runtime provisioning of a database engine — that is the provisioner's (F-018) job.
