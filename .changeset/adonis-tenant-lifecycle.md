---
"@tenancyjs/integration-adonis": minor
---

Add the fail-closed AdonisJS 7 integration: typed `defineAdonisTenancyConfig`, a service provider that
registers the tenant middleware and validates the Lucid isolation policy before serving traffic, and a
tenant-route middleware that resolves once and runs each request inside tenant context and the Lucid
managed transaction with sanitized 400/404/500 failure mapping and no central fallback.
