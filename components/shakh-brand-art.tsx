type Props = { size: number };

export function ShakhBrandArt({ size }: Props) {
  const circle = size * 0.55;

  return (
    <div
      style={{
        width: size,
        height: size,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        position: "relative",
        overflow: "hidden",
        background: "linear-gradient(135deg, #aebdce 0%, #e8edf4 34%, #c5d0dd 68%, #dbe4ed 100%)",
        color: "#ffffff",
        fontFamily: "Arial, Tahoma, sans-serif",
      }}
    >
      <div
        style={{
          position: "absolute",
          width: size * 1.55,
          height: Math.max(2, size * 0.008),
          top: size * 0.48,
          left: -size * 0.27,
          transform: "rotate(-36deg)",
          background: "linear-gradient(90deg, rgba(255,255,255,0), #ffe5c1 28%, #ffffff 50%, #ffd9a8 72%, rgba(255,255,255,0))",
          boxShadow: "0 0 12px rgba(255,235,210,.9)",
        }}
      />
      <div
        style={{
          position: "absolute",
          top: size * 0.105,
          left: (size - circle) / 2,
          width: circle,
          height: circle,
          borderRadius: circle,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "radial-gradient(circle at 36% 24%, #ffad18 0%, #ff7a0b 58%, #ee3d08 100%)",
          boxShadow: "0 10px 22px rgba(115,57,25,.22)",
        }}
      >
        <svg
          width={circle * 0.8}
          height={circle * 0.52}
          viewBox="0 0 390 260"
          style={{ position: "absolute", top: circle * 0.16, left: circle * 0.1 }}
        >
          <path
            d="M18 238 110 107 155 151 224 26 372 238 275 167 245 200 192 146 151 187 111 151Z"
            fill="none"
            stroke="#ffffff"
            strokeWidth="23"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          <path
            d="m110 107 38 37 8-10m68-108-31 70 38-24 34 50"
            fill="none"
            stroke="#ffe9c8"
            strokeWidth="12"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          <circle cx="322" cy="46" r="13" fill="#ffe6a9" />
        </svg>
        <div
          style={{
            position: "absolute",
            top: circle * 0.68,
            width: "100%",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            textAlign: "center",
            textShadow: "0 2px 5px rgba(100,35,0,.25)",
          }}
        >
          <div style={{ fontSize: circle * 0.105, fontWeight: 900, lineHeight: 1.1 }}>
            شاخ ستۆر
          </div>
          <div style={{ marginTop: circle * 0.025, fontSize: circle * 0.047, fontWeight: 800, letterSpacing: circle * 0.004 }}>
            SHAKH STORE
          </div>
        </div>
      </div>
      <div
        style={{
          position: "absolute",
          top: size * 0.695,
          width: "100%",
          display: "flex",
          justifyContent: "center",
          color: "#ffffff",
          fontSize: size * 0.115,
          fontWeight: 900,
          textAlign: "center",
          textShadow: "0 3px 8px rgba(47,57,72,.35)",
        }}
      >
        شاخ ستۆر
      </div>
    </div>
  );
}
