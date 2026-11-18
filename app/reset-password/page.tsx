"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function ResetPasswordPage() {
  const searchParams = useSearchParams();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [ready, setReady] = useState<boolean | null>(null);
  const [message, setMessage] = useState("");
  const [messageError, setMessageError] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    const supabase = createClient();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;
      if (event === "INITIAL_SESSION") setReady(!!session);
      if ((event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") && session) setReady(true);
    });

    void supabase.auth.getSession().then(({ data, error }) => {
      if (!active) return;
      setReady(!!data.session);
      if (error) {
        setMessageError(true);
        setMessage("نەتوانرا سێشنەکە پشتڕاست بکرێتەوە. تکایە لینکی نوێ داوا بکە.");
      }
    }).catch(() => {
      if (active) {
        setReady(false);
        setMessageError(true);
        setMessage("پشکنینی لینکی گۆڕینی وشەی نهێنی سەرکەوتوو نەبوو.");
      }
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    const error = searchParams.get("error");
    if (error) {
      setReady(false);
      setMessageError(true);
      setMessage(
        error === "missing_code"
          ? "لینکی ئیمەیڵەکە کۆدی پشتڕاستکردنەوەی تێدا نییە."
          : "کۆدی لینکی گۆڕینی وشەی نهێنی نەیتوانی سێشن دروست بکات. تکایە لینکی نوێ داوا بکە."
      );
    }
  }, [searchParams]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (password.length < 8) {
      setMessageError(true);
      setMessage("وشەی نهێنی دەبێت لانیکەم ٨ پیت بێت.");
      return;
    }
    if (password !== confirm) {
      setMessageError(true);
      setMessage("دوو وشەی نهێنییەکە یەکسان نین.");
      return;
    }

    setBusy(true);
    setMessage("");
    setMessageError(false);
    try {
      const { error } = await createClient().auth.updateUser({ password });
      if (error) {
        setMessageError(true);
        setMessage("گۆڕینی وشەی نهێنی سەرکەوتوو نەبوو. تکایە لینکی نوێ داوا بکە.");
      } else {
        setMessage("وشەی نهێنی بە سەرکەوتوویی گۆڕدرا.");
        window.setTimeout(() => window.location.replace("/dashboard"), 1200);
      }
    } catch {
      setMessageError(true);
      setMessage("هەڵەیەک ڕوویدا. تکایە دووبارە هەوڵ بدەرەوە.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="grid min-h-screen place-items-center px-4 py-10">
      <section className="w-full max-w-md rounded-3xl bg-white p-7 shadow-soft">
        <Link href="/login" className="font-bold text-shakh-blue">← گەڕانەوە بۆ چوونەژوورەوە</Link>
        <h1 className="mt-7 text-2xl font-black">دانانی وشەی نهێنیی نوێ</h1>

        {ready === null ? (
          <p className="mt-4 text-sm text-slate-600">تکایە چاوەڕێ بکە، لینکی گۆڕینی وشەی نهێنی پشتڕاست دەکرێتەوە...</p>
        ) : !ready ? (
          <div className="mt-4 space-y-3">
            <p className="text-sm text-slate-600">لینکی گۆڕینی وشەی نهێنی پشتڕاست نەکراوەتەوە یان بەسەرچووە.</p>
            <Link className="inline-block rounded-xl bg-shakh-orange px-4 py-3 font-bold text-white" href="/forgot-password">داواکردنی لینکی نوێ</Link>
          </div>
        ) : (
          <form onSubmit={submit} className="mt-6 space-y-4">
            <label className="block text-sm font-bold">وشەی نهێنیی نوێ
              <input required minLength={8} autoComplete="new-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3"/>
            </label>
            <label className="block text-sm font-bold">دووبارە وشەی نهێنی
              <input required minLength={8} autoComplete="new-password" type="password" value={confirm} onChange={(event) => setConfirm(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3"/>
            </label>
            <button disabled={busy} className="w-full rounded-xl bg-shakh-orange px-4 py-3 font-bold text-white disabled:opacity-50">
              {busy ? "تکایە چاوەڕێ بکە..." : "گۆڕینی وشەی نهێنی"}
            </button>
          </form>
        )}

        {message && <p role="status" aria-live="polite" className={`mt-4 rounded-xl p-3 text-sm ${messageError ? "bg-red-50 text-red-800" : "bg-blue-50 text-blue-800"}`}>{message}</p>}
      </section>
    </main>
  );
}
