"use client";
import Link from "next/link";
import { FormEvent, useState } from "react";
import { createClient } from "@/lib/supabase/client";
export default function LoginPage() {
  const [email,setEmail]=useState(""); const [password,setPassword]=useState(""); const [name,setName]=useState("");
  const [mode,setMode]=useState<"login"|"signup">("login"); const [message,setMessage]=useState(""); const [busy,setBusy]=useState(false);
  async function submit(e:FormEvent) {
    e.preventDefault(); setBusy(true); setMessage("");
    try {
      const supabase=createClient();
      const result=mode==="login"
        ? await supabase.auth.signInWithPassword({email,password})
        : await supabase.auth.signUp({email,password,options:{data:{full_name:name}}});
      if(result.error) setMessage(result.error.message);
      else if(mode==="signup") setMessage("هەژمارەکەت دروست کرا. ئەگەر پشتڕاستکردنەوەی ئیمەیڵ چالاکە، تکایە ئیمەیڵەکەت پشتڕاست بکەرەوە.");
      else window.location.href="/dashboard";
    } catch { setMessage("پەیوەندی بە داتابەیس نەکرا. ڕێکخستنی پڕۆژە بپشکنە."); }
    finally { setBusy(false); }
  }
  return <main className="grid min-h-screen place-items-center px-4 py-10"><div className="w-full max-w-md rounded-3xl bg-white p-7 shadow-soft"><Link href="/" className="font-black text-shakh-orange">← گەڕانەوە بۆ شاخ</Link><h1 className="mt-7 text-3xl font-black">{mode==="login"?"بەخێربێیتەوە":"هەژماری شاخ دروست بکە"}</h1><p className="mt-2 text-sm text-slate-500">بۆ بەکارهێنانی بازاڕ و گەیاندن بچۆ ژوورەوە.</p><form onSubmit={submit} className="mt-7 space-y-4">{mode==="signup"&&<label className="block text-sm font-bold">ناوی تەواو<input required value={name} onChange={e=>setName(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-shakh-blue"/></label>}<label className="block text-sm font-bold">ئیمەیڵ<input type="email" required value={email} onChange={e=>setEmail(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-shakh-blue"/></label><label className="block text-sm font-bold">وشەی نهێنی<input type="password" minLength={8} required value={password} onChange={e=>setPassword(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-shakh-blue"/></label><button disabled={busy} className="w-full rounded-xl bg-shakh-orange px-4 py-3 font-bold text-white disabled:opacity-50">{busy?"تکایە چاوەڕێ بکە...":mode==="login"?"چوونەژوورەوە":"دروستکردنی هەژمار"}</button></form>{message&&<p className="mt-4 rounded-xl bg-blue-50 p-3 text-sm text-blue-800">{message}</p>}<button onClick={()=>{setMode(mode==="login"?"signup":"login");setMessage("");}} className="mt-5 w-full text-sm font-bold text-shakh-blue">{mode==="login"?"هەژمارت نییە؟ هەژمار دروست بکە":"پێشتر هەژمارت هەیە؟ بچۆ ژوورەوە"}</button></div></main>;
}