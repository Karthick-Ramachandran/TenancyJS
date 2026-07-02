import { defineConfig } from "prisma/config";

const databaseUrl = process.env.DATABASE_URL ?? process.env.TEST_DATABASE_URL;

export default defineConfig({
  schema: "prisma/schema.prisma",
  ...(databaseUrl === undefined ? {} : { datasource: { url: databaseUrl } }),
});
