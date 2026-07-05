import { appendFileSync } from "node:fs";
import process from "node:process";

// No default export: only the top-level code runs inside the scope.
const marker = process.env.TENANCYJS_RUN_MARKER;
if (marker) appendFileSync(marker, "top-level-only\n");
