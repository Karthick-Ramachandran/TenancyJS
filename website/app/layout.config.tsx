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
  ],
  githubUrl: "https://github.com/Karthick-Ramachandran/TenancyJS",
};
