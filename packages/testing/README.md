# `@tenancyjs/testing`

Runner-neutral fixtures and contract cases for TenancyJS.

```ts
for (const contractCase of createCoreTenancyContract()) {
  test(contractCase.name, contractCase.run);
}
```

The package does not depend on Vitest, Jest, or a framework. Contract cases throw
`TenancyContractAssertionError` when an invariant fails.
