import { DocsLayout } from "fumadocs-ui/layouts/docs";
import type { ReactNode } from "react";
import type { Root } from "fumadocs-core/page-tree";
import { baseOptions } from "@/app/layout.config";
import { source } from "@/lib/source";

// Collapse the "Set up your stack" section to a single sidebar link. The 19
// framework×ORM setup pages are reached from the cards on that page, not the
// sidebar — otherwise they flood the left nav and are hard to scan.
function collapseStacks(tree: Root): Root {
  return {
    ...tree,
    children: tree.children.map((node) => {
      if (node.type === "folder") {
        const index = node.children.find(
          (child) => child.type === "page" && child.url === "/docs/stacks",
        );
        // Replace the whole folder with a single link to its index page.
        if (index) return index;
      }
      return node;
    }),
  };
}

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <DocsLayout tree={collapseStacks(source.pageTree)} {...baseOptions}>
      {children}
    </DocsLayout>
  );
}
