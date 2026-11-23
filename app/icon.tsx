import { ImageResponse } from "next/og";
import { ShakhBrandArt } from "@/components/shakh-brand-art";

export const runtime = "edge";
export const size = { width: 512, height: 512 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(<ShakhBrandArt size={512}/>, { ...size });
}
