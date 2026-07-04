import { defineConfig } from "prisma/config";

const databaseUrl = process.env.MYSQL_TEST_DATABASE_URL;

export default defineConfig({
  schema: "prisma/schema.mysql.prisma",
  ...(databaseUrl === undefined ? {} : { datasource: { url: databaseUrl } }),
});
