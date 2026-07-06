// Emit a CommonJS build (dist/cjs) for every published library package, alongside
// the ESM + type output that `tsc -b` already produced in dist/. This is what lets
// CommonJS consumers (a default `nest new` project, older toolchains) `require()`
// TenancyJS without converting their project to ESM. See ADR-0034.
//
// esbuild transpiles the clean ESM source to CJS and leaves every bare import
// external (a `require(...)`), so each package still resolves its workspace and
// peer dependencies at runtime through their own `exports` maps. tsc remains the
// single source of truth for type-checking and `.d.ts`; this only adds runtime CJS.
import { build } from "esbuild";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const packagesDir = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "packages",
);

// The CLI is intentionally ESM-only: it ships as a `bin` executed directly by
// Node (its entry uses top-level await, which CommonJS cannot express), and no
// consumer `require()`s it. Everything else is dual-built.
const ESM_ONLY = new Set(["tenancyjs-cli"]);

// Map an exports subpath ("." / "./edge") to its source entry (src/index.ts / src/edge.ts).
function entryForSubpath(subpath) {
  const name = subpath === "." ? "index" : subpath.replace(/^\.\//u, "");
  return `src/${name}.ts`;
}

const dirents = await readdir(packagesDir, { withFileTypes: true });
let built = 0;

for (const dirent of dirents) {
  if (!dirent.isDirectory()) continue;
  const packageDir = join(packagesDir, dirent.name);
  const manifestPath = join(packageDir, "package.json");
  let manifest;
  try {
    manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  } catch {
    continue; // no package.json
  }
  if (manifest.private || ESM_ONLY.has(manifest.name) || !manifest.exports)
    continue;

  const entryPoints = Object.keys(manifest.exports).map((subpath) =>
    join(packageDir, entryForSubpath(subpath)),
  );

  await build({
    entryPoints,
    outdir: join(packageDir, "dist", "cjs"),
    format: "cjs",
    platform: "node",
    target: "node24",
    bundle: true,
    // Keep every bare import (workspace + peer deps) as a runtime `require(...)`;
    // only this package's own relative modules are inlined into each entry.
    packages: "external",
    logLevel: "warning",
  });

  // Mark dist/cjs as CommonJS so Node treats these .js files as CJS even though the
  // package root is `"type": "module"`.
  await writeFile(
    join(packageDir, "dist", "cjs", "package.json"),
    `${JSON.stringify({ type: "commonjs" }, null, 2)}\n`,
  );
  built += 1;
}

process.stdout.write(
  `build-cjs: emitted CommonJS output for ${built} package(s).\n`,
);
