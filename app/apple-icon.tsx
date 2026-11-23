import { ImageResponse } from "next/og";
import { ShakhBrandArt } from "@/components/shakh-brand-art";

export const runtime = "edge";
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(<ShakhBrandArt size={180}/>, { ...size });
}
