import type { Metadata, Viewport } from "next";
import "./globals.css";
import { PwaRegister } from "@/components/pwa-register";
import NotificationsCenter from "@/components/notifications-center";

const siteUrl = "https://daim-post.online";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "SHAKH | شاخ — بازاڕ و گەیاندن",
    template: "%s | SHAKH",
  },
  description:
    "شاخ، پلاتفۆرمی بازاڕ و گەیاندنی کاڵا لە چێشتخانە، سوپەرمارکێت، گۆشت و بەقالییەکانەوە.",
  applicationName: "SHAKH",
  alternates: { canonical: "/" },
  keywords: [
    "SHAKH", "شاخ", "گەیاندن", "بازاڕی ئۆنلاین",
    "چێشتخانە", "سوپەرمارکێت", "بەقالی", "کوردستان", "عێراق",
  ],
  openGraph: {
    type: "website",
    locale: "ckb_IQ",
    url: siteUrl,
    siteName: "SHAKH",
    title: "SHAKH | شاخ — بازاڕ و گەیاندن",
    description:
      "پلاتفۆرمێکی یەکگرتوو بۆ گەڕان بەدوای کاڵا و ڕێکخستنی داواکارییەکانی ڕۆژانە.",
  },
  robots: { index: true, follow: true },
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "SHAKH", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: "#F47721",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ckb" dir="rtl">
      <body>
        <PwaRegister />
        <NotificationsCenter />
        {children}
      </body>
    </html>
  );
}
