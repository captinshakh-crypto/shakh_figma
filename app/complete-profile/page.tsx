"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import ShakhBrand from "@/components/shakh-brand";
import { Phone, ShieldCheck } from "lucide-react";

function getNextPath() {
  const value = new URLSearchParams(window.location.search).get("next");
  return value === "/cart" ? "/cart" : "/dashboard";
}

export default function CompleteProfilePage() {
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;
    void createClient().auth.getUser().then(async ({ data }) => {
      if (!data.user) {
        window.location.replace("/login");
        return;
      }
      const { data: profile } = await createClient()
        .from("profiles").select("full_name,phone").eq("id", data.user.id).maybeSingle();
      if (!active) return;
      setName(profile?.full_name || String(data.user.user_metadata?.full_name || ""));
      setPhone(profile?.phone || "");
    });
    return () => { active = false; };
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!/^\+?(964)?0?7[0-9]{9}$/.test(phone.trim())) {
      setMessage("ژمارەی مۆبایلی عێراقی بە شێوەی دروست بنووسە؛ نموونە: 0750XXXXXXX.");
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      const { error } = await createClient().rpc("complete_my_phone", { p_phone: phone.trim() });
      if (error) throw error;
      window.location.replace(getNextPath());
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "پاشەکەوتکردنی ژمارەی مۆبایل سەرکەوتوو نەبوو.");
      setBusy(false);
    }
  }

  return (
    <main dir="rtl" className="grid min-h-screen place-items-center bg-[#f5f8fc] px-4 py-10">
      <section className="w-full max-w-lg rounded-3xl bg-white p-7 shadow-soft">
        <div className="flex justify-center"><ShakhBrand size="lg"/></div>
        <span className="mt-7 inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-2 text-xs font-black text-blue-800">
          <ShieldCheck size={16}/> تەواوکردنی زانیاری هەژمار
        </span>
        <h1 className="mt-4 text-2xl font-black text-[#0a2d50]">ژمارەی مۆبایلت پێویستە</h1>
        <p className="mt-2 text-sm leading-8 text-slate-600">
          بۆ تەواوکردنی ئەندامبوون و بەکارهێنانی خزمەتگوزارییەکانی شاخ ستۆر، ژمارەی مۆبایلی خۆت بنووسە. ئەم داواکارییە بۆ هەژمارەکانی Google ـیش پێویستە.
        </p>
        <form onSubmit={submit} className="mt-6 space-y-4">
          <label className="block text-sm font-bold">ناوی ئەندام
            <input readOnly value={name} className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-500"/>
          </label>
          <label className="block text-sm font-bold">ژمارەی مۆبایل <span className="text-red-600">*</span>
            <span className="relative mt-2 block">
              <Phone size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400"/>
              <input required autoFocus type="tel" inputMode="tel" autoComplete="tel" maxLength={16} value={phone}
                onChange={(event) => setPhone(event.target.value)} placeholder="0750XXXXXXX"
                pattern="(\+?(964)?0?7[0-9]{9})"
                className="w-full rounded-xl border border-slate-200 py-3 pl-4 pr-11 outline-none focus:border-shakh-blue"/>
            </span>
          </label>
          {message && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm leading-7 text-red-700">{message}</p>}
          <button disabled={busy} className="w-full rounded-xl bg-shakh-orange px-4 py-3 font-black text-white disabled:opacity-50">
            {busy ? "پاشەکەوت دەکرێت..." : "پاشەکەوت و بەردەوامبوون"}
          </button>
        </form>
        <p className="mt-5 text-center text-xs text-slate-500">
          <Link href="/privacy" className="font-bold text-shakh-blue underline">سیاسەتی تایبەتمەندی</Link>
        </p>
      </section>
    </main>
  );
}
