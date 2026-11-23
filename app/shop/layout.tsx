import type { Metadata } from "next";

const description =
  "کاڵاکانی چێشتخانە، سوپەرمارکێت، گۆشت و سپیاتی و بەقالی لە شاخ ستۆر؛ بە ناوی کاڵا، دوکان و جۆری بازاڕ بگەڕێ.";

export const metadata: Metadata = {
  title: "بازاڕ و گەڕانی کاڵاکان",
  description,
  alternates: { canonical: "/shop" },
  openGraph: {
    title: "بازاڕی شاخ ستۆر | SHAKH STORE",
    description,
    url: "https://www.daim-post.online/shop",
    images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: "شاخ ستۆر – بازاڕی ئۆنلاین" }],
  },
};

export default function ShopLayout({ children }: { children: React.ReactNode }) {
  return children;
}
