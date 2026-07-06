"use client";

import Link from "next/link";
import { useState } from "react";

type Framework = {
  readonly key: string;
  readonly label: string;
  readonly prefix: string;
  readonly orms: readonly string[];
};

const FRAMEWORKS: readonly Framework[] = [
  {
    key: "express",
    label: "Express",
    prefix: "express",
    orms: ["prisma", "knex", "typeorm", "sequelize", "drizzle", "mongoose"],
  },
  {
    key: "nextjs",
    label: "Next.js",
    prefix: "nextjs",
    orms: ["prisma", "knex", "typeorm", "sequelize", "drizzle", "mongoose"],
  },
  {
    key: "nestjs",
    label: "NestJS",
    prefix: "nestjs",
    orms: ["prisma", "knex", "typeorm", "sequelize", "drizzle", "mongoose"],
  },
  { key: "adonis", label: "AdonisJS", prefix: "adonis", orms: ["lucid"] },
];

const ORM_LABEL: Record<string, string> = {
  prisma: "Prisma",
  knex: "Knex",
  typeorm: "TypeORM",
  sequelize: "Sequelize",
  drizzle: "Drizzle",
  mongoose: "Mongoose",
  lucid: "Lucid",
};

const selectClass =
  "w-full rounded-md border border-fd-border bg-fd-background px-3 py-2 text-sm text-fd-foreground transition focus:border-fd-primary focus:outline-none disabled:opacity-60";

export function StackPicker() {
  const [fw, setFw] = useState<Framework>(FRAMEWORKS[0]!);
  const [orm, setOrm] = useState<string>(FRAMEWORKS[0]!.orms[0]!);
  const href = `/docs/stacks/${fw.prefix}-${orm}`;

  return (
    <div className="not-prose my-6 rounded-xl border border-fd-border bg-fd-card p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <label className="flex-1">
          <span className="mb-1 block text-xs font-medium text-fd-muted-foreground">
            Framework
          </span>
          <select
            aria-label="Framework"
            className={selectClass}
            value={fw.key}
            onChange={(event) => {
              const next = FRAMEWORKS.find((f) => f.key === event.target.value);
              if (next) {
                setFw(next);
                setOrm(next.orms[0]!);
              }
            }}
          >
            {FRAMEWORKS.map((f) => (
              <option key={f.key} value={f.key}>
                {f.label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex-1">
          <span className="mb-1 block text-xs font-medium text-fd-muted-foreground">
            ORM
          </span>
          <select
            aria-label="ORM"
            className={selectClass}
            value={orm}
            disabled={fw.orms.length === 1}
            onChange={(event) => setOrm(event.target.value)}
          >
            {fw.orms.map((o) => (
              <option key={o} value={o}>
                {ORM_LABEL[o]}
              </option>
            ))}
          </select>
        </label>

        <Link
          href={href}
          className="inline-flex items-center justify-center rounded-md bg-fd-primary px-4 py-2 text-sm font-medium text-fd-primary-foreground transition hover:opacity-90"
        >
          Open setup guide →
        </Link>
      </div>
      <p className="mt-3 text-xs text-fd-muted-foreground">
        {fw.label} + {ORM_LABEL[orm]} — a copy-pasteable setup-agent prompt plus a
        manual walkthrough.
      </p>
    </div>
  );
}
