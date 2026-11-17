import type { Metadata, Viewport } from "next";
import "./globals.css";
import { PwaRegister } from "@/components/pwa-register";

export const metadata: Metadata = {
  title: "شاخ | گەیاندنی خێرا",
  description: "بازاڕ و گەیاندنی شاخ؛ چێشتخانە، سوپەرمارکێت، گۆشت و بەقالی.",
  applicationName: "SHAKH",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "SHAKH", statusBarStyle: "default" }
};
export const viewport: Viewport = { themeColor: "#F47721", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ckb" dir="rtl"><body><PwaRegister />{children}</body></html>;
}