"use client";
import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import ShakhBrand from "@/components/shakh-brand";

const PRIVACY_POLICY_VERSION = "2026-11-26";

function buildAuthCallback(nextPath: string, privacyMethod?: "email_signup" | "google_signup") {
  const callback = new URL("https://daim-post.online/auth/callback");
  callback.searchParams.set("next", nextPath);
  if (privacyMethod) {
    callback.searchParams.set("privacy_policy_version", PRIVACY_POLICY_VERSION);
    callback.searchParams.set("privacy_method", privacyMethod);
  }
  return callback.toString();
}

function getPostAuthPath() {
  if (typeof window === "undefined") return "/dashboard";
  const requested = new URLSearchParams(window.location.search).get("next");
  return requested === "/cart" ? "/cart" : "/dashboard";
}

export default function LoginPage() {
  const [email,setEmail]=useState(""); const [password,setPassword]=useState(""); const [name,setName]=useState("");
  const [mode,setMode]=useState<"login"|"signup">("login"); const [privacyAccepted,setPrivacyAccepted]=useState(false); const [message,setMessage]=useState(""); const [busy,setBusy]=useState(false); const [showRecoveryLink,setShowRecoveryLink]=useState(false);

  useEffect(() => {
    let active = true;
    const authError = new URLSearchParams(window.location.search).get("auth_error");
    if (authError) {
      setMessage(authError === "verification"
        ? "لینکی چوونەژوورەوە یان گۆڕینی وشەی نهێنی هەڵەیە یان بەسەرچووە. لینکی نوێ داوا بکە."
        : "پشتڕاستکردنەوەی چوونەژوورەوە تەواو نەبوو. تکایە دووبارە هەوڵ بدەرەوە.");
      window.history.replaceState({}, "", window.location.pathname);
    }

    try {
      void Promise.resolve(createClient().auth.getUser()).then(({ data }) => {
        if (active && data.user) window.location.replace(getPostAuthPath());
      }).catch(() => {
        // Keep the sign-in form available when the session check is temporarily offline.
      });
    } catch {
      // The form remains usable and will display an error on submit.
    }

    return () => { active = false; };
  }, []);

  async function submit(e:FormEvent) {
    e.preventDefault(); setMessage(""); setShowRecoveryLink(false);
    if (mode === "signup" && !privacyAccepted) { setMessage("پێویستە سیاسەتی تایبەتمەندی بخوێنیتەوە و پەسەندی بکەیت."); return; }
    setBusy(true);
    try {
      const supabase=createClient();
      const nextPath = getPostAuthPath();
      const callback = buildAuthCallback(nextPath, mode === "signup" ? "email_signup" : undefined);
      const cleanEmail = email.trim().toLowerCase();
      const result=mode==="login"
        ? await supabase.auth.signInWithPassword({email:cleanEmail,password})
        : await supabase.auth.signUp({email:cleanEmail,password,options:{data:{full_name:name.trim(),privacy_policy_version:PRIVACY_POLICY_VERSION,privacy_policy_accepted_at:new Date().toISOString()},emailRedirectTo:callback}});
      if(result.error) {
        if (mode === "login" && result.error.code === "invalid_credentials") {
          setMessage("ئیمەیڵ یان وشەی نهێنی دروست نییە. وشەی نهێنییەکەت لەبیرچووە؟ لینکی گۆڕینی وشەی نهێنی بنێرە.");
          setShowRecoveryLink(true);
        } else if (result.error.status === 429) {
          setMessage("هەوڵی زۆر دراوە. تکایە کەمێک چاوەڕێ بکە و دووبارە هەوڵ بدەرەوە.");
        } else {
          setMessage(mode === "login"
            ? "چوونەژوورەوە سەرکەوتوو نەبوو. زانیارییەکان و پەیوەندی ئینتەرنێت بپشکنە."
            : "دروستکردنی هەژمار سەرکەوتوو نەبوو. تکایە دواتر هەوڵ بدەرەوە.");
        }
      } else if(mode==="signup") {
        if(result.data.session) {
          const { error: consentError } = await supabase.rpc("record_shakh_privacy_policy_acceptance", { p_policy_version: PRIVACY_POLICY_VERSION, p_method: "email_signup" });
          if (consentError) throw consentError;
          window.location.replace(nextPath);
        }
        else setMessage("هەژمارەکەت دروست کرا. تکایە ئیمەیڵەکەت بپشکنە و لینکی پشتڕاستکردنەوە بکەرەوە؛ دوای پشتڕاستکردنەوە پڕۆفایل و ڕۆڵەکەت پیشان دەدرێت.");
      } else window.location.replace(nextPath);
    } catch { setMessage("پەیوەندی بە داتابەیس نەکرا. ڕێکخستنی پڕۆژە بپشکنە."); }
    finally { setBusy(false); }
  }

  async function signInWithGoogle() {
    setBusy(true); setMessage("");
    try {
      const nextPath = getPostAuthPath();
      if (mode === "signup" && !privacyAccepted) { setMessage("پێویستە سیاسەتی تایبەتمەندی پەسەند بکەیت."); setBusy(false); return; }
      const callback = buildAuthCallback(nextPath, mode === "signup" ? "google_signup" : undefined);
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

  return (
    <main dir="rtl" className="grid min-h-screen place-items-center bg-[#f5f8fc] px-4 py-10">
      <div className="w-full max-w-md rounded-3xl bg-white p-7 shadow-soft">
        <div className="flex justify-center"><ShakhBrand size="lg"/></div>
        <h1 className="mt-7 text-3xl font-black">{mode === "login" ? "بەخێربێیتەوە" : "هەژماری شاخ دروست بکە"}</h1>
        <p className="mt-2 text-sm leading-7 text-slate-500">بۆ بەکارهێنانی بازاڕ و گەیاندن بچۆ ژوورەوە.</p>
        <form onSubmit={submit} className="mt-7 space-y-4">
          {mode === "signup" && <label className="block text-sm font-bold">ناوی تەواو
            <input required value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-shakh-blue"/>
          </label>}
          <label className="block text-sm font-bold">ئیمەیڵ
            <input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-shakh-blue"/>
          </label>
          <label className="block text-sm font-bold">وشەی نهێنی
            <input type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} minLength={8} required value={password} onChange={(e) => setPassword(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-shakh-blue"/>
          </label>
          {mode === "login" ? (
            <div className="text-left"><Link href="/forgot-password" className="text-sm font-bold text-shakh-blue">وشەی نهێنیت لەبیرکردووە؟</Link></div>
          ) : (
            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-blue-100 bg-blue-50/70 p-3 text-sm leading-7">
              <input type="checkbox" required checked={privacyAccepted} onChange={(e) => setPrivacyAccepted(e.target.checked)} className="mt-2 h-4 w-4 shrink-0 accent-[#f47721]"/>
              <span>سیاسەتی تایبەتمەندی و پاراستنی زانیارییەکانم خوێندووەتەوە و پەسەندی دەکەم:
                <Link href="/privacy" target="_blank" className="mr-1 font-black text-[#1769aa] underline">سیاسەتی تایبەتمەندی</Link>
                <span className="mx-1">·</span>
                <Link href="/faq" target="_blank" className="font-black text-[#1769aa] underline">پرسیارە باوەکان</Link>
              </span>
            </label>
          )}
          <button disabled={busy || (mode === "signup" && !privacyAccepted)} className="w-full rounded-xl bg-shakh-orange px-4 py-3 font-bold text-white disabled:opacity-50">
            {busy ? "تکایە چاوەڕێ بکە..." : mode === "login" ? "چوونەژوورەوە" : "دروستکردنی هەژمار"}
          </button>
        </form>
        <div className="my-5 flex items-center gap-3"><span className="h-px flex-1 bg-slate-200"/><span className="text-xs text-slate-400">یان</span><span className="h-px flex-1 bg-slate-200"/></div>
        <button type="button" disabled={busy || (mode === "signup" && !privacyAccepted)} onClick={signInWithGoogle} className="flex w-full items-center justify-center gap-3 rounded-xl border border-slate-300 bg-white px-4 py-3 font-bold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50">
          <span aria-hidden="true" className="text-xl font-black text-[#4285F4]">G</span>{busy ? "تکایە چاوەڕێ بکە..." : "بەردەوام بە Google"}
        </button>
        {message && <div role="status" className="mt-4 rounded-xl bg-blue-50 p-3 text-sm leading-7 text-blue-800">
          <p>{message}</p>
          {showRecoveryLink && <Link href={`/forgot-password?email=${encodeURIComponent(email.trim().toLowerCase())}`} className="mt-2 inline-block font-black underline">ناردنی لینکی گۆڕینی وشەی نهێنی</Link>}
        </div>}
        <button onClick={() => { setMode(mode === "login" ? "signup" : "login"); setPrivacyAccepted(false); setMessage(""); setShowRecoveryLink(false); }} className="mt-5 w-full text-sm font-bold text-shakh-blue">
          {mode === "login" ? "هەژمارت نییە؟ هەژمار دروست بکە" : "پێشتر هەژمارت هەیە؟ بچۆ ژوورەوە"}
        </button>
        <div className="mt-6 flex flex-wrap justify-center gap-x-4 gap-y-2 border-t border-slate-100 pt-4 text-xs font-bold text-slate-500">
          <Link href="/privacy" className="hover:text-[#1769aa]">سیاسەتی تایبەتمەندی</Link>
          <Link href="/faq" className="hover:text-[#1769aa]">پرسیارە باوەکان</Link>
          <Link href="/support" className="hover:text-[#1769aa]">پشتگیری</Link>
        </div>
      </div>
    </main>
  );
}
