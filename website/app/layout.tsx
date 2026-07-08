import "./global.css";
import { RootProvider } from "fumadocs-ui/provider/next";
import { Geist, Geist_Mono } from "next/font/google";
import type { ReactNode } from "react";
import type { Metadata } from "next";
import { SITE_URL, SITE_DESCRIPTION } from "@/lib/site";
import Script from "next/script";

const geist = Geist({ subsets: ["latin"], variable: "--font-geist" });
const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "TenancyJS - Fail-closed multi-tenancy for Node.js",
    template: "%s · TenancyJS",
  },
  description: SITE_DESCRIPTION,
  applicationName: "TenancyJS",
  keywords: [
    "multi-tenancy",
    "multitenancy",
    "tenancy",
    "saas",
    "tenant isolation",
    "row-level security",
    "postgres",
    "prisma",
    "typescript",
    "node.js",
    "express",
    "next.js",
    "nestjs",
    "adonisjs",
  ],
  authors: [{ name: "Karthick Ramachandran" }],
  openGraph: {
    type: "website",
    url: SITE_URL,
    siteName: "TenancyJS",
    title: "TenancyJS - Fail-closed multi-tenancy for Node.js",
    description: SITE_DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    title: "TenancyJS - Fail-closed multi-tenancy for Node.js",
    description: SITE_DESCRIPTION,
  },
  alternates: { canonical: SITE_URL },
};

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      className={`${geist.variable} ${geistMono.variable}`}
      suppressHydrationWarning
    >
      <body className="flex min-h-screen flex-col">
        {/* Google Analytics Tag */}
        <Script
          src="https://www.googletagmanager.com/gtag/js?id=G-HSLY5KB8LW"
          strategy="afterInteractive"
        />
        <Script id="google-analytics" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'G-HSLY5KB8LW');
          `}
        </Script>
        <RootProvider
          theme={{ defaultTheme: "light", enableSystem: false }}
          search={{ options: { type: "static" } }}
        >
          {children}
        </RootProvider>
      </body>
    </html>
  );
}
