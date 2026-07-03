# AdonisJS v6 → v7 Compatibility Checklist

Durable capture of the concrete v6→v7 deltas that ADR-0014 (Decision 10) requires for TenancyJS
AdonisJS templates, scaffolds, and the reference example. Source: the official upgrade procedure at
`https://docs.adonisjs.com/v6-to-v7`. This file exists because the workspace runs `@adonisjs/core@7.3.4`
/ `@adonisjs/lucid@22.4.2` while the public starter kits and tooling are still v6 — generated files
must use **v7 names and layout**, verified against this list, not copied blindly from a v6 template.

## Runtime And Tooling

- Node.js `>=24` (matches ADR-0013). TypeScript 5.9/6.0. ESLint 10. Vite 7.
- TypeScript execution: replace `ts-node` / `ts-node-maintained` with `@poppinss/ts-exec`; remove
  `@swc/core`. In `ace.js`: `import '@poppinss/ts-exec'` (not `ts-node-maintained/register/esm`).
- `youch` is no longer bundled — declare it as a dev dependency.
- Upgrade all `@adonisjs/*`, `@vinejs/vine`, `edge.js`, `@japa/plugin-adonisjs`, `vite`, `argon2`.

## adonisrc.ts

- New required `hooks` block, minimum: `hooks: { init: [indexEntities()] }`
  (`indexEntities` is imported from `@adonisjs/core`).
- Hook renames: `onSourceFileChanged`→`fileChanged`, `onDevServerStarted`→`devServerStarted`,
  `onBuildCompleted`→`buildFinished`, `onBuildStarting`→`buildStarting`.
- Test globs use brace expansion, not parenthesized alternation:
  `**/*.spec(.ts|.js)` → `**/*.spec.{ts,js}`.
- Remove the `assetsBundler` property.

## Encryption

- Remove `export const appKey = env.get('APP_KEY')` from `config/app.ts`.
- Add `config/encryption.ts`:
  `defineConfig({ default: 'legacy', list: { legacy: drivers.legacy({ keys: [env.get('APP_KEY')] }) } })`
  from `@adonisjs/core/encryption`.

## HTTP Type Names

- `Request` → `HttpRequest` and `Response` → `HttpResponse` (imports from `@adonisjs/core/http`),
  including module augmentation `interface Request/Response` → `interface HttpRequest/HttpResponse`
  and `Request.macro()` / `Response.macro()` → `HttpRequest.macro()` / `HttpResponse.macro()`.

## URL Building And Helpers

- `router.makeUrl()` / `makeSignedUrl()` → `urlFor()` from `@adonisjs/core/services/url_builder`
  (`route()` in Edge → `urlFor()`).
- Removed helpers: `getDirname()`→`import.meta.dirname`, `getFilename()`→`import.meta.filename`,
  `slash()`→`stringHelpers.toUnixSlash()`, `cuid()`/`isCuid()`→UUIDs, `joinToURL()`→`new URL()`,
  `parseImports()`→the `parse-imports` package.

## package.json `imports` Subpaths

- Add `#generated/* -> ./.adonisjs/server/*.js`, `#transformers/* -> ./app/transformers/*.js`,
  `#database/* -> ./database/*.js` to the existing v6 alias set (`#controllers/*`, `#models/*`,
  `#middleware/*`, `#providers/*`, `#start/*`, `#config/*`, `#tests/*`, …).

## Behavioral Changes To Respect

- Shutdown hooks run in **reverse** order (matches our provider `shutdown` expectations).
- `request.all()` merges multipart files and fields.
- Status pages skip rendering for JSON/API requests (per `Accept` header) — relevant to sanitized
  error responses.
- Flash messages: `flashMessages.get('errors.')` → `flashMessages.get('inputErrorsBag.')`.

## Verification Rule

Any TenancyJS-generated AdonisJS file (reference example, CLI `init` templates, fixtures) must use the
v7 names/layout above. Never run the upstream npm `--force` upgrade command against this monorepo
(ADR-0014 Decision 10). Cross-check every scaffold file against the **installed** `@adonisjs/core@7.3.4`
API; the installed package is the source of truth on any conflict with this summary.
