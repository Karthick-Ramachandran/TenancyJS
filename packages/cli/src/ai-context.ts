import { readFile, writeFile } from "node:fs/promises";

import {
  FRAMEWORK_LABEL,
  INTEGRATION_PACKAGE,
  ORM_LABEL,
  ORM_PEER,
} from "./capabilities.js";
import {
  assertNoSymlinkPath,
  isMissing,
  resolveContainedPath,
} from "./paths.js";
import type { InitFramework, InitOrm } from "./types.js";

/** Root-level guide the CLI can (re)generate for humans and AI assistants. */
export const GUIDE_FILE = "TENANCY.md";
/** Agent-memory files we augment in place — never created if absent. */
export const AGENT_MEMORY_FILES = ["AGENTS.md", "CLAUDE.md"] as const;

const BLOCK_START = "<!-- tenancyjs:start -->";
const BLOCK_END = "<!-- tenancyjs:end -->";
const DOCS = "https://tenancyjs.pages.dev/docs";

const INTEGRATION_DOC: Record<InitFramework, string> = {
  express: `${DOCS}/integrations/express`,
  adonis: `${DOCS}/integrations/adonis`,
  next: `${DOCS}/integrations/nextjs`,
};

export interface AiContextInput {
  readonly root: string;
  readonly framework: InitFramework;
  readonly orm: InitOrm;
}

export interface MemoryUpdate {
  readonly path: string;
  /** `added` = block appended, `updated` = existing block replaced. */
  readonly action: "added" | "updated";
}

export interface AiContextResult {
  /** `skipped` means a different TENANCY.md exists and was left untouched. */
  readonly guide: "created" | "unchanged" | "skipped";
  readonly memory: readonly MemoryUpdate[];
  /** True when neither AGENTS.md nor CLAUDE.md was present to augment. */
  readonly noMemoryFound: boolean;
}

/**
 * Write the stack-specific `TENANCY.md` and register a marked TenancyJS block in
 * any AGENTS.md/CLAUDE.md that already exists. Confirmed and opt-in — the caller
 * only invokes this after an interactive yes or an explicit `--ai-context` flag.
 * Fails closed on symlinked or escaping paths and never overwrites a divergent
 * TENANCY.md or an agent-memory file that is not already present.
 */
export async function applyAiContext(
  input: AiContextInput,
): Promise<AiContextResult> {
  const guide = await writeGuide(input);
  const memory: MemoryUpdate[] = [];
  for (const file of AGENT_MEMORY_FILES) {
    const update = await updateMemoryFile(input, file);
    if (update !== undefined) memory.push(update);
  }
  return Object.freeze({
    guide,
    memory: Object.freeze(memory),
    noMemoryFound: memory.length === 0,
  });
}

async function writeGuide(
  input: AiContextInput,
): Promise<AiContextResult["guide"]> {
  const target = resolveContainedPath(input.root, GUIDE_FILE);
  await assertNoSymlinkPath(input.root, target, true);
  const content = buildTenancyGuide(input.framework, input.orm);
  const existing = await readIfPresent(target);
  if (existing === undefined) {
    await writeFile(target, content, { encoding: "utf8", mode: 0o644 });
    return "created";
  }
  return existing === content ? "unchanged" : "skipped";
}

async function updateMemoryFile(
  input: AiContextInput,
  file: string,
): Promise<MemoryUpdate | undefined> {
  const target = resolveContainedPath(input.root, file);
  await assertNoSymlinkPath(input.root, target, true);
  const existing = await readIfPresent(target);
  if (existing === undefined) return undefined; // present-only; never create.
  const block = buildAgentMemoryBlock(input.framework, input.orm);
  const merged = mergeBlock(existing, block);
  if (merged.next !== existing)
    await writeFile(target, merged.next, { encoding: "utf8" });
  return { path: file, action: merged.existed ? "updated" : "added" };
}

/** Replace the marked block in place if present, else append it at the end. */
function mergeBlock(
  existing: string,
  block: string,
): { next: string; existed: boolean } {
  const start = existing.indexOf(BLOCK_START);
  const end = existing.indexOf(BLOCK_END);
  if (start !== -1 && end > start) {
    const before = existing.slice(0, start);
    const after = existing.slice(end + BLOCK_END.length);
    return { next: `${before}${block}${after}`, existed: true };
  }
  const gap = existing.endsWith("\n\n")
    ? ""
    : existing.endsWith("\n")
      ? "\n"
      : "\n\n";
  return { next: `${existing}${gap}${block}\n`, existed: false };
}

async function readIfPresent(target: string): Promise<string | undefined> {
  try {
    return await readFile(target, "utf8");
  } catch (error) {
    if (isMissing(error)) return undefined;
    throw error;
  }
}

/** The `<!-- tenancyjs:start -->…<!-- tenancyjs:end -->` block for agent memory. */
export function buildAgentMemoryBlock(
  framework: InitFramework,
  orm: InitOrm,
): string {
  return [
    BLOCK_START,
    "## TenancyJS",
    "",
    `This project uses TenancyJS for fail-closed tenant isolation (${FRAMEWORK_LABEL[framework]} + ${ORM_LABEL[orm]}).`,
    "",
    "- See `TENANCY.md` for the commands and wiring specific to this stack.",
    "- All tenant-scoped data access must run inside a tenant scope (e.g. `manager.runWithTenant(...)`).",
    "  Access outside a scope throws by design — never bypass it or add an unscoped fallback.",
    "- Operate tenants with the CLI: `tenancy tenant check | list | create | provision | migrate`, `tenancy run`.",
    `- Docs: ${DOCS}`,
    BLOCK_END,
  ].join("\n");
}

/** The full stack-specific `TENANCY.md`. Plain markdown — no ANSI. */
export function buildTenancyGuide(
  framework: InitFramework,
  orm: InitOrm,
): string {
  const packages = [
    "tenancyjs-core",
    `tenancyjs-adapter-${orm}`,
    INTEGRATION_PACKAGE[framework],
    "tenancyjs-identifiers",
    ORM_PEER[orm],
  ].join(" ");

  return `${[
    `# Working with TenancyJS — ${FRAMEWORK_LABEL[framework]} + ${ORM_LABEL[orm]}`,
    "",
    "This project uses **TenancyJS** for fail-closed multi-tenancy. Tenant identity rides the async",
    "execution scope, so queries stay scoped without threading a `tenantId` through every call. Any",
    "tenant-aware access outside a valid tenant scope **throws** — it never returns another tenant's",
    "data. That refusal is the guarantee; don't work around it.",
    "",
    `> Full documentation: ${DOCS}`,
    "",
    "## Install",
    "",
    "```bash",
    `npm install ${packages}`,
    "```",
    "",
    "## Everyday commands",
    "",
    "```bash",
    "npx tenancy doctor                       # inspect wiring + migration effort",
    "npx tenancy tenant check                 # health-probe the runtime",
    "npx tenancy tenant list                  # read your bring-your-own tenant store",
    "npx tenancy tenant create acme --set plan=pro",
    "npx tenancy tenant provision acme        # your provisioner hook creates the schema/database",
    "npx tenancy tenant migrate --all         # migrate every tenant",
    "npx tenancy run ./backfill.ts --tenant acme",
    "npx tenancy test:leak --test-file <path> # prove cross-tenant isolation on a real database",
    "```",
    "",
    "## Wiring this stack",
    "",
    ...wiringNotes(framework, orm),
    "",
    "## Isolation model",
    "",
    ...isolationNotes(orm),
    "",
    "## Where to read more",
    "",
    `- Integration: ${INTEGRATION_DOC[framework]}`,
    `- Adapter: ${DOCS}/adapters/${orm}`,
    `- Strategies: ${DOCS}/strategies/row-level`,
    `- Rules & limitations (read before you build): ${DOCS}/concepts/limitations`,
    "",
  ].join("\n")}`;
}

function wiringNotes(framework: InitFramework, orm: InitOrm): string[] {
  const notes: string[] = [];
  if (framework === "express")
    notes.push(
      "- Mount `createExpressTenancyMiddleware({ manager, resolver })` — `resolver` is a",
      "  `TenantResolutionChain` (from `tenancyjs-identifiers`), not a plain function.",
      "- Add an Express error handler for `ExpressTenancyResolutionError` (maps to 400 / 404 / 500).",
    );
  else if (framework === "next")
    notes.push(
      "- Wrap route handlers with `tenancy.withRouteHandler(...)` and Server Actions with",
      "  `tenancy.withServerAction(...)`; add the edge `middleware.ts` hint via `withNextTenantHint`.",
      "- Tenant-key or explicitly uncache any Next cache entries — this package does not patch Next caching.",
    );
  else
    notes.push(
      "- Install `tenancyjs-identifiers` explicitly (AdonisJS resolves it only transitively otherwise).",
      "- Register the provider in `adonisrc.ts` and apply the tenant middleware to tenant route groups only.",
      "- In tests, call `config.tenancy.validate()` yourself — the `/testing` helper does not auto-validate.",
    );

  notes.push(
    "- Classify every model/table as tenant-scoped or central and register it with the adapter.",
  );
  if (orm === "prisma")
    notes.push(
      "- Expose only the client returned by `base.$extends(createPrismaTenancyExtension(...))`;",
      "  retaining the base client bypasses isolation. Apply the TenancyJS extension last.",
      "- Prisma 7 needs a driver adapter (e.g. `@prisma/adapter-pg`) and reads the datasource URL from",
      "  `prisma.config.ts`. The generated `create` input still requires `tenantId`; pass the active id",
      "  (the adapter validates it and rejects a mismatch).",
    );
  return notes;
}

function isolationNotes(orm: InitOrm): string[] {
  if (orm === "prisma")
    return [
      "- `init` scaffolds **row-level** isolation. Prisma row-level is **facade-enforced** — the extension",
      "  rewrites query arguments; there is no PostgreSQL RLS backstop, so never use the base client.",
      "- An RLS-backed path also exists (`createPrismaRowLevelTenancy`, needs `@prisma/adapter-pg` + forced",
      "  RLS) that adds a PostgreSQL database backstop; the extension path above stays facade-only.",
      "- For a database-enforced backstop, use that path, schema-per-tenant (schema-bound driver clients),",
      "  or database-per-tenant. See the adapter docs.",
    ];
  return [
    "- `init` scaffolds **row-level** isolation backed by **forced PostgreSQL RLS**.",
    "- Add a migration that, for every tenant table: `ENABLE` + `FORCE` row level security under a",
    "  non-owner, non-`BYPASSRLS`, non-superuser runtime role, with a `<table>_tenant_isolation` policy",
    "  whose `USING` and `WITH CHECK` read `tenancyjs.tenant_id` and `tenancyjs.is_central`.",
    "- Generate that DDL with `npx tenancy policy --table <t> [--table <t> ...] --role <runtime-role>`",
    "  (it prints SQL and executes nothing); review it, then apply it with your own migration tool.",
    "- Run `validate()` at startup — protected execution stays locked until the policy contract passes.",
  ];
}
