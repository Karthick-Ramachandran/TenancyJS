import process from "node:process";

import { TenancyManager } from "../../core/dist/index.js";
import {
  applyPrismaTenantPolicy,
  definePrismaTenancyConfig,
} from "../dist/index.js";

const iterations = parseIterations(process.env.TENANCY_BENCHMARK_ITERATIONS);
const samples = 7;
const manager = new TenancyManager();
const config = definePrismaTenancyConfig({
  manager,
  tenantModels: { Post: { relationFields: ["comments"] } },
});
const args = Object.freeze({ where: Object.freeze({ published: true }) });

await manager.runWithTenant({ id: "benchmark-tenant" }, () => {
  for (let index = 0; index < 10_000; index += 1) {
    applyPrismaTenantPolicy(config, "Post", "findMany", args);
  }

  const baselineSamples = [];
  const policySamples = [];
  for (let sample = 0; sample < samples; sample += 1) {
    baselineSamples.push(measure(iterations, () => args.where.published));
    policySamples.push(
      measure(iterations, () =>
        applyPrismaTenantPolicy(config, "Post", "findMany", args),
      ),
    );
  }
  const baseline = median(baselineSamples);
  const policy = median(policySamples);
  const report = {
    node: process.version,
    iterations,
    samples,
    medianBaselineNanosecondsPerOperation: round(baseline),
    medianPolicyNanosecondsPerOperation: round(policy),
    medianEstimatedPolicyOverheadNanoseconds: round(
      Math.max(0, policy - baseline),
    ),
    p95PolicyNanosecondsPerOperation: round(percentile(policySamples, 0.95)),
    scope:
      "Synchronous in-memory policy only; excludes Prisma and database latency.",
  };
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
});

function measure(count, operation) {
  let observed;
  const started = process.hrtime.bigint();
  for (let index = 0; index < count; index += 1) observed = operation();
  const elapsed = process.hrtime.bigint() - started;
  if (observed === undefined)
    throw new Error("Benchmark operation was not observed.");
  return Number(elapsed) / count;
}

function parseIterations(raw) {
  if (raw === undefined) return 1_000_000;
  const parsed = Number(raw);
  if (!Number.isSafeInteger(parsed) || parsed < 10_000) {
    throw new TypeError(
      "TENANCY_BENCHMARK_ITERATIONS must be an integer >= 10000.",
    );
  }
  return parsed;
}

function round(value) {
  return Math.round(value * 100) / 100;
}

function median(values) {
  return percentile(values, 0.5);
}

function percentile(values, quantile) {
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil(sorted.length * quantile) - 1),
  );
  return sorted[index];
}
