import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "شاخ ستۆر، بازاڕی ئۆنلاین و گەیاندن";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

function Mountain({ flip = false }: { flip?: boolean }) {
  return (
    <svg width="220" height="190" viewBox="0 0 390 320" style={{ transform: flip ? "scaleX(-1)" : "none" }}>
      <path d="M25 245 112 143l48 55 66-93 133 140H25Z" fill="none" stroke="#fff" strokeWidth="25" strokeLinejoin="round" strokeLinecap="round"/>
      <path d="m112 143 42 45 10-12m62-71-28 58 33-20 30 42" fill="none" stroke="#ffe7d0" strokeWidth="13" strokeLinejoin="round" strokeLinecap="round"/>
      <circle cx="322" cy="77" r="14" fill="#ffd27c"/>
    </svg>
  );
}

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div style={{
        width: "1200px", height: "630px", display: "flex", position: "relative",
        overflow: "hidden", alignItems: "center", justifyContent: "center",
        background: "linear-gradient(118deg, #ffb21d 0%, #ff7415 36%, #102f49 36%, #102f49 100%)",
        color: "#ffffff", fontFamily: "Arial, Tahoma, sans-serif",
      }}>
        <div style={{ position: "absolute", left: 45, top: 95, display: "flex" }}><Mountain/></div>
        <div style={{ position: "absolute", right: 45, top: 95, display: "flex" }}><Mountain flip/></div>
        <div style={{
          position: "absolute", inset: 0, display: "flex", alignItems: "center",
          justifyContent: "center", flexDirection: "column", textAlign: "center", padding: "50px",
        }}>
          <div style={{ display: "flex", borderRadius: "999px", background: "#ff8b13", padding: "13px 34px", fontSize: 25, fontWeight: 900, letterSpacing: 4 }}>
            SHAKH STORE
          </div>
          <div dir="rtl" lang="ckb-IQ" style={{ display: "flex", marginTop: 33, fontSize: 82, fontWeight: 900, lineHeight: 1.25, direction: "rtl", textAlign: "center", textShadow: "0 5px 18px rgba(0,0,0,.24)" }}>
            شاخ ستۆر
          </div>
          <div dir="rtl" lang="ckb-IQ" style={{ display: "flex", marginTop: 20, fontSize: 34, fontWeight: 800, color: "#ffe0b2" }}>
            بازاڕی ئۆنلاین و گەیاندن
          </div>
          <div dir="rtl" lang="ckb-IQ" style={{ display: "flex", marginTop: 24, fontSize: 24, fontWeight: 700, color: "#e6f0fa" }}>
            چێشتخانە  |  سوپەرمارکێت  |  گۆشت و سپیاتی  |  بەقالی
          </div>
          <div style={{ display: "flex", marginTop: 38, borderRadius: 18, background: "#ff7115", padding: "16px 32px", fontSize: 23, fontWeight: 900 }}>
            DAIM-POST.ONLINE
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
