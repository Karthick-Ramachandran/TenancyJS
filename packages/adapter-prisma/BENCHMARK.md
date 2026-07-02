# Prisma Adapter Policy Benchmark

The benchmark isolates synchronous in-memory policy work: model/operation classification, context
lookup, relation guard, and tenant-filter transformation. It intentionally excludes Prisma Client,
driver, network, and database latency so changes to the adapter policy can be compared directly.

Run it with:

```bash
pnpm benchmark:prisma
```

Override the per-sample iteration count with `TENANCY_BENCHMARK_ITERATIONS` (minimum 10,000). The
script warms the policy, runs seven samples, and reports median plus p95 nanoseconds per operation. No
pass/fail threshold is set until CI baselines exist across supported Node releases.

## Initial Local Baseline

Measured 2026-07-02 on Node.js 26.0.0, 1,000,000 iterations per sample, seven samples:

| Measurement                      |       Result |
| -------------------------------- | -----------: |
| Median no-op baseline            |   4.60 ns/op |
| Median tenant policy             | 275.11 ns/op |
| Median estimated policy overhead | 270.51 ns/op |
| p95 tenant policy                | 327.73 ns/op |

This is an engineering baseline, not a production latency claim. Hardware, Node/V8, operation shape,
model relation metadata, and JIT state affect the number. Real request latency remains dominated by
ORM/driver/database work and must be measured in application benchmarks.
