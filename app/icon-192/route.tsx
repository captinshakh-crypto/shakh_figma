import { ImageResponse } from "next/og";
import { ShakhBrandArt } from "@/components/shakh-brand-art";

export const runtime = "edge";

export async function GET() {
  return new ImageResponse(
    <ShakhBrandArt size={192}/>,
    { width: 192, height: 192 }
  );
}
