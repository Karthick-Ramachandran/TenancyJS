import process from "node:process";

const connection = process.env.MIGRATION_DATABASE_URL;
if (connection === undefined || connection.trim() === "") {
  throw new Error("MIGRATION_DATABASE_URL is required for Knex migrations.");
}

export default {
  client: "pg",
  connection,
  migrations: { directory: "./migrations", extension: "mjs" },
};
