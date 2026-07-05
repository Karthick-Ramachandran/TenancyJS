import Link from "next/link";
import type { ReactNode } from "react";

/* ── robust line-based code highlighter (preserves whitespace exactly) ──── */
const CODE = `// Tenant identity rides AsyncLocalStorage.
await manager.runWithTenant({ id: "acme" }, async () => {
  // scoped to acme - automatically
  const orders = await db.order.findMany();
});

// Outside a tenant scope? It fails closed.
await db.order.findMany();
// ✗ throws TenantContextError - never an unscoped read`;

const KEYWORDS = new Set(["await", "async", "const", "return", "new", "let"]);

function CodeLine({ src }: { src: string }) {
  if (src.trimStart().startsWith("//")) {
    return (
      <span className="italic text-[#6b7280]">
        {src}
        {"\n"}
      </span>
    );
  }
  // Split keeps delimiters (strings + words), so concatenation === src.
  const parts = src.split(/("(?:[^"\\]|\\.)*"|\b\w+\b)/g);
  return (
    <span>
      {parts.map((p, i) => {
        let cls = "";
        if (p.startsWith('"')) cls = "text-[#86efac]";
        else if (KEYWORDS.has(p)) cls = "text-[#a5b4fc]";
        else if (p === "manager" || p === "db") cls = "text-[#93c5fd]";
        return (
          <span key={i} className={cls}>
            {p}
          </span>
        );
      })}
      {"\n"}
    </span>
  );
}

function Editor() {
  return (
    <div className="tj-glow overflow-hidden rounded-2xl border border-fd-border bg-[#0b0c10] shadow-2xl">
      <div className="flex items-center gap-2 border-b border-fd-border/70 px-4 py-3">
        <span className="size-3 rounded-full bg-[#ff5f57]/80" />
        <span className="size-3 rounded-full bg-[#febc2e]/80" />
        <span className="size-3 rounded-full bg-[#28c840]/80" />
        <span className="ml-3 font-mono text-xs text-fd-muted-foreground">
          orders.ts
        </span>
      </div>
      <pre className="overflow-x-auto p-5 text-[13px] leading-[1.85] text-[#d4d7de]">
        <code className="font-mono">
          {CODE.split("\n").map((l, i) => (
            <CodeLine key={i} src={l} />
          ))}
        </code>
      </pre>
    </div>
  );
}

const stacks = [
  "Express",
  "Next.js",
  "NestJS",
  "AdonisJS",
  "Prisma",
  "Knex",
  "Lucid",
  "TypeORM",
  "Sequelize",
  "Mongoose",
];

const strategies = [
  {
    n: "01",
    name: "Single database",
    tag: "row-level",
    body: "Shared tables keyed by tenant_id, enforced by forced Postgres RLS or query-scoping. The lightest footprint.",
    who: "Knex · Lucid · Prisma · TypeORM · Sequelize · Mongoose",
  },
  {
    n: "02",
    name: "Schema per tenant",
    tag: "search_path",
    body: "One Postgres schema per tenant via transaction-local search_path, with an optional per-tenant role for database-enforced isolation.",
    who: "Knex · Lucid · Prisma · TypeORM · Sequelize",
  },
  {
    n: "03",
    name: "Database per tenant",
    tag: "cache-routed",
    body: "A separate database per tenant, routed through a bounded, single-flight connection cache. Hard isolation, no noisy neighbours.",
    who: "Knex · Lucid · Prisma · TypeORM · Sequelize · Mongoose",
  },
];

const guarantees = [
  {
    title: "Fail-closed, always",
    body: "No valid tenant context means an error at the boundary - never a silent read of unscoped data.",
  },
  {
    title: "Proven, not claimed",
    body: 'A capability is marked "supported" only after a real two-tenant adversarial test on a real database.',
  },
  {
    title: "Bring your own store",
    body: "Your registry, hardened at the boundary - a buggy store can't hand back the wrong tenant.",
  },
  {
    title: "Cleanup always runs",
    body: "Transaction-scoped context is torn down on every path, including errors. No leaked scope between requests.",
  },
];

const steps = [
  {
    n: "01",
    name: "Set the tenant per request",
    body: "Your framework integration (Express, Next.js, NestJS, AdonisJS) resolves who the request belongs to and opens a tenant scope.",
    code: "app.use(tenancyMiddleware({ resolver }));",
  },
  {
    n: "02",
    name: "Query through the scoped client",
    body: "Inside the scope, your ORM adapter hands you a client that's already filtered to the tenant. No tenantId threading, no manual WHERE.",
    code: "const orders = await db.order.findMany();",
  },
  {
    n: "03",
    name: "Outside a scope, it fails closed",
    body: "No valid tenant context? Tenant-aware access throws at the boundary instead of returning another tenant's rows. The safe path is the default.",
    code: "await db.order.findMany(); // ✗ throws",
  },
];

function Kicker({ children }: { children: ReactNode }) {
  return (
    <p className="text-sm font-semibold uppercase tracking-[0.14em] text-fd-primary">
      {children}
    </p>
  );
}

const primaryBtn =
  "inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-[#6d64ff] via-[#a855f7] to-[#ec4899] px-5 py-3 font-semibold text-white shadow-lg shadow-[#6d64ff]/25 transition hover:brightness-110";
const ghostBtn =
  "inline-flex items-center justify-center rounded-xl border border-fd-border bg-fd-card/60 px-5 py-3 font-semibold transition hover:border-fd-primary/60";

export default function HomePage() {
  return (
    <main className="flex flex-1 flex-col">
      {/* ── Hero ─────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden px-6 pb-16 pt-20 sm:pt-28">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 -top-40 -z-10 mx-auto h-[640px] max-w-5xl opacity-70 blur-3xl"
          style={{
            background:
              "radial-gradient(38% 44% at 50% 30%, rgba(109,100,255,.35), transparent 70%), radial-gradient(30% 40% at 78% 20%, rgba(236,72,153,.22), transparent 70%), radial-gradient(28% 40% at 22% 35%, rgba(168,85,247,.22), transparent 70%)",
          }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10 opacity-[0.03]"
          style={{
            backgroundImage:
              "linear-gradient(to right, #fff 1px, transparent 1px), linear-gradient(to bottom, #fff 1px, transparent 1px)",
            backgroundSize: "56px 56px",
            maskImage:
              "radial-gradient(60% 50% at 50% 30%, #000, transparent 75%)",
          }}
        />

        <div className="mx-auto max-w-5xl text-center">
          <Link
            href="/docs"
            className="inline-flex items-center gap-2 rounded-full border border-fd-border bg-fd-card/60 px-4 py-1.5 text-sm text-fd-muted-foreground backdrop-blur transition hover:border-fd-primary/50"
          >
            <span className="size-1.5 rounded-full bg-gradient-to-r from-[#6d64ff] to-[#ec4899]" />
            <span className="font-medium text-fd-foreground">0.1.0-beta</span>{" "}
            is out - read the docs
            <span aria-hidden>→</span>
          </Link>

          <h1 className="mx-auto mt-7 max-w-4xl text-balance text-5xl font-extrabold leading-[1.05] tracking-tight sm:text-7xl">
            Multi-tenancy that{" "}
            <span className="tj-grad">refuses to leak</span>
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-pretty text-lg text-fd-muted-foreground sm:text-xl">
            A fail-closed, TypeScript-first tenancy toolkit for Node.js. Tenant
            identity follows your async scope - and any tenant-aware access
            without a valid context <strong className="text-fd-foreground">
              throws
            </strong>{" "}
            instead of returning another tenant&rsquo;s data.
          </p>

          <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
            <Link href="/docs" className={primaryBtn}>
              Get started →
            </Link>
            <a
              href="https://github.com/Karthick-Ramachandran/TenancyJS"
              className={ghostBtn}
            >
              Star on GitHub
            </a>
          </div>

          <div className="mt-6 inline-flex items-center gap-3 rounded-xl border border-fd-border bg-fd-card/60 px-4 py-2.5 font-mono text-sm backdrop-blur">
            <span className="select-none text-fd-muted-foreground">$</span>
            npm install tenancyjs-core
            <span className="text-xs text-fd-muted-foreground">@beta</span>
          </div>
        </div>

        <div className="mx-auto mt-14 max-w-2xl">
          <Editor />
        </div>
      </section>

      {/* ── Works with ───────────────────────────────────────────────── */}
      <section className="border-y border-fd-border/70 px-6 py-10">
        <div className="mx-auto max-w-5xl">
          <p className="text-center text-xs font-semibold uppercase tracking-[0.16em] text-fd-muted-foreground">
            Works with the stack you already use
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-x-8 gap-y-3">
            {stacks.map((s) => (
              <span
                key={s}
                className="font-mono text-sm text-fd-muted-foreground/80"
              >
                {s}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ── Failure mode ─────────────────────────────────────────────── */}
      <section className="px-6 py-24">
        <div className="mx-auto grid max-w-6xl items-center gap-12 md:grid-cols-2">
          <div>
            <Kicker>The failure mode</Kicker>
            <h2 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">
              A forgotten{" "}
              <code className="rounded-md bg-fd-primary/10 px-1.5 text-fd-primary">
                WHERE
              </code>{" "}
              should be a crash, not a data breach
            </h2>
            <p className="mt-5 text-lg text-fd-muted-foreground">
              The dangerous bug in multi-tenancy is the one that
              doesn&rsquo;t throw. A missing tenant filter returns data -
              silently - and you find out from a support ticket. TenancyJS makes
              the safe path the default: no valid context, no data.
            </p>
            <Link
              href="/docs/concepts/tenant-context"
              className="mt-6 inline-flex font-semibold text-fd-primary hover:underline"
            >
              How tenant context works →
            </Link>
          </div>
          <Editor />
        </div>
      </section>

      {/* ── How it works ─────────────────────────────────────────────── */}
      <section className="border-t border-fd-border/70 px-6 py-24">
        <div className="mx-auto max-w-6xl">
          <div className="mx-auto max-w-2xl text-center">
            <Kicker>How you use it</Kicker>
            <h2 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">
              Three moving parts, one scoped client
            </h2>
            <p className="mt-5 text-lg text-fd-muted-foreground">
              Pick a <strong className="text-fd-foreground">strategy</strong>,
              plug in your ORM <strong className="text-fd-foreground">adapter</strong>{" "}
              and framework{" "}
              <strong className="text-fd-foreground">integration</strong> - they
              compose, and none of them need to know about each other.
            </p>
          </div>
          <div className="mt-14 grid gap-5 md:grid-cols-3">
            {steps.map((s) => (
              <div
                key={s.n}
                className="relative rounded-2xl border border-fd-border bg-fd-card/50 p-7"
              >
                <div className="font-mono text-xs font-bold text-fd-primary">
                  {s.n}
                </div>
                <h3 className="mt-3 text-lg font-semibold">{s.name}</h3>
                <p className="mt-3 text-sm leading-relaxed text-fd-muted-foreground">
                  {s.body}
                </p>
                <div className="mt-5 overflow-x-auto rounded-lg border border-fd-border/70 bg-[#0b0c10] px-3 py-2.5 font-mono text-xs text-[#d4d7de]">
                  {s.code}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-8 text-center">
            <Link
              href="/docs/getting-started/quickstart"
              className="inline-flex font-semibold text-fd-primary hover:underline"
            >
              Wire it up in the quickstart →
            </Link>
          </div>
        </div>
      </section>

      {/* ── Strategies ───────────────────────────────────────────────── */}
      <section className="border-t border-fd-border/70 px-6 py-24">
        <div className="mx-auto max-w-6xl">
          <div className="mx-auto max-w-2xl text-center">
            <Kicker>Three strategies, one contract</Kicker>
            <h2 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">
              Pick your isolation. Keep your code.
            </h2>
            <p className="mt-5 text-lg text-fd-muted-foreground">
              The same tenant contract drives all three. Every supported cell is
              backed by a two-tenant adversarial test on a real database.
            </p>
          </div>
          <div className="mt-14 grid gap-5 md:grid-cols-3">
            {strategies.map((s) => (
              <div
                key={s.n}
                className="group relative rounded-2xl border border-fd-border bg-fd-card/50 p-7 transition hover:border-fd-primary/40 hover:bg-fd-card"
              >
                <div className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-[#6d64ff] to-[#ec4899] bg-clip-text font-mono text-xs font-bold text-transparent">
                  {s.n} · {s.tag}
                </div>
                <h3 className="mt-4 text-xl font-semibold">{s.name}</h3>
                <p className="mt-3 text-sm leading-relaxed text-fd-muted-foreground">
                  {s.body}
                </p>
                <div className="mt-5 border-t border-fd-border/70 pt-4 font-mono text-xs text-fd-muted-foreground">
                  {s.who}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-8 text-center">
            <Link
              href="/docs/concepts/capability-matrix"
              className="inline-flex font-semibold text-fd-primary hover:underline"
            >
              See the full capability matrix →
            </Link>
          </div>
        </div>
      </section>

      {/* ── Guarantees ───────────────────────────────────────────────── */}
      <section className="border-t border-fd-border/70 px-6 py-24">
        <div className="mx-auto max-w-6xl">
          <div className="mx-auto max-w-2xl text-center">
            <Kicker>Honesty over faith</Kicker>
            <h2 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">
              Guarantees, not vibes
            </h2>
          </div>
          <div className="mt-14 grid gap-px overflow-hidden rounded-2xl border border-fd-border bg-fd-border sm:grid-cols-2">
            {guarantees.map((g) => (
              <div key={g.title} className="bg-fd-card p-7">
                <div className="flex size-9 items-center justify-center rounded-lg bg-gradient-to-br from-[#6d64ff]/20 to-[#ec4899]/20 text-fd-primary">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                    <path
                      d="M20 6 9 17l-5-5"
                      stroke="currentColor"
                      strokeWidth="2.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
                <h3 className="mt-4 text-lg font-semibold">{g.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-fd-muted-foreground">
                  {g.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden border-t border-fd-border/70 px-6 py-28 text-center">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 mx-auto h-[420px] max-w-4xl opacity-60 blur-3xl"
          style={{
            background:
              "radial-gradient(45% 60% at 50% 100%, rgba(109,100,255,.3), transparent 70%), radial-gradient(35% 50% at 70% 90%, rgba(236,72,153,.2), transparent 70%)",
          }}
        />
        <div className="mx-auto max-w-2xl">
          <h2 className="text-4xl font-bold tracking-tight sm:text-5xl">
            Own one thing, <span className="tj-grad">completely</span>.
          </h2>
          <p className="mt-5 text-lg text-fd-muted-foreground">
            Tenant identity is not authorization - your app still owns auth.
            TenancyJS makes sure one tenant&rsquo;s data never becomes
            another&rsquo;s.
          </p>
          <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
            <Link href="/docs" className={primaryBtn}>
              Read the docs →
            </Link>
            <a
              href="https://www.npmjs.com/package/tenancyjs-core"
              className={ghostBtn}
            >
              View on npm
            </a>
          </div>
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}

function SiteFooter() {
  return (
    <footer className="border-t border-fd-border px-6 py-12">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-6 sm:flex-row">
        <div className="text-center sm:text-left">
          <div className="flex items-center justify-center gap-2 sm:justify-start">
            <span className="size-4 rounded bg-gradient-to-br from-[#6d64ff] to-[#ec4899]" />
            <span className="font-semibold">TenancyJS</span>
          </div>
          <p className="mt-2 text-sm text-fd-muted-foreground">
            MIT-licensed · built by{" "}
            <a
              href="https://x.com/imkarthicck"
              className="font-medium text-fd-foreground hover:text-fd-primary"
            >
              @imkarthicck
            </a>
          </p>
        </div>

        <nav className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-fd-muted-foreground">
          <a
            href="https://github.com/Karthick-Ramachandran/TenancyJS"
            className="hover:text-fd-primary"
          >
            GitHub repo
          </a>
          <a
            href="https://www.npmjs.com/package/tenancyjs-core"
            className="hover:text-fd-primary"
          >
            npm
          </a>
          <a
            href="https://github.com/karthick-Ramachandran"
            className="hover:text-fd-primary"
          >
            GitHub
          </a>
          <a href="https://x.com/imkarthicck" className="hover:text-fd-primary">
            X / Twitter
          </a>
          <a
            href="https://fumadocs.dev"
            className="hover:text-fd-primary"
            rel="noreferrer"
          >
            Built with Fumadocs
          </a>
        </nav>
      </div>
    </footer>
  );
}
