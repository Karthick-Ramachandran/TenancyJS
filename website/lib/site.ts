export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ??
  "https://tenancyjs.dev";

export const SITE_NAME = "TenancyJS";
export const SITE_DESCRIPTION =
  "Fail-closed, TypeScript-first multi-tenancy for Node.js. One tenant-isolation contract across Express, Next.js, AdonisJS & NestJS with Prisma, Knex, Lucid, TypeORM, Sequelize & Mongoose.";
