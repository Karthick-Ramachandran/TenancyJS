# `tenancyjs-integration-nest`

Fail-closed NestJS 11 request lifecycle integration for TenancyJS on Node 24.

`TenancyModule` resolves marked tenant routes in a guard, stores the immutable result privately, and
opens the canonical tenant plus optional ORM scope in an interceptor for the handler Observable
lifetime. It supports Nest's Express and Fastify platforms without importing either platform package.

```ts
@Module({
  imports: [
    TenancyModule.forRoot({ manager, resolver, executor: typeormTenancy }),
  ],
})
export class AppModule {}

@TenantRoute()
@Controller("posts")
export class PostsController {}
```

Register this module before application authorization guards that need the resolved tenant. Those
guards may inject `NestTenantResolutionStore` and call `get(request)`; `TenancyManager` context begins
in the interceptor, after all guards. Unmarked routes are neither tenant nor central routes. Resolution
failures map to sanitized HTTP errors and never enter central context.

Exception filters run after an errored interceptor and must not depend on tenant database context.
Work spawned after the handler Observable settles is outside the supported lifecycle.
