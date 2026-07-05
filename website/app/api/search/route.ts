import { source } from "@/lib/source";
import { createFromSource } from "fumadocs-core/search/server";

// Static search index — built at compile time so the site can be a fully static
// export (Cloudflare Pages / any static host), no server runtime needed.
export const revalidate = false;
export const { staticGET: GET } = createFromSource(source);
