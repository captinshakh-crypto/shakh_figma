import type { Metadata, Viewport } from "next";
import "./globals.css";
import { PwaRegister } from "@/components/pwa-register";
import NotificationsCenter from "@/components/notifications-center";
import MobileBottomNav from "@/components/mobile-bottom-nav";

const siteUrl = "https://www.daim-post.online";
const siteDescription =
  "شاخ، بازاڕی ئۆنلاین و خزمەتگوزاری گەیاندن لە کوردستان؛ چێشتخانە، سوپەرمارکێت، گۆشت و سپیاتی و بەقالی لە یەک پلاتفۆرمدا.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "SHAKH | شاخ – بازاڕی ئۆنلاین و گەیاندن",
    template: "%s | SHAKH",
  },
  description: siteDescription,
  applicationName: "SHAKH",
  alternates: { canonical: "/" },
  keywords: [
    "SHAKH", "شاخ", "بازاڕی ئۆنلاین", "گەیاندن", "داواکاری خواردن",
    "چێشتخانە", "سوپەرمارکێت", "گۆشت و سپیاتی", "بەقالی", "کوردستان", "عێراق",
    "online marketplace", "food delivery Kurdistan", "Shakh app",
  ],
  openGraph: {
    type: "website",
    locale: "ckb_IQ",
    url: siteUrl,
    siteName: "SHAKH | شاخ",
    title: "SHAKH | شاخ – بازاڕی ئۆنلاین و گەیاندن",
    description: siteDescription,
    images: [{
      url: "/opengraph-image",
      width: 1200,
      height: 630,
      alt: "شاخ – بازاڕی ئۆنلاین و گەیاندن، چێشتخانە و کاڵاکانی ڕۆژانە",
    }],
  },
  twitter: {
    card: "summary_large_image",
    title: "SHAKH | شاخ – بازاڕی ئۆنلاین و گەیاندن",
    description: siteDescription,
    images: ["/opengraph-image"],
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

const structuredData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": siteUrl + "#organization",
      name: "SHAKH",
      alternateName: "شاخ",
      url: siteUrl,
      logo: siteUrl + "/icon",
      description: siteDescription,
    },
    {
      "@type": "WebSite",
      "@id": siteUrl + "#website",
      url: siteUrl,
      name: "SHAKH | شاخ",
      inLanguage: ["ckb-IQ", "ar", "en"],
      publisher: { "@id": siteUrl + "#organization" },
    },
    {
      "@type": "WebApplication",
      "@id": siteUrl + "#webapp",
      name: "SHAKH | شاخ",
      alternateName: "شاخ",
      url: siteUrl,
      applicationCategory: "ShoppingApplication",
      operatingSystem: "Web browser",
      browserRequirements: "Requires JavaScript and a modern web browser",
      description: siteDescription,
      image: siteUrl + "/opengraph-image",
      isAccessibleForFree: true,
    },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ckb" dir="rtl">
      <body>
        <PwaRegister />
        <NotificationsCenter />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        />
        {children}
        <MobileBottomNav />
      </body>
    </html>
  );
}
