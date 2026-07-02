import { mkdir, mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import process from "node:process";

const destination = await mkdtemp(join(tmpdir(), "tenancyjs-pack-"));
const packages = [
  { name: "@tenancyjs/core", directory: "core" },
  { name: "@tenancyjs/adapter-prisma", directory: "adapter-prisma" },
  { name: "@tenancyjs/identifiers", directory: "identifiers" },
  { name: "@tenancyjs/testing", directory: "testing" },
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
    if (package_.name === "@tenancyjs/adapter-prisma") {
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
        'import { TenancyManager, defineConfig } from "@tenancyjs/core";',
        'import { PRISMA_ADAPTER_CAPABILITIES, createPrismaAdapter } from "@tenancyjs/adapter-prisma";',
        'import { HeaderTenantResolver, TenantResolutionChain } from "@tenancyjs/identifiers";',
        'import { createCoreTenancyContract, createTenantFixture } from "@tenancyjs/testing";',
        "const manager = new TenancyManager();",
        "const prismaAdapter = createPrismaAdapter({ manager, tenantModels: { Post: {} } });",
        'const tenantId = await manager.runWithTenant({ id: "consumer" }, () => manager.getTenantOrFail().id);',
        'const fixture = createTenantFixture({ id: "consumer" });',
        'const chain = new TenantResolutionChain({ resolvers: [new HeaderTenantResolver()], store: { find: async () => [{ tenant: fixture, status: "active" }] } });',
        'const outcome = await chain.resolve({ headers: { "x-tenant-id": "consumer" } });',
        "for (const contractCase of createCoreTenancyContract()) await contractCase.run();",
        'if (tenantId !== "consumer" || outcome.status !== "resolved" || defineConfig({ strategy: "rowLevel" }).strategy !== "rowLevel" || prismaAdapter.name !== "prisma" || PRISMA_ADAPTER_CAPABILITIES.rawQueries !== "rejected") process.exit(1);',
      ].join("\n"),
    ],
    consumer,
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
