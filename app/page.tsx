"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, ShoppingBag, Store, Utensils, Beef, Carrot, Search, ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Product = { id: string; title: string; description: string | null; price_iqd: number; image_path: string | null; category_key: string; is_shakh_store: boolean };
const categories = [
  { key: "restaurant", label: "چێشتخانە", icon: Utensils },
  { key: "supermarket", label: "سوپەرمارکێت", icon: Store },
  { key: "butcher_poultry", label: "گۆشت و سپیاتی", icon: Beef },
  { key: "grocery", label: "بەقالی", icon: Carrot }
];
export default function HomePage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    try {
      const supabase = createClient();
      supabase.from("products").select("id,title,description,price_iqd,image_path,category_key,is_shakh_store")
        .eq("is_available", true).order("created_at", { ascending: false }).limit(12)
        .then(({ data, error }) => { if (error) setError("نەتوانرا کاڵاکان باربکرێن."); else setProducts((data || []) as Product[]); setLoading(false); });
    } catch { setError("پەیوەندی داتابەیس ئامادە نییە."); setLoading(false); }
  }, []);
  return <main className="min-h-screen">
    <header className="sticky top-0 z-20 border-b border-slate-100 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4">
        <Link href="/" className="flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-2xl bg-shakh-orange text-xl font-black text-white">ش</span><span><b className="block text-xl">SHAKH</b><small className="text-slate-500">شاخ · گەیاندنی خێرا</small></span></Link>
        <nav className="flex items-center gap-3"><Link href="/shop" className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold">چوونەژوورەوە</Link><Link href="/shop" className="rounded-xl bg-shakh-blue px-4 py-2 text-sm font-bold text-white">هەژمار دروست بکە</Link></nav>
      </div>
    </header>
    <section className="relative overflow-hidden bg-gradient-to-l from-shakh-blue to-[#0e477b] text-white">
      <div className="mx-auto grid max-w-7xl items-center gap-8 px-4 py-16 md:grid-cols-[1.2fr_.8fr] md:py-24">
        <div><span className="rounded-full bg-white/15 px-4 py-2 text-sm">بازاڕی شاخ لە یەک شوێن</span><h1 className="mt-7 text-4xl font-black leading-tight md:text-6xl">هەموو پێویستییەکانت،<br/><span className="text-orange-300">بە گەیاندنی شاخ</span></h1><p className="mt-5 max-w-xl text-lg leading-8 text-blue-100">خواردن، کڕین و کاڵای ڕۆژانە لە فرۆشگاکانی ناوچەکەت، بە ئاسانی داوا بکە.</p><div className="mt-8 flex flex-wrap gap-3"><Link href="/shop" className="flex items-center gap-2 rounded-xl bg-shakh-orange px-6 py-3 font-bold">دەستپێکردن <ArrowLeft size={18}/></Link><a href="#categories" className="rounded-xl border border-white/30 px-6 py-3 font-bold">بینینی بەشەکان</a></div></div>
        <div className="rounded-[2rem] border border-white/15 bg-white/10 p-6 shadow-2xl backdrop-blur"><div className="rounded-2xl bg-white p-5 text-shakh-ink"><div className="flex items-center justify-between"><span className="font-black">بازاڕی شاخ</span><ShoppingBag className="text-shakh-orange"/></div><div className="mt-5 grid grid-cols-2 gap-3">{categories.map(({key,label,icon:Icon})=><div key={key} className="rounded-xl bg-shakh-mist p-4"><Icon className="mb-3 text-shakh-blue"/><b className="text-sm">{label}</b></div>)}</div><div className="mt-4 flex items-center gap-2 rounded-xl bg-orange-50 p-3 text-sm text-orange-800"><ShieldCheck size={18}/> داواکاریی ڕاستەقینە، بەبێ داتای دیمۆ</div></div></div>
      </div>
    </section>
    <section id="categories" className="mx-auto max-w-7xl px-4 py-14"><div className="mb-7 flex items-end justify-between"><div><p className="font-bold text-shakh-orange">بەشەکان</p><h2 className="mt-2 text-3xl font-black">لە کوێوە داوا دەکەیت؟</h2></div><Search className="text-shakh-blue"/></div><div className="grid grid-cols-2 gap-4 md:grid-cols-4">{categories.map(({key,label,icon:Icon})=><Link href="/shop" key={key} className="rounded-2xl border border-slate-100 bg-white p-5 shadow-soft transition hover:-translate-y-1"><span className="grid h-12 w-12 place-items-center rounded-xl bg-orange-50 text-shakh-orange"><Icon/></span><b className="mt-4 block">{label}</b><span className="mt-1 block text-sm text-slate-500">بینین و داواکردن</span></Link>)}</div></section>
    <section className="mx-auto max-w-7xl px-4 pb-16"><div className="mb-6"><p className="font-bold text-shakh-orange">کاڵاکانی بەردەست</p><h2 className="mt-2 text-3xl font-black">نوێترین پێشکەشەکان</h2></div>{loading?<p className="rounded-2xl bg-white p-8 text-center text-slate-500">بارکردنی کاڵاکان...</p>:error?<p className="rounded-2xl bg-white p-8 text-center text-slate-500">{error}</p>:products.length===0?<div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center"><ShoppingBag className="mx-auto text-slate-300" size={34}/><p className="mt-3 font-bold">هێشتا هیچ کاڵایەک زیاد نەکراوە</p><p className="mt-1 text-sm text-slate-500">کاتێک فرۆشیارەکان کاڵا زیاد بکەن، لێرە دەردەکەون.</p></div>:<div className="grid grid-cols-2 gap-4 md:grid-cols-4">{products.map(product=><article key={product.id} className="overflow-hidden rounded-2xl bg-white shadow-soft"><div className="grid aspect-[4/3] place-items-center overflow-hidden bg-shakh-mist text-shakh-blue">{product.image_path?<img src={createClient().storage.from("product-images").getPublicUrl(product.image_path).data.publicUrl} alt={product.title} className="h-full w-full object-cover"/>:<ShoppingBag size={34}/>}</div><div className="p-4"><b>{product.title}</b><p className="mt-2 font-black text-shakh-orange">{product.price_iqd.toLocaleString("en-US")} د.ع</p></div></article>)}</div>}</section>
    <footer className="bg-shakh-ink px-4 py-8 text-center text-sm text-slate-300">© {new Date().getFullYear()} SHAKH · daim-post.online</footer>
  </main>;
}