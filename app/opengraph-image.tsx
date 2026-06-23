import { ImageResponse } from "next/og";

// Static link-preview card. Renders once at build time using the brand palette
// so the demo looks intentional wherever the URL gets pasted (LinkedIn, email).
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Cascade — design as the single source of truth";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#f7f6f3",
          color: "#1a1a1a",
          padding: "80px",
          fontFamily: "sans-serif",
        }}
      >
        {/* Brand mark — cascading bars echoing the favicon */}
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          <div style={{ display: "flex", width: "120px", height: "16px", borderRadius: "8px", background: "#1a1a1a" }} />
          <div style={{ display: "flex", width: "120px", height: "16px", borderRadius: "8px", background: "#1a1a1a", marginLeft: "22px" }} />
          <div style={{ display: "flex", width: "120px", height: "16px", borderRadius: "8px", background: "#1f6feb", marginLeft: "44px" }} />
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", alignItems: "baseline", fontSize: "96px", fontWeight: 800, letterSpacing: "-3px" }}>
            Cascade
            <span style={{ color: "#1f6feb" }}>.</span>
          </div>
          <div style={{ display: "flex", fontSize: "40px", fontWeight: 600, lineHeight: 1.25, marginTop: "20px", maxWidth: "900px" }}>
            A finished footwear design → a factory-ready Bill of Materials and Process Flow Chart, generated live.
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", fontSize: "26px", color: "#6b6b6b" }}>
          <div style={{ display: "flex" }}>design as the single source of truth</div>
          <div style={{ display: "flex" }}>Drew Millar · Lead PM, Nike Flow</div>
        </div>
      </div>
    ),
    { ...size },
  );
}
