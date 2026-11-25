import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, ShoppingBag } from "lucide-react";
import ShakhBrand from "@/components/shakh-brand";
import { SupportContactSection } from "@/components/support-contact";

export const metadata: Metadata = {
  title: "پشتگیری و پەیوەندی",
  description: "پەیوەندی بە تیمی پشتگیری شاخ ستۆر لە ڕێگەی تەلەفۆن و واتسئاپ.",
  alternates: { canonical: "/support" },
};

export default function SupportPage() {
  return (
    <main dir="rtl" className="min-h-screen bg-[#f5f8fc] text-[#102f49]">
      <header className="border-b border-slate-200 bg-white px-4 py-4 sm:px-6">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
          <ShakhBrand size="md"/>
          <Link href="/" className="inline-flex items-center gap-2 rounded-xl bg-[#0a3157] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-[#124977]">
            <ArrowRight size={17}/> گەڕانەوە بۆ سەرەتا
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 pt-8 sm:px-6 sm:pt-12">
        <div className="rounded-[2rem] bg-[#0a3157] px-6 py-8 text-center text-white shadow-[0_20px_55px_rgba(10,49,87,.16)] sm:px-10 sm:py-10">
          <p className="text-xs font-black tracking-[.18em] text-[#ffb36f]">SHAKH STORE SUPPORT</p>
          <h1 className="mt-3 text-3xl font-black sm:text-4xl">بەشی پشتگیری</h1>
          <p className="mx-auto mt-3 max-w-2xl text-sm leading-8 text-blue-100 sm:text-base">
            ئێمە ئامادەین یارمەتیت بدەین. بۆ پرسیار و کێشەکانی بەکارهێنان، داواکاری و خزمەتگوزارییەکانی شاخ ستۆر پەیوەندیمان پێوە بکە.
          </p>
        </div>
      </div>

      <SupportContactSection/>

      <div className="mx-auto max-w-6xl px-4 pb-12 sm:px-6">
        <Link href="/shop" className="mx-auto inline-flex items-center gap-2 rounded-xl bg-[#f47721] px-5 py-3 font-black text-white shadow-md shadow-orange-100 transition hover:bg-orange-600">
          <ShoppingBag size={18}/> گەڕان لە بازاڕ
        </Link>
      </div>
    </main>
  );
}
