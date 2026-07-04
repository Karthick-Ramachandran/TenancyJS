import process from "node:process";
import { spawnSync } from "node:child_process";

function push(packageName, script, label) {
  const result = spawnSync("pnpm", ["--filter", packageName, script], {
    cwd: process.cwd(),
    encoding: "utf8",
    env: process.env,
    stdio: "pipe",
  });

  if (result.status !== 0) {
    throw new Error(
      result.stderr ||
        result.stdout ||
        `Prisma test database setup failed for ${packageName} (${label}).`,
    );
  }
}

if (process.env.TEST_DATABASE_URL === undefined) {
  process.stdout.write(
    "Prisma PostgreSQL setup skipped: TEST_DATABASE_URL is not configured.\n",
  );
} else {
  push("@tenancyjs/adapter-prisma", "prisma:test:push", "postgres");
  process.stdout.write("Prisma PostgreSQL test schema is ready.\n");
}

if (process.env.MYSQL_TEST_DATABASE_URL === undefined) {
  process.stdout.write(
    "Prisma MySQL setup skipped: MYSQL_TEST_DATABASE_URL is not configured.\n",
  );
} else {
  push("@tenancyjs/adapter-prisma", "prisma:test:push:mysql", "mysql");
  process.stdout.write("Prisma MySQL test schema is ready.\n");
}
