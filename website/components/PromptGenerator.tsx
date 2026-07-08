"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";

/* ── Data ────────────────────────────────────────────────────────────────── */

interface Opt { id: string; name: string }

const FRAMEWORKS: Opt[] = [
  { id: "express", name: "Express" },
  { id: "nextjs", name: "Next.js (App Router)" },
  { id: "nestjs", name: "NestJS" },
  { id: "adonisjs", name: "AdonisJS" },
  { id: "any", name: "Other / Any" },
];

const ORMS: Opt[] = [
  { id: "prisma", name: "Prisma" },
  { id: "drizzle", name: "Drizzle" },
  { id: "knex", name: "Knex" },
  { id: "typeorm", name: "TypeORM" },
  { id: "sequelize", name: "Sequelize" },
  { id: "lucid", name: "Lucid" },
  { id: "mongoose", name: "Mongoose" },
];

const DATABASES: Opt[] = [
  { id: "postgres", name: "PostgreSQL" },
  { id: "mysql", name: "MySQL" },
  { id: "mongodb", name: "MongoDB" },
];

const STRATEGIES: Opt[] = [
  { id: "rowLevel", name: "Row-level (single database)" },
  { id: "schemaPerTenant", name: "Schema per tenant" },
  { id: "databasePerTenant", name: "Database per tenant" },
];

interface Guides {
  testing: boolean;
  cli: boolean;
  jobs: boolean;
  resolution: boolean;
  lifecycle: boolean;
}

const GUIDE_LABELS: { key: keyof Guides; label: string }[] = [
  { key: "testing", label: "Conformance testing" },
  { key: "cli", label: "CLI & diagnostics" },
  { key: "resolution", label: "Subdomain / header resolution" },
  { key: "jobs", label: "Background jobs" },
  { key: "lifecycle", label: "Onboarding & offboarding" },
];

/* ── Compatibility ───────────────────────────────────────────────────────── */

const isOrmOff = (id: string, db: string, fw: string) => {
  if (db === "mongodb") return id !== "mongoose";
  if (id === "mongoose") return db !== "mongodb";
  if (fw === "adonisjs") return id !== "lucid";
  if (id === "lucid") return fw !== "adonisjs";
  return false;
};
const isDbOff = (id: string, orm: string) => {
  if (orm === "mongoose") return id !== "mongodb";
  if (id === "mongodb") return orm !== "mongoose";
  if (orm === "lucid") return id === "mongodb";
  return false;
};
const isStratOff = (id: string, db: string, orm: string) => {
  if (id === "schemaPerTenant" && db !== "postgres") return true;
  if (orm === "lucid" && db === "mysql" && id !== "databasePerTenant") return true;
  return false;
};
const isFwOff = (id: string, orm: string) => orm === "lucid" ? id !== "adonisjs" : false;

/* ── Package map ─────────────────────────────────────────────────────────── */

const FW_PKG: Record<string, string> = {
  express: "tenancyjs-integration-express",
  nextjs: "tenancyjs-integration-next",
  nestjs: "tenancyjs-integration-nest",
  adonisjs: "tenancyjs-integration-adonis",
};
const ORM_PKG: Record<string, string> = {
  prisma: "tenancyjs-adapter-prisma",
  drizzle: "tenancyjs-adapter-drizzle",
  knex: "tenancyjs-adapter-knex",
  typeorm: "tenancyjs-adapter-typeorm",
  sequelize: "tenancyjs-adapter-sequelize",
  lucid: "tenancyjs-adapter-lucid",
  mongoose: "tenancyjs-adapter-mongoose",
};

/* ── Doc URLs per selection ──────────────────────────────────────────────── */

function docUrls(fw: string, orm: string, strat: string) {
  const base = "https://tenancyjs.pages.dev/docs";
  const urls = [
    `${base}                                    (mental model + THE RULES)`,
    `${base}/concepts/limitations               (what is REJECTED — read first)`,
    `${base}/concepts/capability-matrix          (what is proven)`,
  ];
  // Strategy
  const stratMap: Record<string, string> = {
    rowLevel: "row-level",
    schemaPerTenant: "schema-per-tenant",
    databasePerTenant: "database-per-tenant",
  };
  urls.push(`${base}/strategies/${stratMap[strat]}`);
  // Adapter
  const ormMap: Record<string, string> = {
    prisma: "prisma", drizzle: "drizzle", knex: "knex",
    typeorm: "typeorm", sequelize: "sequelize", lucid: "lucid", mongoose: "mongoose",
  };
  if (ormMap[orm]) urls.push(`${base}/adapters/${ormMap[orm]}`);
  // Integration
  const fwMap: Record<string, string> = {
    express: "express", nextjs: "nextjs", nestjs: "nestjs", adonisjs: "adonis",
  };
  if (fwMap[fw]) urls.push(`${base}/integrations/${fwMap[fw]}`);
  // Guides
  urls.push(
    `${base}/guides/resolving-tenants`,
    `${base}/guides/testing-isolation`,
  );
  return urls;
}

/* ── Prompt builder ──────────────────────────────────────────────────────── */

function buildPrompt(fw: string, orm: string, db: string, strat: string, guides: Guides) {
  const fwName = FRAMEWORKS.find((f) => f.id === fw)?.name ?? fw;
  const ormName = ORMS.find((o) => o.id === orm)?.name ?? orm;
  const dbName = DATABASES.find((d) => d.id === db)?.name ?? db;
  const stratName = STRATEGIES.find((s) => s.id === strat)?.name ?? strat;

  const pkgs = ["tenancyjs-core", ORM_PKG[orm], FW_PKG[fw], "tenancyjs-identifiers"].filter(Boolean).join(" ");
  const urls = docUrls(fw, orm, strat);

  // ── Adapter wiring block
  let adapterBlock = "";
  if (orm === "prisma") {
    if (strat === "rowLevel" && db === "postgres") {
      adapterBlock = `### Prisma row-level on PostgreSQL (two paths)

**Path A — Facade extension (simpler, facade-enforced):**
\`\`\`ts
import { createPrismaAdapter } from "tenancyjs-adapter-prisma";
const adapter = createPrismaAdapter({
  manager,
  tenantModels: { Order: {}, Post: {} }, // each key = Prisma model name
});
const db = new PrismaClient().$extends(adapter.extension);
\`\`\`
Raw SQL, nested writes/reads are REJECTED. Use the scoped model API only.

**Path B — RLS-backed (database-enforced, recommended for production):**
\`\`\`ts
import { createPrismaRowLevelTenancy } from "tenancyjs-adapter-prisma";
const tenancy = createPrismaRowLevelTenancy({
  manager,
  client,  // PrismaClient with @prisma/adapter-pg driver adapter
  tables: [{ model: "post", table: "posts", tenantColumn: "tenant_id" }],
});
await tenancy.validate(); // checks ENABLE + FORCE RLS and policy at startup
\`\`\`
Usage: \`await tenancy.run(async (tx) => tx.post.findMany())\`
Full raw SQL is safe here — the database enforces isolation via forced RLS.

**Required RLS DDL (apply via \`tenancy policy --apply\` or manually):**
\`\`\`sql
CREATE ROLE app_runtime LOGIN NOSUPERUSER NOBYPASSRLS;
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE posts FORCE ROW LEVEL SECURITY;
CREATE POLICY posts_tenant_isolation ON posts
  USING (current_setting('tenancyjs.is_central', true) = 'true'
         OR tenant_id = nullif(current_setting('tenancyjs.tenant_id', true), ''))
  WITH CHECK (current_setting('tenancyjs.is_central', true) = 'true'
              OR tenant_id = nullif(current_setting('tenancyjs.tenant_id', true), ''));
GRANT SELECT, INSERT, UPDATE, DELETE ON posts TO app_runtime;
\`\`\``;
    } else if (strat === "rowLevel") {
      adapterBlock = `### Prisma row-level on ${dbName} (facade-only)
\`\`\`ts
import { createPrismaAdapter } from "tenancyjs-adapter-prisma";
const adapter = createPrismaAdapter({
  manager,
  tenantModels: { Order: {}, Post: {} },
});
const db = new PrismaClient().$extends(adapter.extension);
\`\`\`
⚠️ ${dbName} has NO native RLS — this is facade-only. Raw SQL, nested writes/reads are REJECTED.
Never access the native PrismaClient inside a scope.`;
    } else if (strat === "schemaPerTenant") {
      adapterBlock = `### Prisma schema-per-tenant (PostgreSQL)
\`\`\`ts
import { createPrismaSchemaTenancy } from "tenancyjs-adapter-prisma";
const tenancy = createPrismaSchemaTenancy({
  manager,
  schema: (tenant) => ({
    key: \`schema_\${tenant.id}\`,
    create: () => new PrismaClient({
      adapter: new PrismaPg({ connectionString }, { schema: \`tenant_\${tenant.id}\` }),
    }),
  }),
  disconnect: (client) => client.$disconnect(),
});
\`\`\`
Requires Prisma 7 driver adapter. The factory MUST bind the correct schema.`;
    } else {
      adapterBlock = `### Prisma database-per-tenant
\`\`\`ts
import { createPrismaDatabaseTenancy } from "tenancyjs-adapter-prisma";
const tenancy = createPrismaDatabaseTenancy({
  manager,
  connection: (tenant) => ({
    key: tenant.databaseKey,
    create: () => createPrismaClient(tenant.databaseSecretRef),
  }),
  disconnect: (client) => client.$disconnect(),
  maxConnections: 25,
});
\`\`\`
Full query freedom: the connection IS the tenant's database. Use \`client.unrestricted()\` for raw SQL/joins.`;
    }
  } else if (orm === "knex") {
    const stratStr = strat === "rowLevel" ? '"rowLevel"' : strat === "schemaPerTenant" ? '"schemaPerTenant"' : '"databasePerTenant"';
    adapterBlock = `### Knex adapter
\`\`\`ts
import { createKnexTenancy } from "tenancyjs-adapter-knex";
const tenancy = createKnexTenancy({
  manager, knex,
  strategy: ${stratStr},
  ${strat === "rowLevel" ? 'tenantTables: { orders: {}, posts: {} },' : ''}${strat === "schemaPerTenant" ? 'schema: (tenant) => `tenant_${tenant.id}`,' : ''}${strat === "databasePerTenant" ? 'connection: (tenant) => ({ key: tenant.database, create: () => Knex({ client: "pg", connection: tenant.databaseUrl }) }),' : ''}
});
// Usage: await tenancy.run((db) => db("orders").select("*"));
\`\`\``;
  } else if (orm === "lucid") {
    adapterBlock = `### Lucid adapter (AdonisJS)
\`\`\`ts
import { createLucidTenancy } from "tenancyjs-adapter-lucid";
const tenancy = createLucidTenancy({
  manager, database: db,
  strategy: "${strat === "rowLevel" ? "rowLevel" : strat === "schemaPerTenant" ? "schemaPerTenant" : "databasePerTenant"}",
  tenantModels: [{ model: Order }, { model: Post }],
  ${strat === "schemaPerTenant" ? 'schema: (tenant) => `tenant_${tenant.id}`,' : ''}${strat === "databasePerTenant" ? 'connection: (tenant) => ({ key: tenant.connection, create: () => ({ transaction, destroy }) }),' : ''}
});
\`\`\`
Lucid models are auto-scoped. Lucid is the ONE adapter that supports nested reads in facade-enforced scopes.`;
  } else {
    // typeorm, sequelize, drizzle, mongoose — generic
    const adapterMap: Record<string, { fn: string; pkg: string }> = {
      typeorm: { fn: "createTypeOrmTenancy", pkg: "tenancyjs-adapter-typeorm" },
      sequelize: { fn: "createSequelizeTenancy", pkg: "tenancyjs-adapter-sequelize" },
      drizzle: { fn: "createDrizzleTenancy", pkg: "tenancyjs-adapter-drizzle" },
      mongoose: { fn: "createMongooseTenancy", pkg: "tenancyjs-adapter-mongoose" },
    };
    const a = adapterMap[orm];
    adapterBlock = `### ${ormName} adapter
\`\`\`ts
import { ${a.fn} } from "${a.pkg}";
// See the exact config shape at: https://tenancyjs.pages.dev/docs/adapters/${orm}
// Key options: manager, ${orm === "mongoose" ? "connection" : orm === "drizzle" ? "database" : orm === "typeorm" ? "dataSource" : "sequelize"}, strategy, tenantModels/tenantTables/tenantEntities
\`\`\`
Fetch the adapter page above for exact signatures — do NOT guess option names.`;
  }

  // ── Integration wiring block
  let integrationBlock = "";
  if (fw === "express") {
    integrationBlock = `### Express integration
\`\`\`ts
import { createExpressTenancyMiddleware } from "tenancyjs-integration-express";
app.use(createExpressTenancyMiddleware({
  manager,
  resolver,     // a TenantResolutionChain — NOT a function
  principal: (req) => req.user,  // optional
}));
\`\`\``;
  } else if (fw === "nextjs") {
    integrationBlock = `### Next.js integration
\`\`\`ts
import { createNextTenancy } from "tenancyjs-integration-next";
import { withNextTenantHint } from "tenancyjs-integration-next/edge";

const tenancy = createNextTenancy({ manager, resolver, principal: async () => getSessionUser() });

// Edge middleware (middleware.ts):
export function middleware(request: Request) {
  return NextResponse.next({ request: { headers: withNextTenantHint(request) } });
}

// Route Handler:
export const GET = tenancy.withRouteHandler(async () => { ... });
\`\`\``;
  } else if (fw === "nestjs") {
    integrationBlock = `### NestJS integration
\`\`\`ts
import { TenancyModule, TenantRoute } from "tenancyjs-integration-nest";

// Module registration:
TenancyModule.forRoot({ manager, resolver, principal: (req) => req.user });

// Controller decorator:
@TenantRoute()
\`\`\``;
  } else if (fw === "adonisjs") {
    integrationBlock = `### AdonisJS integration
\`\`\`ts
import { defineAdonisTenancyConfig } from "tenancyjs-integration-adonis";
export default defineAdonisTenancyConfig<Tenant>({
  manager, resolver,
  principal: (ctx) => ctx.auth.user,
  tenancy: () => createLucidTenancy({ ... }),
});
// Register provider: () => import('tenancyjs-integration-adonis/provider')
// Named middleware: tenant: () => import('#middleware/tenant_middleware')
\`\`\``;
  } else {
    integrationBlock = `### Manual framework wiring (any framework)
Two steps:
1. Resolve: \`const outcome = await resolver.resolve({ host, headers }, { principal })\`
2. Scope: \`await manager.runWithTenant(outcome.tenant, () => next())\`
Use \`describeTenantResolutionFailure(outcome.status)\` → \`{ status: 400|404|500, message }\` for error responses.`;
  }

  // ── Optional sections
  const sections: string[] = [];

  if (guides.resolution) {
    sections.push(`## Tenant resolution
\`\`\`ts
import { TenantResolutionChain, HeaderTenantResolver } from "tenancyjs-identifiers";

const resolver = new TenantResolutionChain<Tenant>({
  resolvers: [new HeaderTenantResolver({ headerName: "x-tenant-id" })],
  store: {
    async find(identifier) {
      const tenant = await db.tenant.findUnique({ where: { slug: identifier.value } });
      return tenant ? [{ tenant, status: "active" }] : [];
    },
  },
  // REQUIRED — resolver refuses to construct without one:
  authorize: ({ tenant, principal }) => principal.teamIds.includes(tenant.id),
  // OR: trustResolution: true (ONLY for non-spoofable sources like signed JWTs)
});
\`\`\`
Failure semantics: 400 → no-identifier/invalid, 404 → not-found/suspended/forbidden (indistinguishable to client), 500 → ambiguous.
**Critical rule:** "Resolving a tenant proves it exists — never that the user may act as it." You MUST verify membership.`);
  }

  if (guides.testing) {
    sections.push(`## Conformance & adversarial testing
Write a two-tenant adversarial test on a real test database (never app data):
\`\`\`ts
// Seed colliding rows:
await manager.runWithTenant({ id: "a" }, () =>
  db.order.create({ data: { id: "same-id", total: 10 } }),
);
await manager.runWithTenant({ id: "b" }, () =>
  db.order.create({ data: { id: "same-id", total: 99 } }),
);

// Verify isolation — tenant A sees only its own row:
const seen = await manager.runWithTenant({ id: "a" }, () => db.order.findMany());
expect(seen).toEqual([{ id: "same-id", total: 10 }]);

// Verify fail-closed — unscoped access throws:
await expect(db.order.findMany()).rejects.toThrow(TenantContextError);
\`\`\`
Use \`tenancyjs-testing\` conformance contracts for comprehensive coverage.
Run \`tenancy test:leak --test-file <path>\` from the CLI to automate this.`);
  }

  if (guides.cli) {
    sections.push(`## CLI configuration & diagnostics
Create \`tenancy.config.ts\` (loaded by Node 24 native type-stripping):
\`\`\`ts
import { defineTenancyRuntime } from "tenancyjs-core";

export default defineTenancyRuntime({
  manager,
  store,          // powers registry commands (list/create/suspend/…)
  adapters: [...], // powers \`tenant check\` capability reporting
  provisioner: {
    provision: async (tenant) => { /* CREATE SCHEMA/DATABASE */ },
    migrate: async (tenant) => { /* run ORM migrator */ },
    deprovision: async (tenant) => { /* DROP — destructive */ },
  },
  admin,           // optional — privileged pg connection for policy --apply
  dispose: async () => { /* close connections */ },
});
\`\`\`
Key commands: \`tenancy tenant check\`, \`tenancy doctor\`, \`tenancy tenant list\`,
\`tenancy tenant provision <id>\`, \`tenancy tenant migrate --all\`,
\`tenancy policy --table posts --role app_runtime --apply\`.`);
  }

  if (guides.jobs) {
    sections.push(`## Background jobs & worker context
AsyncLocalStorage does NOT survive queue/timer/worker boundaries.
A job enqueued inside a scope runs UNSCOPED on the worker — so tenant access
throws (fail-closed), never silently leaks. Carry context explicitly:
\`\`\`ts
import { captureTenancy, runWithTenancySnapshot } from "tenancyjs-core";

// Publisher (inside tenant scope): capture and serialize into the job payload
await queue.add("email", { tenancy: captureTenancy(manager), userId });

// Worker: restore the scope before running tenant-aware code
await runWithTenancySnapshot(manager, job.data.tenancy, () =>
  sendEmail(job.data.userId),
);
\`\`\``);
  }

  if (guides.lifecycle) {
    sections.push(`## Onboarding & offboarding
\`\`\`ts
import { onboardTenant } from "tenancyjs-core";

// Onboarding: records tenant → provisions → migrates, with auto-rollback on failure
const tenant = await onboardTenant(runtime, { id: form.slug, plan: form.plan });

// Offboarding: suspend first, then deprovision
await runtime.store.suspend(tenantId);
await runtime.provisioner.deprovision(tenant);
\`\`\`
CLI equivalents: \`tenancy tenant create <id>\`, \`tenancy tenant provision <id>\`,
\`tenancy tenant migrate <id>\`, \`tenancy tenant suspend <id>\`,
\`tenancy tenant deprovision <id>\`.`);
  }

  return `# TenancyJS Integration Agent

You are an integration agent. Add fail-closed multi-tenancy to THIS project
with TenancyJS. Integrate with whatever already exists — do NOT assume a
greenfield app.

**CRITICAL:** Do NOT invent or assume API names, option values, or enum strings
from memory. Your training data may be stale. Verify against:
- The installed package's own TypeScript types (in node_modules)
- The linked documentation pages below
- \`npm view <pkg> version\` for versions

Read ALL of these before writing any code (source of truth):
${urls.map((u) => `- ${u}`).join("\n")}

## THE RULES (violating these = cross-tenant data leak)
- ✅ Run EVERY tenant query through the scoped client inside \`manager.runWithTenant()\`
- ✅ Let TenantContextError throw — it's the safety net, don't catch-and-ignore
- ❌ NEVER reach for the native client/model/connection inside a scope —
  on ${db === "postgres" ? "facade-enforced tiers" : `${dbName} (no database backstop)`} that's a direct cross-tenant leak
- ❌ NEVER expect raw SQL or nested writes from the facade — they're REJECTED
  unless in a database-enforced scope (database-per-tenant or forced-RLS on PostgreSQL)
  where \`unrestricted()\` gives the real client safely
- ❌ NEVER nest a scope for a different tenant inside an active tenant scope

## Step 0 — Assess the app (change nothing yet)
- Confirm Node.js >= 24
- Framework: **${fwName}**
- ORM: **${ormName}**
- Database: **${dbName}**
- Strategy: **${stratName}**
- Inventory all data models. Mark each as **tenant-scoped** or **central/global**.
  Only tenant-scoped models get registered with the adapter.
- Detect how user identity / session is determined per request (needed for authorize).
- Detect any EXISTING tenant concept (tenantId/orgId column, workspaces table) and REUSE it.
- Report the versions of all packages involved.

## Step 1 — Install
\`\`\`bash
npm install ${pkgs}
\`\`\`

## Step 2 — Create the TenancyManager (one shared instance)
\`\`\`ts
import { TenancyManager } from "tenancyjs-core";

interface Tenant { readonly id: string; /* your fields */ }
export const manager = new TenancyManager<Tenant>();
\`\`\`
The manager uses AsyncLocalStorage. Tenant records are frozen inside a scope.
Bootstrappers revert in reverse order on every path (including errors) via try/finally.

## Step 3 — Wire the adapter
${adapterBlock}

## Step 4 — Wire the framework integration
${integrationBlock}

## Step 5 — Scope data access
- Route ALL tenant queries through the scoped client (drop manual WHERE tenant_id = …)
- Keep admin/cross-tenant work in explicit central context:
  \`await manager.runInCentralContext(() => db.tenant.findMany())\`
- Add error handling for resolution failures:
  use \`describeTenantResolutionFailure(outcome.status)\` → \`{ status, message }\`

${sections.length > 0 ? sections.join("\n\n") : ""}

## Step 6 — Verify & deliver
1. Deliver all config files, middleware registrations, and converted routes.
2. Write a two-tenant leak test (against a TEST database — never seed app data)
   proving (a) no cross-tenant read and (b) unscoped access throws.
3. Report every file changed and anything that could not be applied.
4. Give a concise rollout plan for existing data (backfill, provisioning, staged rollout).`;
}

/* ── Component ───────────────────────────────────────────────────────────── */

export default function PromptGenerator() {
  const [fw, setFw] = useState("express");
  const [orm, setOrm] = useState("prisma");
  const [db, setDb] = useState("postgres");
  const [strat, setStrat] = useState("rowLevel");
  const [guides, setGuides] = useState<Guides>({
    testing: true, cli: true, jobs: false, resolution: false, lifecycle: false,
  });
  const [copied, setCopied] = useState(false);

  // Enforce cascades
  useEffect(() => {
    if (db === "mongodb" && orm !== "mongoose") setOrm("mongoose");
    if (db !== "mongodb" && orm === "mongoose") setOrm("prisma");
    if (db === "mongodb" && strat === "schemaPerTenant") setStrat("rowLevel");
    if (db === "mysql" && strat === "schemaPerTenant") setStrat("databasePerTenant");
    if (fw === "adonisjs" && orm !== "lucid") setOrm("lucid");
    if (fw !== "adonisjs" && orm === "lucid") setOrm("prisma");
    if (orm === "lucid" && fw !== "adonisjs") setFw("adonisjs");
    if (orm === "lucid" && db === "mongodb") setDb("postgres");
  }, [fw, orm, db, strat]);

  const prompt = useMemo(() => buildPrompt(fw, orm, db, strat, guides), [fw, orm, db, strat, guides]);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(prompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [prompt]);

  const toggle = useCallback(
    (k: keyof Guides) => setGuides((p) => ({ ...p, [k]: !p[k] })), [],
  );

  return (
    <div className="tj-glow my-10 rounded-2xl border border-fd-border bg-fd-card/50 p-6 sm:p-8">
      <div className="mb-6">
        <h3 className="text-lg font-bold sm:text-xl">
          <span className="tj-grad">Prompt generator</span>
        </h3>
        <p className="mt-1.5 text-sm leading-relaxed text-fd-muted-foreground">
          Pick your stack. The generator enforces capability rules and compiles a
          comprehensive, end-to-end integration prompt with exact API signatures,
          code examples, and documentation links for your AI coding assistant.
        </p>
      </div>

      {/* Selectors */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Sel label="Framework" value={fw} set={setFw} opts={FRAMEWORKS} off={(id) => isFwOff(id, orm)} />
        <Sel label="ORM / query builder" value={orm} set={setOrm} opts={ORMS} off={(id) => isOrmOff(id, db, fw)} />
        <Sel label="Database" value={db} set={setDb} opts={DATABASES} off={(id) => isDbOff(id, orm)} />
        <Sel label="Isolation strategy" value={strat} set={setStrat} opts={STRATEGIES} off={(id) => isStratOff(id, db, orm)} />
      </div>

      {/* Warnings */}
      {db === "mysql" && strat === "rowLevel" && (
        <Warn>
          <strong>MySQL row-level is facade-only (experimental).</strong> No database backstop —
          a raw connection handle bypass compromises isolation.
        </Warn>
      )}
      {db === "mongodb" && strat === "rowLevel" && (
        <Warn>
          <strong>MongoDB is facade-only.</strong> Isolation is enforced
          by the Mongoose query facade; native model access bypasses it.
        </Warn>
      )}

      {/* Toggles */}
      <fieldset className="mt-6">
        <legend className="mb-3 text-xs font-semibold uppercase tracking-widest text-fd-muted-foreground">
          Include in prompt
        </legend>
        <div className="flex flex-wrap gap-2">
          {GUIDE_LABELS.map(({ key, label }) => (
            <button key={key} type="button" onClick={() => toggle(key)}
              className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                guides[key]
                  ? "border-fd-primary/40 bg-fd-primary/10 text-fd-primary"
                  : "border-fd-border bg-fd-card/60 text-fd-muted-foreground hover:border-fd-primary/30 hover:text-fd-accent-foreground"
              }`}>
              {guides[key] ? "✓ " : ""}{label}
            </button>
          ))}
        </div>
      </fieldset>

      {/* Output */}
      <div className="mt-8 overflow-hidden rounded-xl border border-fd-border bg-fd-background shadow-md">
        <div className="flex items-center justify-between border-b border-fd-border/70 px-4 py-2.5">
          <div className="flex items-center gap-2">
            <span className="size-3 rounded-full bg-[#ff5f57]/80" />
            <span className="size-3 rounded-full bg-[#febc2e]/80" />
            <span className="size-3 rounded-full bg-[#28c840]/80" />
            <span className="ml-2 font-mono text-xs text-fd-muted-foreground">integration_prompt.md</span>
          </div>
          <button onClick={handleCopy}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-all duration-200 ${
              copied
                ? "border-[#28c840]/30 bg-[#28c840]/10 text-[#28c840]"
                : "border-fd-primary/20 bg-fd-primary/10 text-fd-primary hover:border-fd-primary/40 hover:bg-fd-primary/20"
            }`}>
            {copied ? "✓ Copied" : "Copy prompt"}
          </button>
        </div>
        <pre className="max-h-[420px] overflow-auto p-5 text-[13px] leading-[1.85] text-fd-foreground/85 [overflow-wrap:anywhere]">
          <code className="font-mono whitespace-pre-wrap">{prompt}</code>
        </pre>
      </div>
    </div>
  );
}

/* ── Sub-components ──────────────────────────────────────────────────────── */

function Sel({ label, value, set, opts, off }: {
  label: string; value: string; set: (v: string) => void; opts: Opt[]; off: (id: string) => boolean;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-widest text-fd-muted-foreground">{label}</label>
      <select value={value} onChange={(e) => set(e.target.value)}
        className="w-full appearance-none rounded-xl border border-fd-border bg-fd-background px-3.5 py-2.5 text-sm text-fd-foreground transition focus:border-fd-primary focus:outline-none focus:ring-1 focus:ring-fd-ring">
        {opts.map((o) => <option key={o.id} value={o.id} disabled={off(o.id)}>{o.name}</option>)}
      </select>
    </div>
  );
}

function Warn({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-[#febc2e]/25 bg-[#febc2e]/5 px-4 py-3 text-xs leading-relaxed text-[#febc2e] dark:border-[#febc2e]/20 dark:bg-[#febc2e]/[0.04]">
      <span className="mt-px select-none text-sm">⚠️</span>
      <span>{children}</span>
    </div>
  );
}
