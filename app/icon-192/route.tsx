import { ImageResponse } from "next/og";
import { ShakhDeliveryArt } from "@/components/shakh-delivery-art";

export const runtime = "edge";

export async function GET() {
  return new ImageResponse(<ShakhDeliveryArt size={192}/>, { width: 192, height: 192 });
}
