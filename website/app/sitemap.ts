import type { MetadataRoute } from "next";
import { source } from "@/lib/source";
import { SITE_URL } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const docs = source.getPages().map((page) => ({
    url: `${SITE_URL}${page.url}`,
    changeFrequency: "weekly" as const,
    priority: 0.7,
  }));
  return [
    { url: SITE_URL, changeFrequency: "weekly", priority: 1 },
    ...docs,
  ];
}
