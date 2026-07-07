import { source } from "@/lib/source";
import { createFromSource } from "fumadocs-core/search/server";

// Static search index - built at compile time so the site can be a fully static
// export (Cloudflare Pages / any static host), no server runtime needed.
export const revalidate = false;

// Our docs have long paragraphs. The default index stores each paragraph in full,
// so a broad query ("database per tenant") returns dozens of full-paragraph hits
// and the search dialog renders a wall of text. Trim each indexed content chunk
// to a short snippet: results stay page + heading + a readable preview, still
// deep-linked to the right section. Titles and headings are indexed in full.
const SNIPPET = 140;
function snippet(text: string): string {
  if (text.length <= SNIPPET) return text;
  const cut = text.slice(0, SNIPPET);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > 80 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

export const { staticGET: GET } = createFromSource(source, {
  buildIndex(page) {
    const { headings, contents } = page.data.structuredData;
    return {
      title: page.data.title,
      description: page.data.description,
      url: page.url,
      id: page.url,
      structuredData: {
        headings,
        contents: contents.map((content) => ({
          ...content,
          content: snippet(content.content),
        })),
      },
    };
  },
});
