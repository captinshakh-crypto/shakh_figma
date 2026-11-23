import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "SHAKH - Online Market and Delivery";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const heroImage =
  "https://images.unsplash.com/photo-1772884011435-00b8eeceb1a0?auto=format&fit=crop&fm=jpg&q=78&w=1600";

export default async function OpenGraphImage() {
  let photoSrc = "";
  try {
    const response = await fetch(heroImage);
    if (response.ok) {
      const bytes = new Uint8Array(await response.arrayBuffer());
      let binary = "";
      for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
      photoSrc = "data:image/jpeg;base64," + btoa(binary);
    }
  } catch {
    // Keep the branded gradient card when the photo host is unavailable.
  }

  return new ImageResponse(
    (
      <div
        style={{
          width: "1200px",
          height: "630px",
          display: "flex",
          position: "relative",
          overflow: "hidden",
          background: "#102f49",
          color: "#ffffff",
        }}
      >
        {photoSrc ? (
          <img
            src={photoSrc}
            width="1200"
            height="630"
            style={{ position: "absolute", inset: 0, width: "1200px", height: "630px", objectFit: "cover" }}
          />
        ) : null}
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            background: "linear-gradient(90deg, rgba(8,28,45,.05) 0%, rgba(8,28,45,.3) 45%, rgba(8,28,45,.96) 100%)",
          }}
        />
        <div
          style={{
            position: "absolute",
            right: 72,
            top: 68,
            width: 485,
            height: 490,
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-end",
            justifyContent: "center",
            textAlign: "right",
            fontFamily: "Arial, sans-serif",
          }}
        >
          <div style={{ display: "flex", color: "#ffb36f", fontSize: 46, fontWeight: 900, letterSpacing: 4 }}>
            SHAKH
          </div>
          <div style={{ display: "flex", marginTop: 24, fontSize: 58, fontWeight: 900, lineHeight: 1.2 }}>
            Online Market
          </div>
          <div style={{ display: "flex", marginTop: 8, fontSize: 58, fontWeight: 900, lineHeight: 1.2 }}>
            &amp; Delivery
          </div>
          <div style={{ display: "flex", marginTop: 28, fontSize: 25, lineHeight: 1.5, color: "#e4eef7" }}>
            Restaurants · Groceries · Supermarkets
          </div>
          <div style={{ display: "flex", marginTop: 34, borderRadius: 18, background: "#f47721", padding: "16px 26px", fontSize: 23, fontWeight: 800 }}>
            DAIM-POST.ONLINE
          </div>
        </div>
        <div
          style={{
            position: "absolute",
            left: 54,
            top: 54,
            display: "flex",
            width: 112,
            height: 112,
            borderRadius: 28,
            background: "linear-gradient(140deg, #ff9b3d, #e75f13)",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <svg width="85" height="72" viewBox="0 0 390 320">
            <path d="M25 245 112 143l48 55 66-93 133 140H25Z" fill="none" stroke="#fff" strokeWidth="26" strokeLinejoin="round" strokeLinecap="round"/>
            <path d="m95 245 65-77 43 48 25-31 60 60" fill="none" stroke="#ffe7d0" strokeWidth="14" strokeLinejoin="round" strokeLinecap="round"/>
          </svg>
        </div>
      </div>
    ),
    { ...size }
  );
}
