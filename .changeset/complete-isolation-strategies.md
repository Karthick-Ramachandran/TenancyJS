---
"tenancyjs-adapter-prisma": minor
"tenancyjs-adapter-typeorm": minor
"tenancyjs-adapter-sequelize": minor
"tenancyjs-adapter-mongoose": minor
"tenancyjs-adapter-shared": patch
"tenancyjs-cli": patch
---

Complete the tested isolation strategy matrix: Prisma PostgreSQL schema routing and MySQL database
routing, TypeORM and Sequelize PostgreSQL schema/database routing, and Mongoose MongoDB database
routing. Every new combination has a real two-tenant colliding-ID adversarial test and reuses the
shared bounded resource cache or PostgreSQL schema engine.
