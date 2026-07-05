---
"tenancyjs-integration-adonis": minor
---

Add the fail-closed AdonisJS 7 integration: typed `defineAdonisTenancyConfig` (accepting the Lucid
tenancy service directly or as a factory resolved after the Lucid provider boots), a service provider
that registers the tenant middleware and validates the Lucid isolation policy in the web environment
before serving traffic, a tenant-route middleware that resolves once and runs each request inside
tenant context and the Lucid managed transaction with sanitized 400/404/500 failure mapping and no
central fallback, and a `withTenant` test helper.
