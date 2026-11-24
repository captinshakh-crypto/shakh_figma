import type { Metadata, Viewport } from "next";
import "./globals.css";
import { PwaRegister } from "@/components/pwa-register";
import NotificationsCenter from "@/components/notifications-center";
import MobileBottomNav from "@/components/mobile-bottom-nav";
import ShareAppButton from "@/components/share-app-button";

const siteUrl = "https://www.daim-post.online";
const siteDescription =
  "شاخ ستۆر (SHAKH STORE)، بازاڕی ئۆنلاین و خزمەتگوزاری گەیاندن لە کوردستان؛ چێشتخانە، سوپەرمارکێت، گۆشت و سپیاتی و بەقالی لە یەک پلاتفۆرمدا.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "شاخ ستۆر | بازاڕی ئۆنلاین و گەیاندن",
    template: "%s | شاخ ستۆر",
  },
  description: siteDescription,
  applicationName: "شاخ ستۆر",
  alternates: { canonical: "/" },
  keywords: [
    "SHAKH STORE", "SHAKH", "شاخ ستۆر", "شاخ", "Shakh Store", "Shakh Stor", "بازاڕی ئۆنلاین", "گەیاندن", "داواکاری خواردن",
    "چێشتخانە", "سوپەرمارکێت", "گۆشت و سپیاتی", "بەقالی", "کوردستان", "عێراق",
    "online marketplace", "food delivery Kurdistan", "Shakh app", "online shopping Iraq", "food delivery Erbil",
  ],
  openGraph: {
    type: "website",
    locale: "ckb_IQ",
    url: siteUrl,
    siteName: "شاخ ستۆر",
    title: "شاخ ستۆر | بازاڕی ئۆنلاین و گەیاندن",
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
    title: "شاخ ستۆر | بازاڕی ئۆنلاین و گەیاندن",
    description: siteDescription,
    images: ["/opengraph-image"],
  },
  robots: { index: true, follow: true },
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "شاخ ستۆر", statusBarStyle: "default" },
  icons: {
    icon: [{ url: "/icon.svg?v=20261124-rtl2", type: "image/svg+xml" }],
    shortcut: [{ url: "/icon.svg?v=20261124-rtl2", type: "image/svg+xml" }],
    apple: [{ url: "/apple-icon?v=20261124-rtl2", sizes: "180x180", type: "image/png" }],
  },
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
      name: "شاخ ستۆر",
      alternateName: ["SHAKH STORE", "SHAKH", "Shakh Store"],
      url: siteUrl,
      logo: siteUrl + "/icon",
      description: siteDescription,
    },
    {
      "@type": "WebSite",
      "@id": siteUrl + "#website",
      url: siteUrl,
      name: "شاخ ستۆر",
      inLanguage: ["ckb-IQ"],
      publisher: { "@id": siteUrl + "#organization" },
    },
    {
      "@type": "WebApplication",
      "@id": siteUrl + "#webapp",
      name: "شاخ ستۆر",
      alternateName: ["SHAKH STORE", "SHAKH", "Shakh Store"],
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
        <ShareAppButton />
        <MobileBottomNav />
      </body>
    </html>
  );
}
