import {
  loadTenancyRuntime,
  type LoadRuntimeOptions,
} from "./runtime-loader.js";
import type { LoadedTenancyRuntime } from "./runtime-loader.js";

/**
 * The command engine for operational commands (ADR-0027): load the host
 * runtime, run the command against it, then dispose — always. If the command
 * fails, its error is preserved and any disposal error is swallowed so the real
 * cause is never masked; if the command succeeds, a disposal failure surfaces.
 */
export async function withRuntime<T>(
  options: LoadRuntimeOptions,
  run: (runtime: LoadedTenancyRuntime) => Promise<T>,
): Promise<T> {
  const runtime = await loadTenancyRuntime(options);
  let result: T;
  try {
    result = await run(runtime);
  } catch (error) {
    // Command failed: dispose best-effort so a disposal error never masks the
    // real cause, then rethrow the command's error.
    await disposeQuietly(runtime);
    throw error;
  }
  // Command succeeded: dispose and let any disposal error surface.
  await runtime.dispose();
  return result;
}

async function disposeQuietly(runtime: LoadedTenancyRuntime): Promise<void> {
  try {
    await runtime.dispose();
  } catch {
    // Intentionally swallowed — the command's own error is the one that matters.
  }
}
