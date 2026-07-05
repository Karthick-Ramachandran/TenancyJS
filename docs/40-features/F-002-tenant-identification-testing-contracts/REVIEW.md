# Review: Tenant Identification Testing Contracts

## Status

Complete; no blocking findings.

## Findings

- Architecture: follows ADR-0001 and ADR-0006. Both packages depend only on public core APIs; core does
  not import them and resolvers remain separate from persistence/framework lifecycle.
- Security: precedence fails closed, host/header inputs reject ambiguity and confusion characters,
  ambiguous results omit records, and custom resolver outputs are validated/stamped before lookup.
- Authentication boundary: outcomes identify a tenant only; no API authorizes membership or enters
  central context.
- Conventions: canonical `TenantResolver` is implemented; `TenantResolutionOutcome` and runner-neutral
  `TenancyContractCase` are recorded reusable primitives rather than competing context mechanisms.
- Dependencies: identifiers/testing each have only `tenancyjs-core` at runtime; no test-runner,
  framework, ORM, network, telemetry, file-write, cloud, MCP, or AI dependency was introduced.
- Supply chain: all three positive-glob tarballs exclude source/tests/compiler metadata, install with
  scripts disabled into a fresh consumer, and execute public APIs. Audit reports no vulnerabilities.
- Testing: 68 tests pass with thresholds exceeded; clean frozen-lockfile `pnpm check` and Persist Doctor
  pass. Hosted Node 22/24 CI remains pending push.
- Accepted tradeoffs: IDN conversion is application-owned; only one immediate subdomain is accepted;
  host/header inputs use Node-compatible records rather than the Fetch `Headers` class.
