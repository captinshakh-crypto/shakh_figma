"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Entry = {
  id: string;
  entry_type: string;
  amount_iqd: number;
  direction: string;
  note: string | null;
  created_at: string;
};

type Payout = {
  id: string;
  amount_iqd: number;
  status: string;
  payout_method: string;
  owner_paid_iqd: number | null;
  platform_share_iqd: number | null;
  created_at: string;
};

function formatIQD(value: number) {
  return value.toLocaleString("en-US") + " د.ع";
}

const payoutStatus: Record<string, string> = {
  pending: "لە چاوەڕوانی پشکنینی سوپەر ئەدمین",
  approved: "پارەدان پشتڕاست کرا",
  rejected: "داواکاری ڕەتکرایەوە",
};

export default function WalletPage() {
  const [balance, setBalance] = useState(0);
  const [referralBalance, setReferralBalance] = useState(0);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [amount, setAmount] = useState("10000");
  const [note, setNote] = useState("");
  const [message, setMessage] = useState("");
  const [payoutMethod, setPayoutMethod] = useState("fastpay");
  const [isRewardOwner, setIsRewardOwner] = useState(false);
  const [receipt, setReceipt] = useState<File | null>(null);
  const [requestBusy, setRequestBusy] = useState(false);
  const [payoutBusy, setPayoutBusy] = useState(false);

  const pendingReferral = useMemo(
    () => payouts.filter((item) => item.status === "pending").reduce((sum, item) => sum + Number(item.amount_iqd || 0), 0),
    [payouts]
  );
  const availableReferral = Math.max(0, referralBalance - pendingReferral);
  const ownerCashAmount = Math.floor(availableReferral * 0.75);
  const shakhShareAmount = availableReferral - ownerCashAmount;

  async function load() {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      window.location.href = "/login";
      return;
    }

    const [wallet, ledger, campaigns, payoutRows] = await Promise.all([
      supabase.from("wallets").select("balance_iqd,referral_balance_iqd").eq("user_id", user.id).maybeSingle(),
      supabase.from("wallet_ledger").select("id,entry_type,amount_iqd,direction,note,created_at")
        .eq("wallet_user_id", user.id).order("created_at", { ascending: false }).limit(40),
      supabase.from("reward_campaigns").select("id").eq("owner_user_id", user.id).limit(1),
      supabase.from("payout_requests")
        .select("id,amount_iqd,status,payout_method,owner_paid_iqd,platform_share_iqd,created_at")
        .eq("requester_user_id", user.id).order("created_at", { ascending: false }).limit(20),
    ]);

    if (wallet.error) throw wallet.error;
    if (ledger.error) throw ledger.error;
    if (campaigns.error) throw campaigns.error;
    if (payoutRows.error) throw payoutRows.error;

    setBalance(Number(wallet.data?.balance_iqd || 0));
    setReferralBalance(Number(wallet.data?.referral_balance_iqd || 0));
    setEntries((ledger.data || []) as Entry[]);
    setIsRewardOwner((campaigns.data || []).length > 0);
    setPayouts((payoutRows.data || []) as Payout[]);
  }

  useEffect(() => {
    load().catch(() => setMessage("نەتوانرا زانیاریی جزدان باربکرێت."));
  }, []);

  async function requestTopup() {
    if (!receipt) {
      setMessage("تکایە وێنە یان PDF ـی وەسڵی پارەدان باربکە.");
      return;
    }
    if (!Number.isSafeInteger(Number(amount)) || Number(amount) <= 0) {
      setMessage("بڕی پڕکردنەوە بە دروستی بنووسە.");
      return;
    }
    if (!["image/jpeg", "image/png", "image/webp", "application/pdf"].includes(receipt.type) || receipt.size > 5 * 1024 * 1024) {
      setMessage("وەسڵ دەبێت JPG، PNG، WebP یان PDF بێت و لە ٥MB زیاتر نەبێت.");
      return;
    }

    setRequestBusy(true);
    const supabase = createClient();
    let path = "";
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("تکایە دووبارە بچۆ ژوورەوە.");
      const ext = receipt.type === "application/pdf" ? "pdf"
        : receipt.type === "image/png" ? "png"
        : receipt.type === "image/webp" ? "webp" : "jpg";
      path = user.id + "/" + crypto.randomUUID() + "." + ext;

      const { error: uploadError } = await supabase.storage.from("wallet-receipts").upload(path, receipt, {
        contentType: receipt.type,
        upsert: false,
      });
      if (uploadError) throw uploadError;

      const { data: requestId, error } = await supabase.rpc("request_wallet_topup", {
        p_amount_iqd: Number(amount),
        ...(note ? { p_note: note } : {}),
        p_receipt_path: path,
      });
      if (error) throw error;
      if (requestId) {
        await supabase.functions.invoke("send-wallet-email", {
          body: { request_id: requestId, event: "topup_requested" },
        });
      }

      setMessage("داواکاری و وەسڵ نێردران؛ دوای پشکنینی سوپەر ئەدمین جزدان پڕ دەکرێتەوە.");
      setNote("");
      setReceipt(null);
      const fileInput = document.getElementById("wallet-receipt") as HTMLInputElement | null;
      if (fileInput) fileInput.value = "";
      await load();
    } catch (error) {
      if (path) await supabase.storage.from("wallet-receipts").remove([path]);
      setMessage(error instanceof Error ? error.message : "ناردنی داواکاری سەرکەوتوو نەبوو.");
    } finally {
      setRequestBusy(false);
    }
  }

  async function requestReferralPayout() {
    if (availableReferral <= 0) {
      setMessage("هیچ باڵانسێکی ئازادی شێر و خەڵات بۆ کاشکردن نییە.");
      return;
    }
    setPayoutBusy(true);
    setMessage("");
    try {
      const supabase = createClient();
      const { error } = await supabase.rpc("request_wallet_payout", {
        p_amount_iqd: availableReferral,
        p_method: payoutMethod,
        p_note: "داواکاری کاشکردنی تەواوی باڵانسی شێر و خەڵات",
      });
      if (error) throw error;
      setMessage("داواکاری کاشکردنی تەواوی باڵانسی خەڵات نێردرا. باڵانسەکە تا پەسەندکردنی سوپەر ئەدمین پارێزراوە و دوبارە داوا ناکرێت.");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "ناردنی داواکاری کاشکردن سەرکەوتوو نەبوو.");
    } finally {
      setPayoutBusy(false);
    }
  }

  return (
    <main className="min-h-screen px-4 py-8">
      <div className="mx-auto max-w-3xl">
        <Link href="/dashboard" className="font-bold text-shakh-blue">← داشبۆرد</Link>
        <h1 className="mt-6 text-3xl font-black">جزدان</h1>

        <section className="mt-6 rounded-3xl bg-gradient-to-l from-shakh-blue to-[#0e477b] p-7 text-white">
          <p className="text-blue-100">کۆی باڵانسی جزدان</p>
          <p className="mt-2 text-4xl font-black">{formatIQD(balance)}</p>
          <p className="mt-3 text-sm text-blue-100">جزدان تۆماری ناوخۆییە؛ پارەدانی کاش بە دەستی سوپەر ئەدمین پشتڕاست دەکرێتەوە.</p>
        </section>

        {message && <p role="status" className="mt-4 rounded-xl bg-blue-50 p-4 text-sm text-blue-800">{message}</p>}

        <section className="mt-6 rounded-2xl bg-white p-6 shadow-soft">
          <h2 className="text-xl font-black">داواکاری پڕکردنەوەی جزدان</h2>
          <p className="mt-1 text-sm leading-7 text-slate-500">
            پارە بنێرە بۆ ژمارەکە و وەسڵ باربکە. هیچ باڵانسێک زیاد ناکرێت تا سوپەر ئەدمین وەسڵەکە بپشکنێت.
          </p>
          <div className="mt-4 rounded-xl bg-orange-50 p-4 text-sm">
            <b>FIB / FastPay</b>
            <p className="mt-1 font-mono text-lg" dir="ltr">07736999576</p>
            <p className="mt-1 text-xs text-slate-600">ناوی هەژمار و بڕی ناردن لە وەسڵدا دیار بێت.</p>
          </div>
          <input type="number" min="1" value={amount} onChange={(event) => setAmount(event.target.value)}
            className="mt-4 w-full rounded-xl border p-3" placeholder="بڕی پارە بە دینار"/>
          <input value={note} onChange={(event) => setNote(event.target.value)}
            placeholder="ژمارەی مامەڵە یان تێبینی (ئارەزوومەندانە)" className="mt-3 w-full rounded-xl border p-3"/>
          <label className="mt-3 block text-sm font-bold">
            وێنەی وەسڵ یان PDF
            <input id="wallet-receipt" type="file" accept="image/jpeg,image/png,image/webp,application/pdf"
              onChange={(event) => setReceipt(event.target.files?.[0] || null)}
              className="mt-2 block w-full rounded-xl border p-3 text-sm font-normal"/>
          </label>
          {receipt && <p className="mt-2 text-xs text-green-700">فایل هەڵبژێردرا: {receipt.name}</p>}
          <button disabled={requestBusy || !receipt} onClick={() => void requestTopup()}
            className="mt-4 rounded-xl bg-shakh-orange px-5 py-3 font-bold text-white disabled:opacity-50">
            {requestBusy ? "تکایە چاوەڕێ بکە..." : "ناردنی وەسڵ و داواکاری"}
          </button>
        </section>

        {isRewardOwner && (
          <section className="mt-6 overflow-hidden rounded-2xl border border-purple-200 bg-white shadow-soft">
            <div className="bg-gradient-to-l from-[#6d28d9] via-[#9333ea] to-[#f47721] p-5 text-white">
              <p className="text-sm font-bold text-purple-100">جزدانی تایبەتی شێر و خەڵات</p>
              <h2 className="mt-1 text-3xl font-black">{formatIQD(referralBalance)}</h2>
              <p className="mt-1 text-sm text-white/85">باڵانسی خەڵاتی کۆکراوە لە کڕینی بە لینکەکەتەوە</p>
            </div>
            <div className="space-y-4 p-5">
              <p className="text-sm leading-7 text-slate-600">
                تەنها کڕینی بە لینکەکەتەوە کە گەیاندنی تەواو بێت خەڵات زیاد دەکات. داوای کاشکردن بۆ تەواوی باڵانسی ئازاد دەکرێت؛ دوای پەسەندکردن جزدانی خەڵات سفر دەبێتەوە.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-purple-50 p-3">
                  <p className="text-xs text-purple-700">باڵانسی ئازاد</p>
                  <b className="mt-1 block text-lg text-purple-900">{formatIQD(availableReferral)}</b>
                </div>
                <div className="rounded-xl bg-amber-50 p-3">
                  <p className="text-xs text-amber-700">لە چاوەڕوانی کاشکردن</p>
                  <b className="mt-1 block text-lg text-amber-900">{formatIQD(pendingReferral)}</b>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 p-4">
                <h3 className="font-black">پێشبینی دابەشکردنی پارە</h3>
                <div className="mt-3 flex items-center justify-between text-sm">
                  <span>بۆ تۆ (٧٥٪)</span><b className="text-green-700">{formatIQD(ownerCashAmount)}</b>
                </div>
                <div className="mt-2 flex items-center justify-between text-sm">
                  <span>بۆ شاخ (٢٥٪)</span><b>{formatIQD(shakhShareAmount)}</b>
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-orange-100">
                  <div className="h-full rounded-full bg-gradient-to-l from-green-500 to-emerald-600" style={{ width: "75%" }}/>
                </div>
                <p className="mt-2 text-xs leading-6 text-slate-500">
                  نموونە: ١٠,٠٠٠ د.ع خەڵات = ٧,٥٠٠ د.ع بۆ تۆ و ٢,٥٠٠ د.ع بۆ شاخ. باڵانسی خەڵات لە کاتی کاشکردنی پەسەندکراودا بە تەواوی کەم دەکرێتەوە.
                </p>
              </div>

              <label className="block text-sm font-bold">شوێنی وەرگرتنی پارە
                <select value={payoutMethod} onChange={(event) => setPayoutMethod(event.target.value)}
                  className="mt-2 w-full rounded-xl border border-slate-200 p-3">
                  <option value="fastpay">FastPay</option>
                  <option value="fib">FIB</option>
                </select>
              </label>
              <button disabled={payoutBusy || availableReferral <= 0} onClick={() => void requestReferralPayout()}
                className="w-full rounded-xl bg-gradient-to-l from-[#6d28d9] to-[#f47721] px-5 py-3 font-black text-white shadow-md disabled:cursor-not-allowed disabled:opacity-45">
                {payoutBusy ? "تکایە چاوەڕێ بکە..." : "داوای کاشکردنی تەواوی باڵانس بکە"}
              </button>
            </div>

            {payouts.length > 0 && (
              <div className="border-t border-slate-100 p-5">
                <h3 className="font-black">مێژووی داواکاری کاشکردن</h3>
                <div className="mt-3 space-y-3">
                  {payouts.map((item) => (
                    <div key={item.id} className="rounded-xl border border-slate-100 p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <b>{formatIQD(Number(item.amount_iqd))}</b>
                        <span className={item.status === "approved" ? "rounded-full bg-green-50 px-2 py-1 text-xs font-bold text-green-700" : item.status === "pending" ? "rounded-full bg-amber-50 px-2 py-1 text-xs font-bold text-amber-700" : "rounded-full bg-red-50 px-2 py-1 text-xs font-bold text-red-700"}>
                          {payoutStatus[item.status] || item.status}
                        </span>
                      </div>
                      {item.status === "approved" && (
                        <p className="mt-2 text-xs text-slate-600">پارەی تۆ: {formatIQD(Number(item.owner_paid_iqd || 0))} · بەشی شاخ: {formatIQD(Number(item.platform_share_iqd || 0))}</p>
                      )}
                      <p className="mt-1 text-xs text-slate-400">{new Date(item.created_at).toLocaleString("ckb-IQ")} · {item.payout_method.toUpperCase()}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
        )}

        <section className="mt-6 rounded-2xl bg-white p-6 shadow-soft">
          <h2 className="text-xl font-black">جوڵەکانی جزدان</h2>
          {entries.length === 0
            ? <p className="mt-4 text-sm text-slate-500">هیچ مامەڵەیەک نییە.</p>
            : entries.map((item) => (
              <div key={item.id} className="flex justify-between gap-3 border-b py-3">
                <div>
                  <b className="text-sm">{item.note || item.entry_type}</b>
                  <p className="text-xs text-slate-400">{new Date(item.created_at).toLocaleString("ckb-IQ")}</p>
                </div>
                <b className={item.direction === "credit" ? "shrink-0 text-green-600" : "shrink-0 text-red-600"}>
                  {item.direction === "credit" ? "+" : "−"}{formatIQD(Number(item.amount_iqd))}
                </b>
              </div>
            ))}
        </section>
      </div>
    </main>
  );
}
