# `tenancyjs-adapter-sequelize`

Fail-closed stable Sequelize 6 row-level isolation for PostgreSQL 17 and Node 24.

The adapter exposes callback-scoped protected plain-value model facades, not native Sequelize models,
instances, transactions, QueryInterface, or raw queries. Every supported operation receives the
adapter-owned transaction explicitly; no global CLS configuration is required.

The initial surface supports scalar-equality find/count/create/update/delete operations. Includes,
associations, scopes, literals/operators, instance save, sync, migrations, and raw access are rejected
or unavailable. Every tenant table requires reviewed forced RLS and startup validation.
