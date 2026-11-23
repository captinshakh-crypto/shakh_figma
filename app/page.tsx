"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import {
  ArrowLeft, ArrowUpLeft, Beef, Carrot, ChevronLeft, Clock3,
  PackageCheck, Search, ShieldCheck, ShoppingBag, Store, Truck, Utensils,
  UserRound, WalletCards, Sparkles, CircleCheck, ShoppingBasket,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import PwaInstallCta from "@/components/pwa-install-cta";
import ShakhBrand from "@/components/shakh-brand";
import { NotificationsHeaderBell } from "@/components/notifications-center";

type Product = {
  id: string;
  title: string;
  description: string | null;
  price_iqd: number;
  image_path: string | null;
  category_key: string;
  is_shakh_store: boolean;
};

type ProfileSummary = {
  full_name: string;
  email: string | null;
  role: string | null;
};

const roleLabels: Record<string, string> = {
  super_admin: "سوپەر ئەدمین",
  captain: "کاپتن",
  customer: "کڕیار",
  supermarket: "سوپەرمارکێت",
  restaurant: "چێشتخانە",
  butcher_poultry: "گۆشت و سپیاتی",
  grocery: "بەقالی",
};

function getUserName(user: User) {
  const metadata = user.user_metadata ?? {};
  const fullName = metadata.full_name;
  const name = metadata.name;
  if (typeof fullName === "string" && fullName.trim()) return fullName.trim();
  if (typeof name === "string" && name.trim()) return name.trim();
  return user.email?.split("@")[0] || "بەکارهێنەر";
}

const categories = [
  { key: "restaurant", label: "چێشتخانە", detail: "خواردن و خواردنەوە", icon: Utensils, tone: "from-orange-50 to-rose-50", color: "text-orange-600" },
  { key: "supermarket", label: "سوپەرمارکێت", detail: "پێداویستیی ماڵەوە", icon: Store, tone: "from-blue-50 to-cyan-50", color: "text-blue-700" },
  { key: "butcher_poultry", label: "گۆشت و سپیاتی", detail: "کاڵای تازە و ڕۆژانە", icon: Beef, tone: "from-rose-50 to-red-50", color: "text-rose-700" },
  { key: "grocery", label: "بەقالی", detail: "پێداویستییە ڕۆژانەکان", icon: Carrot, tone: "from-emerald-50 to-lime-50", color: "text-emerald-700" },
];

const benefits = [
  { icon: PackageCheck, title: "داواکاری لە یەک شوێن", description: "بەشە جیاوازەکانی بازاڕ لە پلاتفۆرمێکی یەکگرتوودا." },
  { icon: Truck, title: "ڕێکخستنی گەیاندن", description: "پرۆسەی داواکاری و گەیاندن بە شێوەی ڕێکخراو." },
  { icon: WalletCards, title: "مامەڵەی ڕوون", description: "بەڕێوەبردنی جزدان و مامەڵەکان لە چوارچێوەی هەژمارەکەتدا." },
];

function publicProductImage(path: string) {
  return createClient().storage.from("product-images").getPublicUrl(path).data.publicUrl;
}

export default function HomePage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [profile, setProfile] = useState<ProfileSummary | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    let active = true;
    async function loadProducts() {
      try {
        const { data, error: queryError } = await createClient()
          .from("products")
          .select("id,title,description,price_iqd,image_path,category_key,is_shakh_store")
          .eq("is_available", true)
          .eq("is_shakh_store", false)
          .order("created_at", { ascending: false })
          .limit(8);
        if (!active) return;
        if (queryError) setError("لە ئێستادا نەتوانرا کاڵاکان باربکرێن. تکایە دواتر هەوڵ بدەرەوە.");
        else setProducts((data || []) as Product[]);
      } catch {
        if (active) setError("پەیوەندی بە خزمەتگوزاریی بازاڕەوە بەردەست نییە.");
      } finally {
        if (active) setLoading(false);
      }
    }
    void loadProducts();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    let revision = 0;
    const supabase = createClient();
    const syncUser = (user: User | null) => {
      const currentRevision = ++revision;
      if (!user) {
        setProfile(null);
        setAuthLoading(false);
        return;
      }
      setAuthLoading(true);
      const fallback: ProfileSummary = { full_name: getUserName(user), email: user.email ?? null, role: null };
      void Promise.resolve(
        supabase.from("profiles").select("full_name,role").eq("id", user.id).maybeSingle()
      ).then(({ data }) => {
          if (!active || currentRevision !== revision) return;
          setProfile({ full_name: data?.full_name || fallback.full_name, email: user.email ?? null, role: data?.role ?? null });
          setAuthLoading(false);
        })
        .catch(() => {
          if (!active || currentRevision !== revision) return;
          setProfile(fallback);
          setAuthLoading(false);
        });
    };
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => syncUser(session?.user ?? null));
    void supabase.auth.getUser().then(({ data }) => { if (active) syncUser(data.user); })
      .catch(() => { if (active) setAuthLoading(false); });
    return () => { active = false; revision += 1; subscription.unsubscribe(); };
  }, []);

  const accountHref = profile ? "/dashboard" : "/login";
  const accountLabel = authLoading ? "..." : profile ? profile.full_name : "چوونەژوورەوە";

  return (
    <main className="min-h-screen overflow-hidden bg-[#f5f8fc] text-shakh-ink">
      <div className="bg-[#102f49] px-4 py-2 text-center text-xs font-semibold text-white/85 sm:text-sm">
        شاخ · بازاڕ و گەیاندنی پێداویستییە ڕۆژانەکان لە یەک پلاتفۆرمدا
      </div>

      <header className="sticky top-0 z-40 border-b border-slate-200/70 bg-white/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
          <ShakhBrand size="md" />
          <nav aria-label="ناڤی سەرەکی" className="flex items-center gap-2">
            <Link href="/shop" className="hidden rounded-xl px-4 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-blue-50 hover:text-[#1769aa] sm:inline-flex">بازاڕ</Link>
            <NotificationsHeaderBell />
            <PwaInstallCta compact />
            <Link href={accountHref} className="inline-flex min-w-0 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 transition hover:border-orange-200 hover:bg-orange-50">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#eaf3fb] text-[#1769aa]"><UserRound size={18}/></span>
              <span className="hidden max-w-36 truncate text-sm font-bold sm:block">{accountLabel}</span>
            </Link>
          </nav>
        </div>
      </header>

      <section aria-labelledby="home-hero-title" className="bg-[#f5f8fc] py-5 sm:py-8">
        <div className="mx-auto max-w-7xl px-3 sm:px-6 lg:px-8">
          <div className="grid overflow-hidden rounded-[1.75rem] bg-[#102f49] text-white shadow-[0_24px_70px_rgba(16,47,73,.18)] md:grid-cols-2 md:rounded-[2rem]">
            <div className="relative order-first min-h-[245px] overflow-hidden sm:min-h-[330px] md:order-last md:min-h-[470px]">
              <img
                src="https://images.unsplash.com/photo-1772884011435-00b8eeceb1a0?auto=format&fit=crop&fm=jpg&q=70&w=1280"
                alt="خواردنی برگری گەرم لەگەڵ فرێز"
                className="absolute inset-0 h-full w-full object-cover object-center"
                loading="eager"
                fetchPriority="high"
                decoding="async"
              />
              <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-[#102f49]/55 via-transparent to-black/10 md:bg-gradient-to-l md:from-[#102f49]/10 md:to-transparent"/>
              <div className="absolute bottom-4 left-4 flex items-center gap-2 rounded-full border border-white/20 bg-black/30 px-3 py-2 text-xs font-bold text-white shadow-lg backdrop-blur-md sm:bottom-6 sm:left-6">
                <span className="h-2 w-2 rounded-full bg-emerald-400"/>
                شاخ · بازاڕ و گەیاندن
              </div>
            </div>
            <div className="relative order-last flex min-h-[350px] items-center overflow-hidden p-6 sm:p-9 md:order-first md:min-h-[470px] md:p-10 lg:p-12">
              <div aria-hidden="true" className="pointer-events-none absolute -left-20 -top-24 h-72 w-72 rounded-full border border-white/10"/>
              <div aria-hidden="true" className="pointer-events-none absolute -left-8 -top-12 h-48 w-48 rounded-full border border-white/10"/>
              <div className="relative z-10 max-w-xl">
                <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3.5 py-2 text-xs font-black text-orange-100 sm:text-sm">
                  <Sparkles size={15} className="text-[#ffb36f]"/> بازاڕی دیجیتاڵی شاخ
                </span>
                <h1 id="home-hero-title" className="mt-5 text-[2rem] font-black leading-[1.5] tracking-tight sm:text-4xl sm:leading-[1.4] lg:text-[3.25rem]">
                  خواردنی دڵخوازت
                  <span className="block text-[#ffb36f]">لە چێشتخانەکانی شاخ</span>
                </h1>
                <p className="mt-4 max-w-lg text-sm leading-8 text-blue-100 sm:text-base sm:leading-9">
                  لە چێشتخانە، سوپەرمارکێت، گۆشت و سپیاتی و بەقالی بگەڕێ؛ کاڵای پێویستت هەڵبژێرە و داواکارییەکەت لە یەک پلاتفۆرمدا ڕێکبخە.
                </p>
                <div className="mt-7 flex flex-wrap gap-3">
                  <Link href="/shop" className="inline-flex items-center gap-2 rounded-xl bg-[#f47721] px-5 py-3.5 text-sm font-black text-white shadow-lg shadow-orange-950/20 transition hover:-translate-y-0.5 hover:bg-orange-600 sm:px-6 sm:text-base">
                    بینینی بازاڕ <ArrowLeft size={18}/>
                  </Link>
                  <Link href={accountHref} className="inline-flex items-center gap-2 rounded-xl border border-white/25 bg-white/5 px-4 py-3.5 text-sm font-bold text-white transition hover:bg-white/10">
                    {profile ? "چوون بۆ داشبۆرد" : "چوونەژوورەوە"} <ChevronLeft size={17}/>
                  </Link>
                </div>
                <div className="mt-7 flex flex-wrap gap-x-5 gap-y-3 text-xs font-semibold text-blue-100 sm:text-sm">
                  <span className="inline-flex items-center gap-2"><ShieldCheck size={16} className="text-[#ffb36f]"/> پاراستنی هەژمار</span>
                  <span className="inline-flex items-center gap-2"><Truck size={16} className="text-[#ffb36f]"/> گەیاندنی داواکاری</span>
                  <span className="inline-flex items-center gap-2"><CircleCheck size={16} className="text-[#ffb36f]"/> چوار جۆری بازاڕ</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
        <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-black tracking-wide text-[#f47721] sm:text-sm">بەشەکانی بازاڕ</p>
            <h2 className="mt-2 text-2xl font-black text-[#102f49] sm:text-3xl">بە پێی پێویستییەکانت هەڵبژێرە</h2>
            <p className="mt-2 text-sm leading-7 text-slate-500">بە ئاسانی بگەڕێ بۆ ئەوەی پێویستتە.</p>
          </div>
          <Link href="/shop" className="hidden items-center gap-2 text-sm font-bold text-[#1769aa] hover:text-[#f47721] sm:inline-flex">بینینی هەموو بازاڕ <ArrowLeft size={16}/></Link>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">
          {categories.map(({ key, label, detail, icon: Icon, tone, color }) => (
            <Link href="/shop" key={key} className="group rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm transition hover:-translate-y-1 hover:border-orange-200 hover:shadow-lg sm:rounded-3xl sm:p-5">
              <span className={`grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br ${tone} ${color} transition group-hover:scale-105`}><Icon size={23}/></span>
              <b className="mt-4 block text-sm font-black text-[#102f49] sm:text-base">{label}</b>
              <span className="mt-1 block text-xs leading-6 text-slate-500 sm:text-sm">{detail}</span>
              <span className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-[#1769aa]">گەڕان <ArrowLeft size={13}/></span>
            </Link>
          ))}
        </div>
      </section>

      <section className="border-y border-slate-200/70 bg-white py-12 sm:py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-black text-[#f47721] sm:text-sm">هەڵبژاردەی بازاڕ</p>
              <h2 className="mt-2 text-2xl font-black text-[#102f49] sm:text-3xl">کاڵاکانی بەردەست</h2>
              <p className="mt-2 text-sm text-slate-500">کاڵا ڕاستەقینەکان لە فرۆشگاکانی چالاکەوە.</p>
            </div>
            <Link href="/shop" className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-bold text-[#1769aa] transition hover:border-blue-300 hover:bg-blue-50 sm:text-sm">چوون بۆ بازاڕ <ArrowLeft size={15}/></Link>
          </div>

          {loading ? (
            <div className="mt-7 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4" aria-label="بارکردنی کاڵاکان">
              {Array.from({ length: 4 }).map((_, index) => <div key={index} className="animate-pulse overflow-hidden rounded-2xl border border-slate-100 bg-white"><div className="aspect-[4/3] bg-slate-200"/><div className="space-y-2 p-3"><div className="h-4 w-3/4 rounded bg-slate-200"/><div className="h-4 w-1/3 rounded bg-slate-200"/></div></div>)}
            </div>
          ) : error ? (
            <p role="status" className="mt-7 rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center text-sm text-amber-900">{error}</p>
          ) : products.length === 0 ? (
            <div className="mt-7 rounded-2xl border border-dashed border-slate-300 bg-[#f8fafc] p-10 text-center">
              <ShoppingBag className="mx-auto text-slate-300" size={34}/>
              <p className="mt-3 font-bold text-[#102f49]">هێشتا کاڵایەک بۆ پیشاندان نییە</p>
              <p className="mt-2 text-sm text-slate-500">کاتێک فرۆشیارەکان کاڵای بەردەست زیاد بکەن، لێرە دەردەکەون.</p>
            </div>
          ) : (
            <div className="mt-7 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
              {products.map((product) => (
                <article key={product.id} className="group overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-lg sm:rounded-3xl">
                  <div className="relative grid aspect-[4/3] place-items-center overflow-hidden bg-[#edf3f8]">
                    {product.image_path ? <img src={publicProductImage(product.image_path)} alt={product.title} loading="lazy" className="h-full w-full object-cover transition duration-500 group-hover:scale-105"/> : <ShoppingBag size={34} className="text-[#1769aa]/40"/>}
                    <span className="absolute right-2 top-2 rounded-full bg-white/90 px-2.5 py-1 text-[10px] font-bold text-[#1769aa] shadow-sm">بەردەست</span>
                  </div>
                  <div className="p-3 sm:p-4">
                    <h3 className="line-clamp-2 min-h-10 text-sm font-black leading-6 text-[#102f49] sm:text-base">{product.title}</h3>
                    {product.description && <p className="mt-1 line-clamp-1 text-xs text-slate-500">{product.description}</p>}
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                      <b className="text-sm font-black text-[#f47721] sm:text-base">{Number(product.price_iqd).toLocaleString("en-US")} <span className="text-[10px]">د.ع</span></b>
                      <Link href="/shop" className="inline-flex items-center gap-1 rounded-lg bg-[#edf4fa] px-2.5 py-2 text-[10px] font-bold text-[#1769aa] transition hover:bg-blue-100 sm:text-xs">بینین <ArrowLeft size={12}/></Link>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
        <div className="grid gap-4 md:grid-cols-3">
          {benefits.map(({ icon: Icon, title, description }, index) => (
            <article key={title} className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm sm:rounded-3xl sm:p-6">
              <div className="flex items-center justify-between">
                <span className="grid h-11 w-11 place-items-center rounded-2xl bg-orange-50 text-[#f47721]"><Icon size={22}/></span>
                <span className="text-xs font-black text-slate-300">0{index + 1}</span>
              </div>
              <h3 className="mt-4 text-base font-black text-[#102f49]">{title}</h3>
              <p className="mt-2 text-sm leading-7 text-slate-600">{description}</p>
            </article>
          ))}
        </div>
        <div className="mt-8 flex flex-col items-center justify-between gap-5 rounded-3xl bg-[#102f49] px-6 py-8 text-center text-white sm:flex-row sm:px-9 sm:text-right">
          <div>
            <p className="text-xs font-black text-[#ffb36f]">SHAKH STORE</p>
            <h2 className="mt-2 text-xl font-black sm:text-2xl">ئامادەیت بازاڕەکە ببینیت؟</h2>
            <p className="mt-2 text-sm leading-7 text-blue-100">بەشەکان بگەڕێ و ئەوەی پێویستتە بدۆزەرەوە.</p>
          </div>
          <Link href="/shop" className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-[#f47721] px-5 py-3 font-black text-white transition hover:bg-orange-600">دەستپێبکە <ArrowUpLeft size={17}/></Link>
        </div>
      </section>

      <footer className="border-t border-slate-200 bg-white px-4 py-8 text-center sm:px-6">
        <ShakhBrand size="md" className="mx-auto justify-center" />
        <p className="mt-2 text-xs font-bold text-slate-500">بازاڕی ئۆنلاین و گەیاندن</p>
        <div className="mt-4 flex flex-wrap items-center justify-center gap-5 text-xs font-bold text-slate-500">
          <Link href="/shop" className="hover:text-[#f47721]">بازاڕ</Link>
          <Link href="/cart" className="hover:text-[#f47721]">سەبەتە</Link>
          <Link href={accountHref} className="hover:text-[#f47721]">هەژمار</Link>
        </div>
      </footer>
    </main>
  );
}
