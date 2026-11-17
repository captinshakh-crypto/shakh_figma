"use client";
import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [email,setEmail]=useState(""); const [password,setPassword]=useState(""); const [name,setName]=useState("");
  const [mode,setMode]=useState<"login"|"signup">("login"); const [message,setMessage]=useState(""); const [busy,setBusy]=useState(false);

  useEffect(() => {
    let active = true;
    const authError = new URLSearchParams(window.location.search).get("auth_error");
    if (authError) {
      setMessage(authError === "verification"
        ? "پشتڕاستکردنەوەی چوونەژوورەوە سەرکەوتوو نەبوو یان لینکەکە بەسەرچووە. دووبارە هەوڵ بدەرەوە."
        : "لینکی پشتڕاستکردنەوە دروست نەبوو. تکایە دووبارە هەوڵ بدەرەوە.");
      window.history.replaceState({}, "", window.location.pathname);
    }

    try {
      void Promise.resolve(createClient().auth.getUser()).then(({ data }) => {
        if (active && data.user) window.location.replace("/dashboard");
      }).catch(() => {
        // Keep the sign-in form available when the session check is temporarily offline.
      });
    } catch {
      // The form remains usable and will display an error on submit.
    }

    return () => { active = false; };
  }, []);

  async function submit(e:FormEvent) {
    e.preventDefault(); setBusy(true); setMessage("");
    try {
      const supabase=createClient();
      const callback = `${window.location.origin}/auth/callback?next=/dashboard`;
      const cleanEmail = email.trim();
      const result=mode==="login"
        ? await supabase.auth.signInWithPassword({email:cleanEmail,password})
        : await supabase.auth.signUp({email:cleanEmail,password,options:{data:{full_name:name.trim()},emailRedirectTo:callback}});
      if(result.error) setMessage(result.error.message);
      else if(mode==="signup") {
        if(result.data.session) window.location.href="/dashboard";
        else setMessage("هەژمارەکەت دروست کرا. تکایە ئیمەیڵەکەت بپشکنە و لینکی پشتڕاستکردنەوە بکەرەوە؛ دوای پشتڕاستکردنەوە پڕۆفایل و ڕۆڵەکەت پیشان دەدرێت.");
      } else window.location.href="/dashboard";
    } catch { setMessage("پەیوەندی بە داتابەیس نەکرا. ڕێکخستنی پڕۆژە بپشکنە."); }
    finally { setBusy(false); }
  }

  async function signInWithGoogle() {
    setBusy(true); setMessage("");
    try {
      const callback = `${window.location.origin}/auth/callback?next=/dashboard`;
      const { error } = await createClient().auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: callback,
          queryParams: { prompt: "select_account" },
        },
      });
      if (error) {
        setMessage("چوونەژوورەوە بە Google سەرکەوتوو نەبوو. ڕێکخستنی Google لە Supabase بپشکنە.");
        setBusy(false);
      }
    } catch {
      setMessage("نەتوانرا پەیوەندی بە Google دروست بکرێت. تکایە دواتر هەوڵ بدەرەوە.");
      setBusy(false);
    }
  }

  return <main className="grid min-h-screen place-items-center px-4 py-10"><div className="w-full max-w-md rounded-3xl bg-white p-7 shadow-soft"><Link href="/" className="font-black text-shakh-orange">← گەڕانەوە بۆ شاخ</Link><h1 className="mt-7 text-3xl font-black">{mode==="login"?"بەخێربێیتەوە":"هەژماری شاخ دروست بکە"}</h1><p className="mt-2 text-sm text-slate-500">بۆ بەکارهێنانی بازاڕ و گەیاندن بچۆ ژوورەوە.</p><form onSubmit={submit} className="mt-7 space-y-4">{mode==="signup"&&<label className="block text-sm font-bold">ناوی تەواو<input required value={name} onChange={e=>setName(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-shakh-blue"/></label>}<label className="block text-sm font-bold">ئیمەیڵ<input type="email" required value={email} onChange={e=>setEmail(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-shakh-blue"/></label><label className="block text-sm font-bold">وشەی نهێنی<input type="password" minLength={8} required value={password} onChange={e=>setPassword(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-shakh-blue"/></label>{mode==="login"&&<div className="text-left"><Link href="/forgot-password" className="text-sm font-bold text-shakh-blue">وشەی نهێنیت لەبیرکردووە؟</Link></div>}<button disabled={busy} className="w-full rounded-xl bg-shakh-orange px-4 py-3 font-bold text-white disabled:opacity-50">{busy?"تکایە چاوەڕێ بکە...":mode==="login"?"چوونەژوورەوە":"دروستکردنی هەژمار"}</button></form><div className="my-5 flex items-center gap-3"><span className="h-px flex-1 bg-slate-200"/><span className="text-xs text-slate-400">یان</span><span className="h-px flex-1 bg-slate-200"/></div><button type="button" disabled={busy} onClick={signInWithGoogle} className="flex w-full items-center justify-center gap-3 rounded-xl border border-slate-300 bg-white px-4 py-3 font-bold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"><span aria-hidden="true" className="text-xl font-black text-[#4285F4]">G</span>{busy?"تکایە چاوەڕێ بکە...":"بەردەوام بە Google"}</button>{message&&<p role="status" className="mt-4 rounded-xl bg-blue-50 p-3 text-sm text-blue-800">{message}</p>}<button onClick={()=>{setMode(mode==="login"?"signup":"login");setMessage("");}} className="mt-5 w-full text-sm font-bold text-shakh-blue">{mode==="login"?"هەژمارت نییە؟ هەژمار دروست بکە":"پێشتر هەژمارت هەیە؟ بچۆ ژوورەوە"}</button></div></main>;
}
