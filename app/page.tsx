"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import {
  ArrowLeft,
  BadgeCheck,
  Beef,
  Carrot,
  ChevronLeft,
  Clock3,
  PackageCheck,
  Search,
  ShieldCheck,
  ShoppingBag,
  Store,
  Truck,
  Utensils,
  UserRound,
  WalletCards,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

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
  captain: "کپتن",
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
  { key: "restaurant", label: "چێشتخانە", detail: "خواردن و خواردنەوە", icon: Utensils },
  { key: "supermarket", label: "سوپەرمارکێت", detail: "پێداویستیی ماڵەوە", icon: Store },
  { key: "butcher_poultry", label: "گۆشت و مریشک", detail: "کاڵای تازە و ڕۆژانە", icon: Beef },
  { key: "grocery", label: "بەقالی", detail: "شتە پێویستەکانی ڕۆژانە", icon: Carrot },
];

const benefits = [
  {
    icon: PackageCheck,
    title: "داواکاری لە یەک شوێن",
    description: "بەشە جیاوازەکانی بازاڕ بە ڕووکاری یەکگرتوو و ڕێکخراو.",
  },
  {
    icon: Truck,
    title: "ڕێکخستنی گەیاندن",
    description: "ڕۆڵی فرۆشیار و کاپتن لە پرۆسەی داواکارییەکاندا دیاریکراوە.",
  },
  {
    icon: WalletCards,
    title: "حیسابی ڕوون",
    description: "تۆمارکردنی جوڵەی جزدان و مامەڵەکان بە شێوەی ناوخۆیی.",
  },
];

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
        const supabase = createClient();
        const { data, error: queryError } = await supabase
          .from("products")
          .select("id,title,description,price_iqd,image_path,category_key,is_shakh_store")
          .eq("is_available", true)
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
    return () => {
      active = false;
    };
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
      const fallbackProfile: ProfileSummary = {
        full_name: getUserName(user),
        email: user.email ?? null,
        role: null,
      };

      void Promise.resolve(
        supabase
          .from("profiles")
          .select("full_name,role")
          .eq("id", user.id)
          .maybeSingle()
      ).then(({ data }) => {
          if (!active || currentRevision !== revision) return;
          setProfile({
            full_name: data?.full_name || fallbackProfile.full_name,
            email: user.email ?? null,
            role: data?.role ?? null,
          });
          setAuthLoading(false);
        })
        .catch(() => {
          if (!active || currentRevision !== revision) return;
          setProfile(fallbackProfile);
          setAuthLoading(false);
        });
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      syncUser(session?.user ?? null);
    });

    void supabase.auth.getUser().then(({ data }) => {
      if (active) syncUser(data.user);
    }).catch(() => {
      if (active) setAuthLoading(false);
    });

    return () => {
      active = false;
      revision += 1;
      subscription.unsubscribe();
    };
  }, []);

  const accountLink = profile ? (
    <Link
      href="/dashboard"
      aria-label={`پڕۆفایلی ${profile.full_name}، ڕۆڵ: ${profile.role ? roleLabels[profile.role] || profile.role : "دیاری نەکراو"}`}
      className="inline-flex min-w-0 items-center gap-2 rounded-xl border border-orange-200 bg-orange-50 px-3 py-2 transition hover:border-shakh-orange hover:bg-orange-100"
    >
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-shakh-orange text-white">
        <UserRound size={18} />
      </span>
      <span className="min-w-0 text-right">
        <b className="block max-w-36 truncate text-sm text-shakh-ink">{profile.full_name}</b>
        <small className="block text-xs text-shakh-blue">
          {profile.role ? roleLabels[profile.role] || profile.role : "ڕۆڵ دیاری نەکراو"}
        </small>
      </span>
    </Link>
  ) : null;

  return (
    <main className="min-h-screen overflow-hidden">
      <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/95 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
          <Link href="/" aria-label="SHAKH - سەرەتا" className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-shakh-orange text-2xl font-black text-white shadow-soft">ش</span>
            <span>
              <b className="block text-lg tracking-[0.16em] text-shakh-ink">SHAKH</b>
              <small className="block text-xs text-slate-500">شاخ · بازاڕ و گەیاندن</small>
            </span>
          </Link>
          <nav aria-label="ناڤی سەرەکی" className="flex items-center gap-2">
            <Link href="/shop" className="hidden rounded-xl px-4 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-100 sm:inline-flex">بازاڕ</Link>
            {authLoading ? (
              <span className="h-11 w-28 animate-pulse rounded-xl bg-slate-100" aria-label="بارکردنی پڕۆفایل" />
            ) : profile ? (
              accountLink
            ) : (
              <>
                <Link href="/login" className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-shakh-ink transition hover:border-shakh-blue hover:text-shakh-blue">چوونەژوورەوە</Link>
                <Link href="/login" className="rounded-xl bg-shakh-orange px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-orange-600">هەژمار دروست بکە</Link>
              </>
            )}
          </nav>
        </div>
      </header>

      <section className="relative isolate bg-[#102f49] text-white">
        <div aria-hidden="true" className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_15%_20%,rgba(244,119,33,.24),transparent_32%),radial-gradient(circle_at_85%_80%,rgba(23,105,170,.45),transparent_38%)]" />
        <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 py-16 sm:px-6 md:grid-cols-[1.1fr_.9fr] md:py-24 lg:px-8">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-blue-100">
              <BadgeCheck size={16} className="text-orange-300" />
              بازاڕی دیجیتاڵی شاخ
            </div>
            <h1 className="mt-7 max-w-2xl text-4xl font-black leading-[1.35] tracking-tight sm:text-5xl lg:text-6xl">
              پێویستییەکانی ڕۆژانەت
              <span className="mt-2 block text-orange-300">لە یەک شوێن، بە شاخ</span>
            </h1>
            <p className="mt-6 max-w-xl text-base leading-8 text-slate-200 sm:text-lg">
              چێشتخانە، سوپەرمارکێت، گۆشت و بەقالی لە پلاتفۆرمێکی یەکگرتوودا بدۆزەرەوە؛
              کاڵاکانت هەڵبژێرە و داواکارییەکەت بە ئاسانی ڕێکبخە.
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Link href="/shop" className="inline-flex items-center gap-3 rounded-xl bg-shakh-orange px-6 py-3.5 font-bold text-white shadow-lg shadow-orange-950/20 transition hover:-translate-y-0.5 hover:bg-orange-600">
                بینینی بازاڕ <ArrowLeft size={18} />
              </Link>
              {authLoading ? null : profile ? (
                <Link href="/dashboard" className="inline-flex items-center gap-2 rounded-xl border border-white/25 bg-white/5 px-6 py-3.5 font-bold text-white transition hover:bg-white/10">
                  پڕۆفایل و ڕۆڵ <UserRound size={18} />
                </Link>
              ) : (
                <Link href="/login" className="inline-flex items-center gap-2 rounded-xl border border-white/25 bg-white/5 px-6 py-3.5 font-bold text-white transition hover:bg-white/10">
                  چوونەژوورەوە <ChevronLeft size={18} />
                </Link>
              )}
            </div>
            <div className="mt-10 flex flex-wrap gap-x-7 gap-y-3 text-sm text-slate-300">
              <span className="inline-flex items-center gap-2"><ShieldCheck size={17} className="text-orange-300" /> پاراستنی دەستگەیشتن</span>
              <span className="inline-flex items-center gap-2"><Clock3 size={17} className="text-orange-300" /> ڕێکخستنی داواکاری</span>
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-lg">
            <div className="absolute -inset-4 rounded-[2.5rem] bg-gradient-to-br from-shakh-orange/25 to-shakh-blue/25 blur-2xl" />
            <div className="relative rounded-[2rem] border border-white/15 bg-white/10 p-4 shadow-2xl backdrop-blur-xl sm:p-6">
              <div className="rounded-[1.5rem] bg-white p-5 text-shakh-ink sm:p-6">
                <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                  <div>
                    <p className="text-xs font-bold text-shakh-orange">SHAKH MARKETPLACE</p>
                    <h2 className="mt-1 text-xl font-black">بەشەکانی بازاڕ</h2>
                  </div>
                  <span className="grid h-11 w-11 place-items-center rounded-2xl bg-orange-50 text-shakh-orange"><ShoppingBag size={22} /></span>
                </div>
                <div className="mt-5 grid grid-cols-2 gap-3">
                  {categories.map(({ key, label, detail, icon: Icon }) => (
                    <Link key={key} href="/shop" className="group rounded-2xl border border-slate-100 bg-slate-50 p-4 transition hover:border-orange-200 hover:bg-orange-50/70">
                      <span className="grid h-10 w-10 place-items-center rounded-xl bg-white text-shakh-blue shadow-sm transition group-hover:text-shakh-orange"><Icon size={20} /></span>
                      <b className="mt-3 block text-sm">{label}</b>
                      <span className="mt-1 block text-xs leading-5 text-slate-500">{detail}</span>
                    </Link>
                  ))}
                </div>
                <div className="mt-4 flex items-center gap-3 rounded-xl bg-[#eef5fb] p-3.5">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-white text-shakh-blue"><Search size={18} /></span>
                  <span className="text-sm font-semibold text-slate-700">کاڵا و فرۆشگاکانت بە ئاسانی بگەڕێ</span>
                  <ArrowLeft size={16} className="mr-auto text-shakh-blue" />
                </div>
              </div>
              <div className="mt-4 flex items-center justify-between px-2 text-xs text-blue-100/80">
                <span>یەک پلاتفۆرم بۆ چەندین جۆری بازاڕ</span>
                <span className="font-bold tracking-widest">SHAKH</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-black tracking-wide text-shakh-orange">چۆن کار دەکات؟</p>
          <h2 className="mt-3 text-3xl font-black text-shakh-ink sm:text-4xl">ئەزموونێکی سادە و ڕێکخراو</h2>
          <p className="mt-4 leading-8 text-slate-600">لە گەڕان بەدوای کاڵا تا تەواوکردنی داواکاری، هەنگاوەکان بە ڕوونی ڕێکخراون.</p>
        </div>
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {benefits.map(({ icon: Icon, title, description }, index) => (
            <article key={title} className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-soft">
              <div className="flex items-center justify-between">
                <span className="grid h-12 w-12 place-items-center rounded-2xl bg-orange-50 text-shakh-orange"><Icon size={23} /></span>
                <span className="text-sm font-black text-slate-300">0{index + 1}</span>
              </div>
              <h3 className="mt-5 text-lg font-black text-shakh-ink">{title}</h3>
              <p className="mt-2 text-sm leading-7 text-slate-600">{description}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="categories" className="border-y border-slate-200/80 bg-white py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-sm font-black text-shakh-orange">بەشە سەرەکییەکان</p>
              <h2 className="mt-2 text-3xl font-black text-shakh-ink">بازاڕەکە بە پێی پێویستییەکانت</h2>
            </div>
            <Link href="/shop" className="inline-flex items-center gap-2 text-sm font-bold text-shakh-blue hover:text-shakh-orange">هەموو کاڵاکان <ArrowLeft size={16} /></Link>
          </div>
          <div className="mt-8 grid grid-cols-2 gap-3 md:grid-cols-4">
            {categories.map(({ key, label, detail, icon: Icon }) => (
              <Link href="/shop" key={key} className="group rounded-2xl border border-slate-200 bg-shakh-mist/50 p-5 transition hover:-translate-y-1 hover:border-orange-200 hover:bg-white hover:shadow-soft">
                <span className="grid h-12 w-12 place-items-center rounded-xl bg-white text-shakh-blue shadow-sm transition group-hover:text-shakh-orange"><Icon size={23} /></span>
                <b className="mt-4 block text-base text-shakh-ink">{label}</b>
                <span className="mt-1 block text-sm text-slate-500">{detail}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-black text-shakh-orange">هەڵبژاردەی بازاڕ</p>
            <h2 className="mt-2 text-3xl font-black text-shakh-ink">کاڵا نوێ و بەردەستەکان</h2>
          </div>
          <Link href="/shop" className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-shakh-blue transition hover:border-shakh-blue">چوون بۆ بازاڕ <ArrowLeft size={16} /></Link>
        </div>

        {loading ? (
          <div className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-4" aria-label="بارکردنی کاڵاکان">
            {Array.from({ length: 4 }).map((_, index) => <div key={index} className="animate-pulse overflow-hidden rounded-2xl bg-white"><div className="aspect-[4/3] bg-slate-200" /><div className="space-y-2 p-4"><div className="h-4 w-3/4 rounded bg-slate-200" /><div className="h-4 w-1/3 rounded bg-slate-200" /></div></div>)}
          </div>
        ) : error ? (
          <p role="status" className="mt-8 rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center text-sm text-amber-900">{error}</p>
        ) : products.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
            <ShoppingBag className="mx-auto text-slate-300" size={36} />
            <p className="mt-3 font-bold text-shakh-ink">هێشتا کاڵایەک لەم بەشەدا نییە</p>
            <p className="mt-2 text-sm text-slate-500">کاتێک فرۆشیارەکان کاڵا زیاد بکەن، لێرە پیشان دەدرێن.</p>
          </div>
        ) : (
          <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
            {products.map((product) => (
              <article key={product.id} className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-soft transition hover:-translate-y-1">
                <div className="grid aspect-[4/3] place-items-center overflow-hidden bg-shakh-mist text-shakh-blue">
                  {product.image_path ? (
                    <img src={createClient().storage.from("product-images").getPublicUrl(product.image_path).data.publicUrl} alt={product.title} loading="lazy" className="h-full w-full object-cover" />
                  ) : <ShoppingBag size={34} />}
                </div>
                <div className="p-4">
                  <span className="text-xs font-semibold text-slate-500">{product.is_shakh_store ? "شاخ ستۆر" : "فرۆشیاری هاوبەش"}</span>
                  <h3 className="mt-1 line-clamp-2 min-h-10 font-bold text-shakh-ink">{product.title}</h3>
                  <p className="mt-3 font-black text-shakh-orange">{product.price_iqd.toLocaleString("en-US")} د.ع</p>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="px-4 pb-16 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-6 rounded-[2rem] bg-gradient-to-l from-shakh-blue to-[#10466f] p-8 text-white shadow-xl sm:flex-row sm:items-center sm:p-10">
          <div className="max-w-2xl">
            <p className="text-sm font-bold text-orange-200">ئامادەی دەستپێکردنیت؟</p>
            <h2 className="mt-2 text-2xl font-black sm:text-3xl">بازاڕی شاخ ببینە و داواکارییەکەت ڕێکبخە</h2>
            <p className="mt-3 text-sm leading-7 text-blue-100">کاڵاکان بگەڕێ، هەڵبژاردەکانت ببینە و بە هەژماری خۆت بەردەوام بە.</p>
          </div>
          <Link href="/shop" className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-shakh-orange px-6 py-3.5 font-bold text-white transition hover:bg-orange-600">بینینی بازاڕ <ArrowLeft size={18} /></Link>
        </div>
      </section>

      <footer className="bg-[#10283d] px-4 py-10 text-slate-300 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 text-center sm:flex-row sm:text-right">
          <div>
            <p className="text-lg font-black tracking-[0.18em] text-white">SHAKH</p>
            <p className="mt-1 text-sm text-slate-400">شاخ · بازاڕ و گەیاندن</p>
          </div>
          <p className="text-xs text-slate-400">© {new Date().getFullYear()} SHAKH. هەموو مافەکان پارێزراون.</p>
          {authLoading ? null : profile ? (
            <Link href="/dashboard" className="text-sm font-semibold text-white transition hover:text-orange-300">پڕۆفایل · {profile.role ? roleLabels[profile.role] || profile.role : "ڕۆڵ دیاری نەکراو"}</Link>
          ) : (
            <Link href="/login" className="text-sm font-semibold text-white transition hover:text-orange-300">هەژمار و چوونەژوورەوە</Link>
          )}
        </div>
      </footer>
    </main>
  );
}
