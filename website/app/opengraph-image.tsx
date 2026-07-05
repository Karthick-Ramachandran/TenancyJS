import { ImageResponse } from "next/og";

export const dynamic = "force-static";
export const alt = "TenancyJS - fail-closed multi-tenancy for Node.js";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "80px",
          background: "#0a0b0e",
          color: "#ffffff",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "22px",
            marginBottom: "44px",
          }}
        >
          <div
            style={{
              width: "58px",
              height: "58px",
              borderRadius: "14px",
              background: "linear-gradient(135deg,#8b83ff,#c084fc,#f472b6)",
              display: "flex",
            }}
          />
          <div style={{ fontSize: "34px", fontWeight: 700, color: "#c9cdd6" }}>
            TenancyJS
          </div>
        </div>
        <div
          style={{
            display: "flex",
            fontSize: "78px",
            fontWeight: 800,
            lineHeight: 1.04,
            letterSpacing: "-0.03em",
            maxWidth: "980px",
          }}
        >
          Multi-tenancy that refuses to leak
        </div>
        <div
          style={{
            display: "flex",
            fontSize: "30px",
            color: "#9aa0ac",
            marginTop: "30px",
            maxWidth: "860px",
          }}
        >
          Fail-closed, TypeScript-first tenant isolation for Node.js - one
          contract for the framework and ORM you already use.
        </div>
        <div
          style={{
            marginTop: "52px",
            width: "260px",
            height: "10px",
            borderRadius: "999px",
            background: "linear-gradient(90deg,#6d64ff,#a855f7,#ec4899)",
          }}
        />
      </div>
    ),
    { ...size },
  );
}
