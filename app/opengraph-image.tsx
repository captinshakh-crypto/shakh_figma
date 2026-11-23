import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "SHAKH | شاخ – بازاڕی ئۆنلاین و گەیاندن";
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
    // A branded gradient fallback keeps the social card available if the photo host is unavailable.
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
          direction: "rtl",
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
            background: "linear-gradient(90deg, rgba(8,28,45,.05) 0%, rgba(8,28,45,.30) 45%, rgba(8,28,45,.96) 100%)",
          }}
        />
        <div
          style={{
            position: "absolute",
            right: 76,
            top: 70,
            width: 470,
            height: 480,
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-end",
            justifyContent: "center",
            textAlign: "right",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 14, color: "#ffb36f", fontSize: 42, fontWeight: 800 }}>
            <span>شاخ</span>
            <span style={{ color: "#ffffff", fontSize: 24, letterSpacing: 3 }}>SHAKH</span>
          </div>
          <div style={{ display: "flex", marginTop: 24, fontSize: 66, fontWeight: 900, lineHeight: 1.25 }}>
            بازاڕ و گەیاندن
          </div>
          <div style={{ display: "flex", marginTop: 24, fontSize: 28, lineHeight: 1.5, color: "#e4eef7" }}>
            چێشتخانە، سوپەرمارکێت، گۆشت و سپیاتی و بەقالی
          </div>
          <div style={{ display: "flex", marginTop: 34, borderRadius: 18, background: "#f47721", padding: "16px 26px", fontSize: 23, fontWeight: 800 }}>
            daim-post.online
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
            boxShadow: "0 12px 25px rgba(0,0,0,.24)",
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
