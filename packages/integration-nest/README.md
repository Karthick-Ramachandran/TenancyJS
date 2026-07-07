# `tenancyjs-integration-nest`

Fail-closed NestJS 11 request lifecycle integration for TenancyJS on Node 24.

> **New to TenancyJS? [Start with the docs →](https://tenancyjs.pages.dev/docs/getting-started/installation)** — install, the `tenancyjs-cli` CLI, and how this package fits with an adapter + integration.

`TenancyModule` resolves marked tenant routes in a guard, stores the immutable result privately, and
opens the canonical tenant plus optional ORM scope in an interceptor for the handler Observable
lifetime. It supports Nest's Express and Fastify platforms without importing either platform package.

```ts
@Module({
  imports: [TenancyModule.forRoot({ manager, resolver })],
})
export class AppModule {}

@Controller("posts")
export class PostsController {
  @Get()
  @TenantRoute()
  list() {
    return typeormTenancy.run((client) =>
      client.repository(Post).findBy({ status: "open" }),
    );
  }
}
```

Register this module before application authorization guards that need the resolved tenant. Those
guards may inject `NestTenantResolutionStore` and call `get(request)`; `TenancyManager` context begins
in the interceptor, after all guards. Unmarked routes are neither tenant nor central routes. Resolution
failures map to sanitized HTTP errors and never enter central context.

The optional `executor` is appropriate only when its scoped resource is already discoverable by
application operations. Callback-only facades such as TypeORM and Sequelize should be invoked directly
inside the marked handler; passing one as `executor` keeps its callback open but does not inject the
protected callback client into Nest providers.

Exception filters run after an errored interceptor and must not depend on tenant database context.
Work spawned after the handler Observable settles is outside the supported lifecycle.
