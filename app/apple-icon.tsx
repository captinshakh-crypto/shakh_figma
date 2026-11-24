import { ImageResponse } from "next/og";
import { ShakhDeliveryArt } from "@/components/shakh-delivery-art";

export const runtime = "edge";
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(<ShakhDeliveryArt size={180}/>, { ...size });
}
