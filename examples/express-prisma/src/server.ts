import process from "node:process";

import { createExpressPrismaApp } from "./app.js";
import { createExampleRuntime } from "./runtime.js";

const databaseUrl = process.env.DATABASE_URL;
if (databaseUrl === undefined || databaseUrl.trim() === "") {
  throw new Error("DATABASE_URL is required.");
}

const runtime = createExampleRuntime(databaseUrl);
const app = createExpressPrismaApp(runtime);
const port = parsePort(process.env.PORT);
const server = app.listen(port, () => {
  process.stdout.write(`Express Prisma example listening on port ${port}.\n`);
});

async function shutdown(): Promise<void> {
  server.close(async () => {
    await runtime.disconnect();
  });
}

process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);

function parsePort(value: string | undefined): number {
  if (value === undefined) return 3000;
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error("PORT must be an integer between 1 and 65535.");
  }
  return port;
}
