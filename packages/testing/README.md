# `tenancyjs-testing`

Runner-neutral fixtures and contract cases for TenancyJS.

> **New to TenancyJS? [Start with the docs →](https://tenancyjs.pages.dev/docs/getting-started/installation)** — install, the `tenancyjs-cli` CLI, and how this package fits with an adapter + integration.

```ts
for (const contractCase of createCoreTenancyContract()) {
  test(contractCase.name, contractCase.run);
}
```

The package does not depend on Vitest, Jest, or a framework. Contract cases throw
`TenancyContractAssertionError` when an invariant fails.

Adapter packages provide a `RowLevelAdapterContractHarness` and run the shared isolation contract:

```ts
for (const contractCase of createRowLevelAdapterContract(createHarness)) {
  test(contractCase.name, contractCase.run);
}
```

The contract proves two-tenant reads/counts, create-field enforcement, bulk update/delete isolation,
missing-context failure, explicit central scope, and transaction rollback.
