"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import {
  ArrowLeft, ArrowUpLeft, Beef, Carrot, ChevronLeft, Clock3,
  PackageCheck, Search, ShieldCheck, ShoppingBag, Store, Truck, Utensils,
  UserRound, WalletCards, Sparkles, CircleCheck, ShoppingBasket, Headset,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import PwaInstallCta from "@/components/pwa-install-cta";
import ShakhBrand from "@/components/shakh-brand";
import { NotificationsHeaderBell } from "@/components/notifications-center";
import { ShakhDeliveryArt } from "@/components/shakh-delivery-art";
import { SupportContactSection } from "@/components/support-contact";

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
  { key: "restaurant", label: "چێشتخانە", detail: "خواردن و خواردنەوە", icon: Utensils, tone: "from-orange-50 to-rose-50", color: "text-orange-600", href: "/shop" },
  { key: "supermarket", label: "سوپەرمارکێت", detail: "پێداویستیی ماڵەوە", icon: Store, tone: "from-blue-50 to-cyan-50", color: "text-blue-700", href: "/shop" },
  { key: "butcher_poultry", label: "گۆشت و سپیاتی", detail: "کاڵای تازە و ڕۆژانە", icon: Beef, tone: "from-rose-50 to-red-50", color: "text-rose-700", href: "/shop" },
  { key: "grocery", label: "بەقالی", detail: "پێداویستییە ڕۆژانەکان", icon: Carrot, tone: "from-emerald-50 to-lime-50", color: "text-emerald-700", href: "/shop" },
  { key: "delivery", label: "گەیاندن", detail: "شوێنکەوتنی داواکاری", icon: Truck, tone: "from-sky-50 to-blue-50", color: "text-sky-700", href: "/dashboard/orders" },
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
      <div className="relative overflow-hidden bg-[#0a2d50] px-4 py-2 text-center text-xs font-bold text-white/90 sm:text-sm">
        شاخ ستۆر · هەموو پێویستییەکانت لە یەک بازاڕدا
        <span aria-hidden="true" className="absolute inset-x-0 bottom-0 h-[3px] bg-gradient-to-l from-[#ffb21d] via-[#f47721] to-transparent"/>
      </div>

      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#082c50] text-white shadow-[0_10px_30px_rgba(5,35,67,.18)]">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-2 px-3 py-3 sm:gap-4 sm:px-6 lg:px-8">
          <ShakhBrand size="md" onDark />
          <nav aria-label="ناڤی سەرەکی" className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            <Link href="/shop" className="hidden rounded-xl px-4 py-2.5 text-sm font-black text-white transition hover:bg-white/10 sm:inline-flex">بازاڕ</Link>
            <Link href="/support" aria-label="پشتگیری" title="پشتگیری" className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/15 bg-white/10 text-white transition hover:bg-white/20"><Headset size={19}/></Link>
            <NotificationsHeaderBell />
            <PwaInstallCta compact />
            <Link href="/cart" aria-label="سەبەتە" className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/15 bg-white/10 text-white transition hover:bg-white/20">
              <ShoppingBasket size={20}/>
            </Link>
            <Link href={accountHref} aria-label={accountLabel} className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/15 bg-white/10 text-white transition hover:bg-white/20 sm:h-11 sm:w-11">
              <UserRound size={20}/>
            </Link>
          </nav>
        </div>
        <div aria-hidden="true" className="h-[3px] bg-gradient-to-l from-[#ffb21d] via-[#f47721] to-[#0b4778]"/>
      </header>

      <section aria-labelledby="home-hero-title" className="relative overflow-hidden bg-[linear-gradient(135deg,#f8fbff_0%,#fff_48%,#fff5e9_100%)] py-7 sm:py-10 lg:py-14">
        <div aria-hidden="true" className="pointer-events-none absolute -left-28 top-8 h-80 w-80 rounded-full border-[36px] border-orange-100/55"/>
        <div aria-hidden="true" className="pointer-events-none absolute -right-24 bottom-0 h-96 w-96 rounded-full border-[46px] border-blue-50/90"/>
        <div className="relative mx-auto max-w-7xl px-3 sm:px-6 lg:px-8">
          <div className="grid items-center gap-2 overflow-hidden rounded-[2rem] border border-white bg-white/90 shadow-[0_28px_80px_rgba(14,47,80,.12)] md:grid-cols-[1.02fr_.98fr] md:gap-0">
            <div dir="rtl" className="relative z-10 order-2 px-5 py-7 text-right sm:px-9 sm:py-10 lg:px-12 lg:py-12 md:order-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-orange-50 px-3.5 py-2 text-[11px] font-black tracking-[.12em] text-[#e96916] sm:text-xs">SHAKH STORE</span>
                <span className="rounded-full border border-blue-100 bg-blue-50 px-3 py-2 text-xs font-bold text-[#1769aa]">بازاڕی ئۆنلاین و گەیاندن</span>
              </div>
              <h1 id="home-hero-title" className="mt-5 text-[2rem] font-black leading-[1.48] tracking-tight text-[#0a2d50] sm:mt-6 sm:text-4xl sm:leading-[1.38] lg:text-[3.35rem]">
                هەموو پێویستییەکانت
                <span className="block text-[#f47721]">لە شاخ ستۆر</span>
              </h1>
              <p className="mt-4 max-w-xl text-sm leading-8 text-slate-600 sm:text-base sm:leading-9">
                چێشتخانە، سوپەرمارکێت، گۆشت و سپیاتی و بەقالی لە یەک بازاڕدا ببینە؛ کاڵای دڵخوازت هەڵبژێرە و داواکارییەکەت بە ئاسانی ڕێکبخە.
              </p>
              <div className="mt-6 flex flex-wrap items-center gap-3">
                <Link href="/shop" className="inline-flex items-center gap-2 rounded-xl bg-[#f47721] px-5 py-3.5 text-sm font-black text-white shadow-lg shadow-orange-200 transition hover:-translate-y-0.5 hover:bg-orange-600 sm:px-6 sm:text-base">
                  بینینی بازاڕ <ArrowLeft size={18}/>
                </Link>
                <Link href={accountHref} className="inline-flex items-center gap-2 rounded-xl border border-[#dbe5ef] bg-white px-4 py-3.5 text-sm font-black text-[#0a2d50] transition hover:border-orange-200 hover:bg-orange-50">
                  {profile ? "چوون بۆ داشبۆرد" : "چوونەژوورەوە"} <ChevronLeft size={17}/>
                </Link>
              </div>
              <div className="mt-7 flex flex-wrap gap-x-5 gap-y-3 text-xs font-bold text-slate-500 sm:text-sm">
                <span className="inline-flex items-center gap-2"><ShieldCheck size={16} className="text-[#f47721]"/> پاراستنی هەژمار</span>
                <span className="inline-flex items-center gap-2"><Truck size={16} className="text-[#f47721]"/> خزمەتی گەیاندن</span>
                <span className="inline-flex items-center gap-2"><CircleCheck size={16} className="text-[#f47721]"/> چوار جۆری بازاڕ</span>
              </div>
            </div>
            <div className="relative order-1 flex min-h-[290px] items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_35%_35%,#ffb21d_0%,#ff8a12_48%,#ed4b0d_100%)] px-5 py-7 sm:min-h-[390px] md:order-2 md:min-h-[510px] lg:min-h-[560px]">
              <div aria-hidden="true" className="absolute inset-0 opacity-25">
                <div className="absolute -right-12 -top-20 h-72 w-72 rounded-full border-[30px] border-white"/>
                <div className="absolute -bottom-32 -left-10 h-80 w-80 rounded-full border-[35px] border-white"/>
                <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-[#8e2b10]/20 to-transparent"/>
              </div>
              <ShakhDeliveryArt size={520} className="relative z-10 h-auto w-full max-w-[440px] drop-shadow-[0_24px_30px_rgba(88,35,13,.24)] sm:max-w-[480px]"/>
              <div className="absolute bottom-5 left-5 z-20 inline-flex max-w-[calc(100%-2.5rem)] items-center gap-1.5 whitespace-nowrap rounded-full border border-white/80 bg-white px-4 py-2.5 text-xs font-black text-[#0b3156] shadow-[0_8px_24px_rgba(7,38,70,.28)] backdrop-blur sm:bottom-7 sm:left-7 sm:px-5 sm:py-3 sm:text-sm">
                <span className="ml-2 inline-block h-2 w-2 rounded-full bg-[#f47721]"/> شاخ · خزمەتی گەیاندن
              </div>
            </div>
          </div>
          <div className="mx-auto mt-5 grid max-w-4xl grid-cols-3 gap-2 sm:mt-6 sm:gap-3">
            <div className="rounded-2xl border border-blue-100 bg-white/90 px-2 py-3 text-center shadow-sm sm:px-4">
              <b className="block text-sm font-black text-[#0a2d50] sm:text-base">بازاڕی یەکگرتوو</b>
              <span className="mt-1 block text-[10px] font-semibold text-slate-500 sm:text-xs">هەموو بەشەکان</span>
            </div>
            <div className="rounded-2xl border border-orange-100 bg-white/90 px-2 py-3 text-center shadow-sm sm:px-4">
              <b className="block text-sm font-black text-[#0a2d50] sm:text-base">داواکاری ئاسان</b>
              <span className="mt-1 block text-[10px] font-semibold text-slate-500 sm:text-xs">لە یەک شوێن</span>
            </div>
            <div className="rounded-2xl border border-blue-100 bg-white/90 px-2 py-3 text-center shadow-sm sm:px-4">
              <b className="block text-sm font-black text-[#0a2d50] sm:text-base">گەیاندنی ڕێکخراو</b>
              <span className="mt-1 block text-[10px] font-semibold text-slate-500 sm:text-xs">بە شێوەی سیستەمی</span>
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
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-5">
          {categories.map(({ key, label, detail, icon: Icon, tone, color, href }) => (
            <Link href={href} key={key} className="group flex min-h-[190px] flex-col items-center justify-center rounded-[1.65rem] border border-slate-200/80 bg-white px-3 py-5 text-center shadow-[0_9px_25px_rgba(12,44,75,.07)] transition duration-300 hover:-translate-y-1.5 hover:border-orange-200 hover:shadow-[0_18px_38px_rgba(12,44,75,.12)] sm:min-h-[218px] sm:rounded-[1.9rem] sm:px-4">
              <span className={`grid h-[76px] w-[76px] place-items-center rounded-[1.55rem] bg-gradient-to-br ${tone} ${color} shadow-inner transition duration-300 group-hover:scale-105 sm:h-[88px] sm:w-[88px]`}>
                <Icon size={36} strokeWidth={1.9}/>
              </span>
              <b className="mt-4 block text-base font-black text-[#0a2d50] sm:text-lg">{label}</b>
              <span className="mt-1 block text-xs leading-6 text-slate-500 sm:text-sm">{detail}</span>
              <span className="mt-2 inline-flex items-center gap-1 text-[11px] font-black text-[#e96916] sm:text-xs">بینین <ArrowLeft size={13}/></span>
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

      <SupportContactSection />

      <footer className="border-t border-slate-200 bg-white px-4 py-8 text-center sm:px-6">
        <ShakhBrand size="md" className="mx-auto justify-center" />
        <p className="mt-2 text-xs font-bold text-slate-500">بازاڕی ئۆنلاین و گەیاندن</p>
        <div className="mt-4 flex flex-wrap items-center justify-center gap-5 text-xs font-bold text-slate-500">
          <Link href="/shop" className="hover:text-[#f47721]">بازاڕ</Link>
          <Link href="/cart" className="hover:text-[#f47721]">سەبەتە</Link>
          <Link href="/support" className="hover:text-[#f47721]">پشتگیری</Link>
          <Link href="/faq" className="hover:text-[#f47721]">پرسیارە باوەکان</Link>
          <Link href="/privacy" className="hover:text-[#f47721]">سیاسەتی تایبەتمەندی</Link>
          <Link href={accountHref} className="hover:text-[#f47721]">هەژمار</Link>
        </div>
      </footer>
    </main>
  );
}
