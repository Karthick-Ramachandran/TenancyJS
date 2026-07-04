#!/usr/bin/env node
import { createInterface } from "node:readline/promises";
import process from "node:process";

import type { CliSelectChoice } from "./cli.js";
import { runCli } from "./cli.js";

const isInteractive = Boolean(process.stdin.isTTY && process.stdout.isTTY);

async function select(
  question: string,
  choices: readonly CliSelectChoice[],
): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stderr });
  try {
    for (;;) {
      process.stderr.write(`\n${question}\n`);
      choices.forEach((choice, index) => {
        process.stderr.write(`  ${index + 1}) ${choice.label}\n`);
      });
      const answer = (await rl.question(`Enter 1-${choices.length}: `)).trim();
      const picked = Number.parseInt(answer, 10);
      if (Number.isInteger(picked) && picked >= 1 && picked <= choices.length) {
        return choices[picked - 1]!.value;
      }
      process.stderr.write("Please enter a number from the list.\n");
    }
  } finally {
    rl.close();
  }
}

process.exitCode = await runCli(process.argv.slice(2), {
  cwd: process.cwd(),
  writeStdout: (value) => process.stdout.write(value),
  writeStderr: (value) => process.stderr.write(value),
  isInteractive,
  nodeVersion: process.versions.node,
  select,
});
