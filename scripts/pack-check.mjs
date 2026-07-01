import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import process from "node:process";

const destination = await mkdtemp(join(tmpdir(), "tenancyjs-pack-"));

try {
  const result = spawnSync(
    "pnpm",
    ["--filter", "@tenancyjs/core", "pack", "--pack-destination", destination],
    { encoding: "utf8", stdio: "pipe" },
  );

  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || "pnpm pack failed");
  }

  const archives = (await readdir(destination)).filter((file) =>
    file.endsWith(".tgz"),
  );
  if (archives.length !== 1) {
    throw new Error(`Expected one package archive, found ${archives.length}`);
  }

  process.stdout.write(`Package archive verified: ${archives[0]}\n`);
} finally {
  await rm(destination, { recursive: true, force: true });
}
