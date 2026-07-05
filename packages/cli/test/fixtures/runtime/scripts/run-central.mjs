import { appendFileSync } from "node:fs";
import process from "node:process";

const marker = process.env.TENANCYJS_RUN_MARKER;

export default async () => {
  if (marker) appendFileSync(marker, "central-ran\n");
};
