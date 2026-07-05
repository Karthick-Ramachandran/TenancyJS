import { mkdir, mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import process from "node:process";

const destination = await mkdtemp(join(tmpdir(), "tenancyjs-pack-"));
const packages = [
  { name: "tenancyjs-adapter-shared", directory: "adapter-shared" },
  { name: "tenancyjs-adapter-knex", directory: "adapter-knex" },
  { name: "tenancyjs-adapter-lucid", directory: "adapter-lucid" },
  { name: "tenancyjs-adapter-mongoose", directory: "adapter-mongoose" },
  { name: "tenancyjs-core", directory: "core" },
  { name: "tenancyjs-adapter-prisma", directory: "adapter-prisma" },
  { name: "tenancyjs-adapter-sequelize", directory: "adapter-sequelize" },
  { name: "tenancyjs-adapter-typeorm", directory: "adapter-typeorm" },
  { name: "tenancyjs-cli", directory: "cli" },
  { name: "tenancyjs-identifiers", directory: "identifiers" },
  { name: "tenancyjs-integration-adonis", directory: "integration-adonis" },
  { name: "tenancyjs-integration-express", directory: "integration-express" },
  { name: "tenancyjs-integration-nest", directory: "integration-nest" },
  { name: "tenancyjs-integration-next", directory: "integration-next" },
  { name: "tenancyjs-testing", directory: "testing" },
];

try {
  for (const package_ of packages) {
    run(
      "pnpm",
      ["--filter", package_.name, "pack", "--pack-destination", destination],
      process.cwd(),
    );
  }

  const archives = (await readdir(destination)).filter((file) =>
    file.endsWith(".tgz"),
  );
  if (archives.length !== packages.length) {
    throw new Error(
      `Expected ${packages.length} package archives, found ${archives.length}`,
    );
  }

  const consumer = join(destination, "consumer");
  const npmEnv = npmEnvironment(join(destination, "npm-cache"));
  for (const package_ of packages) {
    const packageMetadata = JSON.parse(
      run(
        "npm",
        ["pack", "--dry-run", "--json", "--ignore-scripts"],
        join(process.cwd(), "packages", package_.directory),
        npmEnv,
      ),
    );
    const packedFiles = packageMetadata[0]?.files ?? [];
    const forbiddenFiles = packedFiles
      .map(({ path }) => path)
      .filter(
        (path) =>
          path.endsWith(".tsbuildinfo") ||
          path.startsWith("src/") ||
          path.startsWith("test/"),
      );
    if (forbiddenFiles.length > 0) {
      throw new Error(
        `${package_.name} contains forbidden files: ${forbiddenFiles.join(", ")}`,
      );
    }
    if (package_.name === "tenancyjs-adapter-prisma") {
      const paths = new Set(packedFiles.map(({ path }) => path));
      for (const required of ["README.md", "MIGRATION.md", "BENCHMARK.md"]) {
        if (!paths.has(required)) {
          throw new Error(`${package_.name} is missing ${required}`);
        }
      }
    }
  }

  await mkdir(consumer);
  await writeFile(
    join(consumer, "package.json"),
    JSON.stringify({ name: "tenancyjs-package-consumer", private: true }),
  );

  run(
    "npm",
    [
      "install",
      "--ignore-scripts",
      "--no-audit",
      "--no-fund",
      ...archives.map((archive) => join(destination, archive)),
    ],
    consumer,
    npmEnv,
  );
  run(
    process.execPath,
    [
      "--input-type=module",
      "--eval",
      [
        'import { TenancyManager, defineConfig } from "tenancyjs-core";',
        'import { assertSqlIdentifier } from "tenancyjs-adapter-shared";',
        'import { KNEX_ADAPTER_CAPABILITIES, createKnexTenancy } from "tenancyjs-adapter-knex";',
        'import { LUCID_ADAPTER_CAPABILITIES, createLucidTenancy } from "tenancyjs-adapter-lucid";',
        'import { PRISMA_ADAPTER_CAPABILITIES, createPrismaAdapter, createPrismaDatabaseTenancy, createPrismaSchemaTenancy } from "tenancyjs-adapter-prisma";',
        'import { MONGOOSE_ADAPTER_CAPABILITIES, createMongooseTenancy } from "tenancyjs-adapter-mongoose";',
        'import { SEQUELIZE_ADAPTER_CAPABILITIES, createSequelizeTenancy } from "tenancyjs-adapter-sequelize";',
        'import { TYPEORM_ADAPTER_CAPABILITIES, createTypeOrmTenancy } from "tenancyjs-adapter-typeorm";',
        'import { redactText } from "tenancyjs-cli";',
        'import { HeaderTenantResolver, TenantResolutionChain } from "tenancyjs-identifiers";',
        'import { createExpressTenancyMiddleware } from "tenancyjs-integration-express";',
        'import { TenancyMiddleware, TenancyProvider, defineAdonisTenancyConfig } from "tenancyjs-integration-adonis";',
        'import { createNextTenancy } from "tenancyjs-integration-next";',
        'import { TenancyModule, TenantRoute } from "tenancyjs-integration-nest";',
        'import { createNextTenantHint } from "tenancyjs-integration-next/edge";',
        'import { createCoreTenancyContract, createTenantFixture } from "tenancyjs-testing";',
        "const manager = new TenancyManager();",
        "const prismaAdapter = createPrismaAdapter({ manager, tenantModels: { Post: {} } });",
        'const routedClient = { kind: "consumer" };',
        "const schemaTenancy = createPrismaSchemaTenancy({ manager, schema: (tenant) => ({ key: `schema:${tenant.id}`, create: () => routedClient }), disconnect: () => undefined });",
        "const databaseTenancy = createPrismaDatabaseTenancy({ manager, connection: (tenant) => ({ key: `database:${tenant.id}`, create: () => routedClient }), disconnect: () => undefined });",
        'const tenantId = await manager.runWithTenant({ id: "consumer" }, () => manager.getTenantOrFail().id);',
        'const schemaRouted = await manager.runWithTenant({ id: "consumer" }, () => schemaTenancy.run((client) => client === routedClient));',
        'const databaseRouted = await manager.runWithTenant({ id: "consumer" }, () => databaseTenancy.run((client) => client === routedClient));',
        "await schemaTenancy.close();",
        "await databaseTenancy.close();",
        'const fixture = createTenantFixture({ id: "consumer" });',
        'const chain = new TenantResolutionChain({ resolvers: [new HeaderTenantResolver()], store: { find: async () => [{ tenant: fixture, status: "active" }] } });',
        'const outcome = await chain.resolve({ headers: { "x-tenant-id": "consumer" } });',
        "for (const contractCase of createCoreTenancyContract()) await contractCase.run();",
        'if (tenantId !== "consumer" || !schemaRouted || !databaseRouted || assertSqlIdentifier("posts", { label: "Table" }) !== "posts" || outcome.status !== "resolved" || defineConfig({ strategy: "rowLevel" }).strategy !== "rowLevel" || prismaAdapter.name !== "prisma" || PRISMA_ADAPTER_CAPABILITIES.rawQueries !== "rejected" || typeof createKnexTenancy !== "function" || KNEX_ADAPTER_CAPABILITIES.rawQueries !== "rejected" || typeof createLucidTenancy !== "function" || LUCID_ADAPTER_CAPABILITIES.rawQueries !== "rejected" || typeof createMongooseTenancy !== "function" || MONGOOSE_ADAPTER_CAPABILITIES.rawQueries !== "rejected" || typeof createSequelizeTenancy !== "function" || SEQUELIZE_ADAPTER_CAPABILITIES.rawQueries !== "rejected" || typeof createTypeOrmTenancy !== "function" || TYPEORM_ADAPTER_CAPABILITIES.rawQueries !== "rejected" || typeof createExpressTenancyMiddleware !== "function" || typeof defineAdonisTenancyConfig !== "function" || typeof TenancyMiddleware !== "function" || typeof TenancyProvider !== "function" || typeof TenancyModule !== "function" || typeof TenantRoute !== "function" || typeof createNextTenancy !== "function" || createNextTenantHint(new Headers({ "x-tenant-id": "consumer" })) === null || redactText("postgresql://user:pass@localhost/db").includes("pass")) process.exit(1);',
      ].join("\n"),
    ],
    consumer,
  );
  run(
    join(consumer, "node_modules", ".bin", "tenancy"),
    ["--help"],
    consumer,
    npmEnv,
  );

  process.stdout.write(`Package archives verified: ${archives.join(", ")}\n`);
} finally {
  await rm(destination, { recursive: true, force: true });
}

function run(command, arguments_, cwd, env = process.env) {
  const result = spawnSync(command, arguments_, {
    cwd,
    encoding: "utf8",
    env,
    stdio: "pipe",
  });

  if (result.status !== 0) {
    throw new Error(
      result.stderr || result.stdout || `${command} exited without a status`,
    );
  }

  return result.stdout;
}

function npmEnvironment(cache) {
  const env = Object.fromEntries(
    Object.entries(process.env).filter(
      ([name]) => !name.toLowerCase().startsWith("npm_config_"),
    ),
  );
  env.npm_config_cache = cache;
  env.npm_config_update_notifier = "false";
  return env;
}
