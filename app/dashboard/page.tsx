"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { LogOut, ShieldCheck, Store, Wallet, Package, Truck, UserRound } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import ShakhBrand from "@/components/shakh-brand";

const labels: Record<string, string> = {
  super_admin: "سوپەر ئەدمین",
  captain: "کاپتن",
  customer: "کڕیار",
  supermarket: "سوپەرمارکێت",
  restaurant: "چێشتخانە",
  butcher_poultry: "گۆشت و سپیاتی",
  grocery: "بەقالی",
};

export default function DashboardPage() {
  const [profile, setProfile] = useState<{ full_name: string | null; role: string } | null>(null);
  const [balance, setBalance] = useState(0);
  const [captainLabel, setCaptainLabel] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { window.location.href = "/login"; return; }
        const [profileResult, roleResult] = await Promise.all([
          supabase.from("profiles").select("full_name,role").eq("id", user.id).single(),
          supabase.rpc("current_app_role"),
        ]);
        if (profileResult.error) throw profileResult.error;
        if (roleResult.error) throw roleResult.error;
        if (!active || !profileResult.data) return;
        // Read the role through the server-side SECURITY DEFINER helper as well
        // as the profile row so the role badge never depends on stale client data.
        const currentRole = roleResult.data || profileResult.data.role;
        setProfile({
          ...profileResult.data,
          role: currentRole,
        });

        const wallet = await supabase.from("wallets").select("balance_iqd").eq("user_id", user.id).maybeSingle();
        if (!active) return;
        setBalance(wallet.data?.balance_iqd || 0);

        if (currentRole === "captain") {
          const { data: captain } = await supabase.from("captain_profiles")
            .select("captain_type,merchant_id").eq("user_id", user.id).maybeSingle();
          if (!active) return;
          if (captain?.captain_type === "shakh") setCaptainLabel("کپتنی شاخ");
          else if (captain?.captain_type === "merchant" && captain.merchant_id) {
            const { data: merchant } = await supabase.from("merchant_profiles")
              .select("business_name").eq("id", captain.merchant_id).maybeSingle();
            if (active) setCaptainLabel("کپتنی تایبەت بە " + (merchant?.business_name || "دوکان"));
          }
        }
      } catch {
        if (active) setError("نەتوانرا زانیاری هەژمار باربکرێت.");
      }
    }
    void load();
    return () => { active = false; };
  }, []);

  async function logout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/";
  }

  const roleLabel = profile?.role === "captain" && captainLabel
    ? captainLabel
    : profile ? labels[profile.role] || profile.role : "بارکردن...";

  return (
    <main className="min-h-screen px-4 py-8">
      <div className="mx-auto max-w-5xl">
        <header className="flex items-center justify-between">
          <ShakhBrand size="sm" />
          <button onClick={logout} className="flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-bold"><LogOut size={16}/> دەرچوون</button>
        </header>

        <section className="mt-8 rounded-3xl bg-gradient-to-l from-shakh-blue to-[#0e477b] p-8 text-white">
          <p className="text-blue-100">داشبۆردی شاخ</p>
          <h1 className="mt-2 text-3xl font-black">{profile?.full_name || "بەکارهێنەر"}</h1>
          <p className="mt-2">{roleLabel}</p>
        </section>

        {error && <p className="mt-5 rounded-xl bg-red-50 p-4 text-red-700">{error}</p>}

        {profile && profile.role !== "customer" && profile.role !== "super_admin" && balance <= 0 && <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">بۆ چالاکییەکانی دوکان، جزدانەکەت نابێت بەتاڵ بێت؛ بۆ کاپتنیش کۆمسیۆنی ٢٠٪ی گەیاندن پێشتر لە جزدان کەم دەکرێتەوە. باڵانسی ئێستا: {balance.toLocaleString("en-US")} د.ع. <Link href="/dashboard/wallet" className="font-black underline">پڕکردنەوەی جزدان</Link></div>}

        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Link href="/dashboard/profile" className="rounded-2xl border border-orange-100 bg-orange-50 p-6 shadow-soft">
            <UserRound className="text-shakh-orange"/>
            <b className="mt-4 block">پڕۆفایل و ڕۆڵ</b>
            <p className="mt-1 text-sm text-slate-500">زانیاری کەسی و داواکاری ڕۆڵ</p>
          </Link>
          <Link href="/dashboard/wallet" className="rounded-2xl bg-white p-6 shadow-soft">
            <Wallet className="text-shakh-orange"/>
            <b className="mt-4 block">جزدان</b>
            <p className="mt-1 text-xl font-black">{balance.toLocaleString("en-US")} د.ع</p>
          </Link>
          <Link href="/dashboard/orders" className="rounded-2xl bg-white p-6 shadow-soft">
            <Package className="text-shakh-blue"/>
            <b className="mt-4 block">داواکارییەکان</b>
            <p className="mt-1 text-sm text-slate-500">شوێنکەوتن و بەڕێوەبردن</p>
          </Link>
          <Link href="/dashboard/store" className="rounded-2xl bg-white p-6 shadow-soft">
            <Store className="text-shakh-blue"/>
            <b className="mt-4 block">بەشی فرۆشگا</b>
            <p className="mt-1 text-sm text-slate-500">بەپێی ڕۆڵی هەژمارەکەت</p>
          </Link>
          {profile?.role === "super_admin" && (
            <Link href="/dashboard/admin" className="rounded-2xl bg-orange-50 p-6 shadow-soft">
              <ShieldCheck className="text-shakh-orange"/>
              <b className="mt-4 block">بەڕێوەبردنی سوپەر ئەدمین</b>
              <p className="mt-1 text-sm text-slate-500">کۆمسیۆن، جزدان و داواکارییەکان</p>
            </Link>
          )}
          {profile?.role === "captain" && (
            <Link href="/dashboard/deliveries" className="rounded-2xl bg-white p-6 shadow-soft">
              <Truck className="text-shakh-blue"/>
              <b className="mt-4 block">گەیاندنەکان</b>
              <p className="mt-1 text-sm text-slate-500">{roleLabel}</p>
            </Link>
          )}
        </div>
      </div>
    </main>
  );
}
