"use client";
import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function ResetPasswordPage() {
  const [password,setPassword]=useState(""); const [confirm,setConfirm]=useState(""); const [ready,setReady]=useState(false); const [message,setMessage]=useState(""); const [busy,setBusy]=useState(false);
  useEffect(()=>{ const supabase=createClient(); supabase.auth.getSession().then(({data})=>setReady(!!data.session)); const {data:{subscription}}=supabase.auth.onAuthStateChange((event,session)=>{if(event==="PASSWORD_RECOVERY"||session)setReady(true);}); return ()=>subscription.unsubscribe(); },[]);
  async function submit(e:FormEvent) {
    e.preventDefault(); if(password.length<8){setMessage("وشەی نهێنی دەبێت لانیکەم ٨ پیت بێت.");return;} if(password!==confirm){setMessage("دوو وشەی نهێنییەکە یەکسان نین.");return;}
    setBusy(true);setMessage("");
    try { const {error}=await createClient().auth.updateUser({password}); if(error)setMessage("گۆڕینی وشەی نهێنی سەرکەوتوو نەبوو. لینکی نوێ داوا بکە."); else {setMessage("وشەی نهێنی بە سەرکەوتوویی گۆڕدرا."); setTimeout(()=>window.location.href="/dashboard",1200);} }
    catch {setMessage("هەڵەیەک ڕوویدا. تکایە دووبارە هەوڵ بدەرەوە.");}
    finally {setBusy(false);}
  }
  return <main className="grid min-h-screen place-items-center px-4 py-10"><section className="w-full max-w-md rounded-3xl bg-white p-7 shadow-soft"><h1 className="text-2xl font-black">دانانی وشەی نهێنیی نوێ</h1>{!ready?<p className="mt-4 text-sm text-slate-600">لینکی گۆڕینی وشەی نهێنی پشتڕاست نەکراوەتەوە یان بەسەرچووە. <Link className="font-bold text-shakh-blue" href="/forgot-password">لینکی نوێ داوا بکە</Link></p>:<form onSubmit={submit} className="mt-6 space-y-4"><label className="block text-sm font-bold">وشەی نهێنیی نوێ<input required minLength={8} type="password" value={password} onChange={e=>setPassword(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3"/></label><label className="block text-sm font-bold">دووبارە وشەی نهێنی<input required minLength={8} type="password" value={confirm} onChange={e=>setConfirm(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3"/></label><button disabled={busy} className="w-full rounded-xl bg-shakh-orange px-4 py-3 font-bold text-white disabled:opacity-50">{busy?"تکایە چاوەڕێ بکە...":"گۆڕینی وشەی نهێنی"}</button></form>}{message&&<p className="mt-4 rounded-xl bg-blue-50 p-3 text-sm text-blue-800">{message}</p>}</section></main>;
}
