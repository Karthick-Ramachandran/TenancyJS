# `@tenancyjs/adapter-mongoose`

Fail-closed Mongoose 9 row-level isolation for MongoDB 8 replica sets and Node 24.

This boundary is **adapter-enforced**, not equivalent to PostgreSQL forced RLS. Keep native Mongoose
connections, models, documents, queries, and collections private. Protected reads return lean plain
values and supported writes compose or validate the active tenant field inside one managed session.

The initial surface supports scalar-equality find/count/create/update/delete. Populate, aggregation,
raw collection/driver access, bulkWrite, mapReduce, change streams, and live document save are rejected
or unavailable. `validate()` returns an enforcement-tier warning that applications must review.
