import { ImageResponse } from "next/og";

export const runtime = "edge";
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(140deg, #ff9b3d 0%, #f47721 54%, #df5b12 100%)",
          borderRadius: 38,
        }}
      >
        <svg width="145" height="125" viewBox="0 0 390 320">
          <path
            d="M25 245 112 143l48 55 66-93 133 140H25Z"
            fill="none"
            stroke="#ffffff"
            strokeWidth="24"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          <path
            d="m95 245 65-77 43 48 25-31 60 60"
            fill="none"
            stroke="#ffe7d0"
            strokeWidth="13"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          <circle cx="315" cy="76" r="18" fill="#ffd27c"/>
        </svg>
      </div>
    ),
    { ...size }
  );
}
