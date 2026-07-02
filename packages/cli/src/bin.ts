#!/usr/bin/env node
import process from "node:process";

import { runCli } from "./cli.js";

process.exitCode = await runCli(process.argv.slice(2), {
  cwd: process.cwd(),
  writeStdout: (value) => process.stdout.write(value),
  writeStderr: (value) => process.stderr.write(value),
});
