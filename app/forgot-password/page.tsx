"use client";
import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function ForgotPasswordPage() {
  const [email,setEmail]=useState(""); const [message,setMessage]=useState(""); const [busy,setBusy]=useState(false);
  useEffect(() => {
    const initialEmail = new URLSearchParams(window.location.search).get("email");
    if (initialEmail) setEmail(initialEmail.trim().toLowerCase());
  }, []);

  async function submit(e:FormEvent) {
    e.preventDefault(); setBusy(true); setMessage("");
    try {
      const supabase=createClient();
      const redirectTo="https://daim-post.online/auth/callback?next=/reset-password";
      const {error}=await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(),{redirectTo});
      setMessage(error
        ? error.status === 429
          ? "داواکاریی زۆر نێردراوە. تکایە کەمێک چاوەڕێ بکە و دووبارە هەوڵ بدەرەوە."
          : "ناردنی لینکی گۆڕینی وشەی نهێنی سەرکەوتوو نەبوو. تکایە دواتر هەوڵ بدەرەوە."
        : "ئەگەر ئەم ئیمەیڵە هەژماری تۆی هەبێت، لینکی گۆڕینی وشەی نهێنی بۆی دەنێردرێت. Inbox و Spam بپشکنە.");
    } catch { setMessage("هەڵەیەک ڕوویدا. تکایە دواتر هەوڵ بدەرەوە."); }
    finally { setBusy(false); }
  }
  return <main className="grid min-h-screen place-items-center px-4 py-10"><section className="w-full max-w-md rounded-3xl bg-white p-7 shadow-soft"><Link href="/login" className="font-bold text-shakh-blue">← گەڕانەوە بۆ چوونەژوورەوە</Link><h1 className="mt-7 text-2xl font-black">گەڕاندنەوەی وشەی نهێنی</h1><p className="mt-2 text-sm text-slate-500">ئیمەیڵەکەت بنووسە بۆ ناردنی لینکی گۆڕینی وشەی نهێنی.</p><form onSubmit={submit} className="mt-6 space-y-4"><label className="block text-sm font-bold">ئیمەیڵ<input required type="email" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3"/></label><button disabled={busy} className="w-full rounded-xl bg-shakh-orange px-4 py-3 font-bold text-white disabled:opacity-50">{busy?"تکایە چاوەڕێ بکە...":"ناردنی لینک"}</button></form>{message&&<p className="mt-4 rounded-xl bg-blue-50 p-3 text-sm text-blue-800">{message}</p>}</section></main>;
}
