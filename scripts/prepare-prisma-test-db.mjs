import process from "node:process";
import { spawnSync } from "node:child_process";

if (process.env.TEST_DATABASE_URL === undefined) {
  process.stdout.write(
    "Prisma PostgreSQL setup skipped: TEST_DATABASE_URL is not configured.\n",
  );
  process.exit(0);
}

for (const packageName of ["@tenancyjs/adapter-prisma"]) {
  const result = spawnSync(
    "pnpm",
    ["--filter", packageName, "prisma:test:push"],
    {
      cwd: process.cwd(),
      encoding: "utf8",
      env: process.env,
      stdio: "pipe",
    },
  );

  if (result.status !== 0) {
    throw new Error(
      result.stderr ||
        result.stdout ||
        `Prisma test database setup failed for ${packageName}.`,
    );
  }
}

process.stdout.write("Prisma PostgreSQL test schemas are ready.\n");
