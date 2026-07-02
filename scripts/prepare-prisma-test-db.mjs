import process from "node:process";
import { spawnSync } from "node:child_process";

if (process.env.TEST_DATABASE_URL === undefined) {
  process.stdout.write(
    "Prisma PostgreSQL setup skipped: TEST_DATABASE_URL is not configured.\n",
  );
  process.exit(0);
}

const result = spawnSync(
  "pnpm",
  ["--filter", "@tenancyjs/adapter-prisma", "prisma:test:push"],
  {
    cwd: process.cwd(),
    encoding: "utf8",
    env: process.env,
    stdio: "pipe",
  },
);

if (result.status !== 0) {
  throw new Error(
    result.stderr || result.stdout || "Prisma test database setup failed.",
  );
}

process.stdout.write("Prisma PostgreSQL test schema is ready.\n");
