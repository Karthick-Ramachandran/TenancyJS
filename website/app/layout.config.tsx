import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared";

function Hexagon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      style={{ color: "var(--color-fd-primary)" }}
    >
      <path
        d="M12 2 21 7v10l-9 5-9-5V7z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path
        d="M12 7v10M7.5 9.5v5M16.5 9.5v5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        opacity="0.5"
      />
    </svg>
  );
}

export const baseOptions: BaseLayoutProps = {
  nav: {
    title: (
      <>
        <Hexagon />
        <span style={{ fontWeight: 700, letterSpacing: "-0.02em" }}>
          TenancyJS
        </span>
      </>
    ),
  },
  links: [
    { text: "Docs", url: "/docs", active: "nested-url" },
    {
      text: "npm",
      url: "https://www.npmjs.com/package/tenancyjs-core",
      external: true,
    },
    {
      type: "icon",
      text: "X / Twitter",
      url: "https://x.com/imkarthicck",
      external: true,
      icon: (
        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
        </svg>
      ),
    },
  ],
  githubUrl: "https://github.com/Karthick-Ramachandran/TenancyJS",
};
