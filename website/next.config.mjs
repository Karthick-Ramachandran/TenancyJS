import { createMDX } from "fumadocs-mdx/next";

const withMDX = createMDX();

/** @type {import('next').NextConfig} */
const config = {
  reactStrictMode: true,
  turbopack: { root: import.meta.dirname },
  // Fully static build (Cloudflare Pages / any static host).
  output: "export",
  images: { unoptimized: true },
};

export default withMDX(config);
