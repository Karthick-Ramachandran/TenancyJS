import "./global.css";
import { RootProvider } from "fumadocs-ui/provider/next";
import { Geist, Geist_Mono } from "next/font/google";
import type { ReactNode } from "react";
import type { Metadata } from "next";

const geist = Geist({ subsets: ["latin"], variable: "--font-geist" });
const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
});

export const metadata: Metadata = {
  title: {
    default: "TenancyJS — Fail-closed multi-tenancy for Node.js",
    template: "%s · TenancyJS",
  },
  description:
    "Fail-closed, TypeScript-first multi-tenancy for Node.js. One tenant-isolation contract across Express, Next.js, AdonisJS & NestJS with Prisma, Knex, Lucid, TypeORM, Sequelize & Mongoose.",
};

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      className={`${geist.variable} ${geistMono.variable}`}
      suppressHydrationWarning
    >
      <body className="flex min-h-screen flex-col">
        <RootProvider theme={{ defaultTheme: "dark", enableSystem: true }}>
          {children}
        </RootProvider>
      </body>
    </html>
  );
}
