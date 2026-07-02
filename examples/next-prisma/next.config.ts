import type { NextConfig } from "next";

const config: NextConfig = {
  output: "standalone",
  transpilePackages: [
    "@tenancyjs/core",
    "@tenancyjs/identifiers",
    "@tenancyjs/adapter-prisma",
    "@tenancyjs/integration-next",
  ],
};

export default config;
