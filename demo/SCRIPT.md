# Video script - TenancyJS in ~90 seconds

Stack on screen: Express + Sequelize, **database-per-tenant**, real PostgreSQL.
Record the terminal (and optionally your editor for the wiring beat). The GIF
(`demo.gif`) is the silent version of beats 2-5; this script is the narrated cut.

Prep (off camera): `npm install`, PostgreSQL running,
`export DATABASE_URL=postgres://postgres:postgres@localhost:5432/postgres`,
`node provision.mjs` once so beat 2 is instant. Clear the screen.

---

## Beat 0 - Hook (0:00-0:10)

> "Multi-tenancy is easy to get wrong in a way you only find out about in a
> breach. Here's a Node stack where one tenant physically cannot read another's
> data - and where the library refuses to run if it can't guarantee that."

Show the one-liner install:

```
npm install tenancyjs-core tenancyjs-adapter-sequelize tenancyjs-integration-express
```

## Beat 1 - The wiring (0:10-0:30)

Open `shared.mjs`. Point at the adapter:

> "database-per-tenant. Each tenant hands back its own Sequelize connection.
> There's no shared table to leak through."

Open `server.mjs`. Point at the chain:

> "The tenant id comes from a header - which the client controls. So the chain
> won't even construct without a membership decision. Here: the logged-in user
> must be a member of the tenant. Resolution is not authorization."

## Beat 2 - Isolation (0:30-0:50)

```
node demo.mjs
```

> "Both tenants write a post with the same id, one. Each reads back only its own
> row. Now watch the important part: if I forget the tenant scope - a bug that
> normally leaks everything - TenancyJS throws instead. Fail-closed. And even raw
> SQL through the escape hatch stays inside that tenant's own database."

## Beat 3 - The spoof (0:50-1:05)

```
node membership.mjs
```

> "Same logged-in user, a member of acme. Ask for acme: 200. Now spoof the header
> to globex: 404 - the exact same response as a tenant that doesn't exist. No
> cross-tenant access, and no way to even enumerate who else is a tenant."

## Beat 4 - Prove it (1:05-1:20)

```
npx tenancy test:leak --test-file tenancy.leak.test.mjs
```

> "And this isn't a claim - it's a test. The same isolation checks run in CI and
> fail the build if a tenant can ever see another's data."

## Beat 5 - Close (1:20-1:30)

> "Fail-closed multi-tenancy for Node - Express, Next, Nest, Adonis, and every
> major ORM. Row-level, schema, or database-per-tenant. It's on npm as
> tenancyjs-core. Links below."

On screen: `github.com/Karthick-Ramachandran/TenancyJS` and the docs URL.
