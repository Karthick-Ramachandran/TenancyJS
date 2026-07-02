# Architecture Impact: Safe Cli Foundation

## Affected Modules

- New `cli` module and published `@tenancyjs/cli` package with `tenancy` binary.
- No runtime changes to core, identifiers, Express integration, or Prisma adapter.
- Root package/consumer/test configuration gains CLI build and binary coverage.

## ADR Impact

- ADR-0003 already accepts typed plans, safe writes, local argument-array execution, and native-tool
  delegation. No new ADR is required for this narrowed implementation.

## Security Impact

- Adds intentional local project reads/writes and local child-process execution under ADR-0003.
- Reads package/source files but explicitly skips `.env`, VCS, dependencies, build output, and binaries.
- Writes only fixed new text files after realpath containment and symlink preflight; no overwrite mode.
- Executes only an explicit project-local JavaScript test through `process.execPath`, never a shell or
  remote package runner.
- Adds no CLI-owned runtime network, telemetry, cloud, MCP, AI, auth, secret-store, or database behavior.
  The explicit trusted leak-test file is user code, not a sandbox, and may use allowlisted database/test
  environment to perform its intended isolation test.

## Dependencies And Templates

- Runtime uses Node built-ins only; no CLI parsing, glob, template, or process dependency is added.
- Initial templates target accepted Express/Prisma public APIs and contain explicit application-owned
  tenant-store/model-classification placeholders.
