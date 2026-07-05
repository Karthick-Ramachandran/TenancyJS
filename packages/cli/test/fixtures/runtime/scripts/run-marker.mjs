import { appendFileSync } from "node:fs";
import process from "node:process";

// Records evidence that both top-level code and the default export ran, inside
// whatever scope `tenancy run` established.
const marker = process.env.TENANCYJS_RUN_MARKER;
if (marker) appendFileSync(marker, "top-level\n");

export default async () => {
  if (marker) appendFileSync(marker, "default\n");
};
