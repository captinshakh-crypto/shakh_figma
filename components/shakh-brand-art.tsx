type Props = { size: number };

export function ShakhBrandArt({ size }: Props) {
  return (
    <div style={{
      width: size, height: size, display: "flex", alignItems: "center",
      justifyContent: "center", flexDirection: "column", position: "relative",
      overflow: "hidden", borderRadius: Math.round(size * 0.2),
      background: "radial-gradient(circle at 50% 28%, #ffb51d 0%, #ff7911 42%, #df2f08 100%)",
      color: "#ffffff", fontFamily: "Arial, Tahoma, sans-serif",
    }}>
      <div style={{
        position: "absolute", width: size * 0.9, height: size * 0.27,
        bottom: size * 0.02, left: -size * 0.08, borderRadius: "50%",
        borderTop: Math.max(3, size * 0.012) + "px solid rgba(255,211,84,.95)",
        transform: "rotate(-12deg)",
      }}/>
      <svg width={size * 0.78} height={size * 0.53} viewBox="0 0 390 260">
        <path d="M18 238 110 107 155 151 224 26 372 238 275 167 245 200 192 146 151 187 111 151Z"
          fill="none" stroke="#fff" strokeWidth="23" strokeLinejoin="round" strokeLinecap="round"/>
        <path d="m110 107 38 37 8-10m68-108-31 70 38-24 34 50"
          fill="none" stroke="#ffe9c8" strokeWidth="12" strokeLinejoin="round" strokeLinecap="round"/>
        <circle cx="322" cy="46" r="13" fill="#ffe3a0"/>
      </svg>
      <div style={{
        display: "flex", flexDirection: "column", alignItems: "center",
        justifyContent: "center", marginTop: -size * 0.015,
        textAlign: "center", textShadow: "0 3px 8px rgba(80,20,0,.28)",
      }}>
        <div style={{ display: "flex", fontSize: size * 0.105, fontWeight: 900, lineHeight: 1.15 }}>
          شاخ ستۆر
        </div>
        <div style={{ display: "flex", marginTop: size * 0.025, fontSize: size * 0.048, fontWeight: 900, letterSpacing: size * 0.006 }}>
          SHAKH STORE
        </div>
      </div>
    </div>
  );
}
