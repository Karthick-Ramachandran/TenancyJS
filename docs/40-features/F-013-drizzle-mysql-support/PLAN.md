# Plan

1. Research current stable Drizzle drivers, transactions, schemas, and RLS APIs; record ADR-0031/0032.
2. Add dialect-aware MySQL row behavior to TypeORM and Sequelize without weakening PostgreSQL.
3. Add real MySQL row and database adversarial suites for both existing adapters.
4. Build the Drizzle package using shared enforcement/cache primitives and a narrow protected facade.
5. Prove every applicable Drizzle strategy on real PostgreSQL/MySQL with colliding IDs.
6. Extend CLI detection/selection/templates for Express TypeORM, Sequelize, and Drizzle.
7. Reconcile public and durable docs; review architecture, conventions, security, and completion.
8. Run focused and full release gates.

