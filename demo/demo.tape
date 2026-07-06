# Renders demo.gif for the README.
# Prereqs: `npm install` in this directory and a PostgreSQL reachable at
# DATABASE_URL (defaults to postgres://postgres:postgres@localhost:5432/postgres).
# Render with:  vhs demo.tape
Output demo.gif

Set Shell bash
Set FontSize 17
Set Width 1280
Set Height 940
Set Padding 22
Set Theme "Dracula"
Set TypingSpeed 30ms

Hide
Type "export DATABASE_URL=${DATABASE_URL:-postgres://postgres:postgres@localhost:5432/postgres}" Enter
Type "clear" Enter
Show

Type "# TenancyJS: Express + Sequelize, database-per-tenant" Enter
Sleep 700ms
Type "node provision.mjs" Enter
Sleep 2500ms

Type "node demo.mjs" Enter
Sleep 5s

Type "# Membership: a spoofed x-tenant-id is refused (sanitized 404)" Enter
Sleep 600ms
Type "node membership.mjs" Enter
Sleep 4s

Type "# Prove it in CI with the leak test" Enter
Sleep 600ms
Type "npx tenancy test:leak --test-file tenancy.leak.test.mjs" Enter
Sleep 6s
