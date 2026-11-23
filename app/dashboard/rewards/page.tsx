"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Check, Copy, Gift, Share2, Wallet } from "lucide-react";

type Campaign = {
  id: string;
  title: string;
  description: string | null;
  reward_amount_iqd: number;
  is_active: boolean;
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

function shareUrl(id: string) {
  return "https://www.daim-post.online/shop?ref=" + encodeURIComponent(id);
}

export default function RewardsPage() {
  const [rows, setRows] = useState<Campaign[]>([]);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [referralBalance, setReferralBalance] = useState(0);
  const [earnedTotal, setEarnedTotal] = useState(0);
  const [title, setTitle] = useState("لینکی شێر و خەڵاتی من");
  const [description, setDescription] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const pending = useMemo(
    () => payouts.filter((item) => item.status === "pending").reduce((sum, item) => sum + Number(item.amount_iqd || 0), 0),
    [payouts]
  );
  const available = Math.max(0, referralBalance - pending);
  const ownerCash = Math.floor(available * 0.75);
  const shakhShare = available - ownerCash;

  async function load() {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      window.location.href = "/login";
      return;
    }

    const [campaignResult, walletResult, payoutResult, ledgerResult] = await Promise.all([
      supabase.from("reward_campaigns")
        .select("id,title,description,reward_amount_iqd,is_active,created_at")
        .eq("owner_user_id", user.id).order("created_at", { ascending: false }),
      supabase.from("wallets").select("referral_balance_iqd").eq("user_id", user.id).maybeSingle(),
      supabase.from("payout_requests")
        .select("id,amount_iqd,status,payout_method,owner_paid_iqd,platform_share_iqd,created_at")
        .eq("requester_user_id", user.id).order("created_at", { ascending: false }).limit(20),
      supabase.from("wallet_ledger").select("amount_iqd,entry_type,direction")
        .eq("wallet_user_id", user.id).eq("entry_type", "reward_credit").eq("direction", "credit"),
    ]);

    if (campaignResult.error) throw campaignResult.error;
    if (walletResult.error) throw walletResult.error;
    if (payoutResult.error) throw payoutResult.error;
    if (ledgerResult.error) throw ledgerResult.error;

    setRows((campaignResult.data || []) as Campaign[]);
    setReferralBalance(Number(walletResult.data?.referral_balance_iqd || 0));
    setPayouts((payoutResult.data || []) as Payout[]);
    setEarnedTotal((ledgerResult.data || []).reduce((sum, row) => sum + Number(row.amount_iqd || 0), 0));
  }

  useEffect(() => {
    load().catch(() => setMessage("نەتوانرا زانیاری شێر و خەڵات باربکرێت."));
  }, []);

  async function createCampaign() {
    if (busy) return;
    setBusy(true);
    setMessage("");
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("تکایە سەرەتا بچۆ ژوورەوە.");
      const { error } = await supabase.from("reward_campaigns").insert({
        owner_user_id: user.id,
        title: title.trim() || "لینکی شێر و خەڵاتی من",
        description: description.trim() || "لینکی تایبەتی شێر و خەڵاتی شاخ ستۆر",
        reward_amount_iqd: 0,
        is_active: true,
      });
      if (error) throw error;
      setMessage("لینکی تایبەتت دروست کرا. ئێستا دەتوانیت لە TikTok و سۆشیال میدیا بڵاوی بکەیتەوە.");
      setTitle("لینکی شێر و خەڵاتی من");
      setDescription("");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "دروستکردنی لینک سەرکەوتوو نەبوو.");
    } finally {
      setBusy(false);
    }
  }

  async function copyLink(id: string) {
    const url = shareUrl(id);
    try {
      await navigator.clipboard.writeText(url);
      setMessage("لینکی شێر و خەڵات کۆپی کرا؛ لە TikTok، Instagram یان هەر سۆشیال میدیایەک دایبنێ.");
    } catch {
      setMessage(url);
    }
  }

  async function shareLink(id: string, campaignTitle: string) {
    const url = shareUrl(id);
    const payload = {
      title: "SHAKH STORE | شاخ ستۆر",
      text: "ئەم لینکە بکەرەوە، کاڵاکانی شاخ ستۆر ببینە و بە لینکەکەم کڕین بکە؛ منیش خەڵاتی شێر و خەڵات وەردەگرم: " + campaignTitle,
      url,
    };
    try {
      if (typeof navigator.share === "function") {
        await navigator.share(payload);
        setMessage("لینکەکە بۆ هاوبەشکردن ئامادە کرا.");
      } else {
        await copyLink(id);
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      await copyLink(id);
    }
  }

  async function toggle(campaign: Campaign) {
    const supabase = createClient();
    const { error } = await supabase.from("reward_campaigns")
      .update({ is_active: !campaign.is_active }).eq("id", campaign.id);
    setMessage(error?.message || "دۆخی لینک نوێکرایەوە.");
    await load();
  }

  return (
    <main className="min-h-screen bg-[#f5f8fc] px-4 py-8">
      <div className="mx-auto max-w-4xl">
        <Link href="/dashboard" className="font-bold text-shakh-blue">← داشبۆرد</Link>
        <div className="mt-6 overflow-hidden rounded-3xl bg-gradient-to-l from-[#4c1d95] via-[#7e22ce] to-[#f47721] p-6 text-white shadow-xl sm:p-8">
          <div className="flex items-center gap-3">
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-white/15"><Gift size={27}/></span>
            <div>
              <p className="text-sm font-bold text-purple-100">SHAKH STORE · SHARE & EARN</p>
              <h1 className="mt-1 text-3xl font-black">شێر بکە و خەڵات وەربگرە</h1>
            </div>
          </div>
          <p className="mt-4 max-w-3xl text-sm leading-8 text-white/90">
            لینکی تایبەتی خۆت دروست بکە و لە TikTok و Instagram و Facebook بڵاوی بکەرەوە. کاتێک کڕیار بە لینکەکەتەوە بێتە بازاڕ و کاڵای خەڵاتدار بکڕێت و داواکارییەکە بگەیەنرێت، خەڵاتی دیاریکراوی دوکاندار بۆ جزدانی شێرکەر زیاد دەکرێت.
          </p>
          <div className="mt-5 flex flex-wrap gap-3 text-xs font-bold">
            <span className="rounded-full bg-white/15 px-3 py-2">١ · لینک دروست بکە</span>
            <span className="rounded-full bg-white/15 px-3 py-2">٢ · لە سۆشیال میدیا شێری بکە</span>
            <span className="rounded-full bg-white/15 px-3 py-2">٣ · لە کڕینی تەواوبوو خەڵات وەربگرە</span>
          </div>
        </div>

        <section className="mt-6 grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl bg-white p-5 shadow-soft">
            <p className="text-xs font-bold text-slate-500">کۆی خەڵاتی بەدەستهاتوو</p>
            <b className="mt-2 block text-2xl text-purple-800">{formatIQD(earnedTotal)}</b>
          </div>
          <div className="rounded-2xl bg-white p-5 shadow-soft">
            <p className="text-xs font-bold text-slate-500">باڵانسی خەڵاتی ئێستا</p>
            <b className="mt-2 block text-2xl text-green-700">{formatIQD(referralBalance)}</b>
          </div>
          <div className="rounded-2xl bg-white p-5 shadow-soft">
            <p className="text-xs font-bold text-slate-500">لە چاوەڕوانی کاشکردن</p>
            <b className="mt-2 block text-2xl text-amber-700">{formatIQD(pending)}</b>
          </div>
        </section>

        <section className="mt-6 rounded-2xl border border-purple-100 bg-white p-6 shadow-soft">
          <h2 className="text-xl font-black">دروستکردنی لینکی شێر و خەڵات</h2>
          <p className="mt-2 text-sm leading-7 text-slate-500">
            ناوی لینک بنووسە یان بە ناوی پێشگریمانە دروستی بکە. هەر کەسێک بە لینکەکەتەوە بێت، خەڵاتی کاڵا خەڵاتدارەکان بۆ تۆ تۆمار دەکرێت.
          </p>
          <input value={title} onChange={(event) => setTitle(event.target.value)}
            placeholder="ناوی لینک، وەک لینکەکەی TikTok ـم" maxLength={120}
            className="mt-4 w-full rounded-xl border border-slate-200 p-3"/>
          <input value={description} onChange={(event) => setDescription(event.target.value)}
            placeholder="وەسف (ئارەزوومەندانە)" maxLength={300}
            className="mt-3 w-full rounded-xl border border-slate-200 p-3"/>
          <button disabled={busy} onClick={() => void createCampaign()}
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-gradient-to-l from-purple-700 to-[#f47721] px-5 py-3 font-black text-white disabled:opacity-50">
            <Gift size={18}/>{busy ? "دروست دەکرێت..." : "دروستکردنی لینکی خەڵات"}
          </button>
        </section>

        <section className="mt-6 rounded-2xl bg-white p-6 shadow-soft">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-xl font-black">لینکەکانم ({rows.length})</h2>
            <span className="text-xs text-slate-400">بەستەری گشتی: daim-post.online/shop?ref=...</span>
          </div>
          {rows.length === 0 ? (
            <div className="mt-4 rounded-xl bg-purple-50 p-5 text-sm leading-7 text-purple-900">
              هێشتا هیچ لینکێکت نییە. یەک لینک دروست بکە، پاشان لە TikTok یان سۆشیال میدیا بڵاوی بکەرەوە.
            </div>
          ) : (
            <div className="mt-4 space-y-4">
              {rows.map((campaign) => (
                <article key={campaign.id} className="rounded-2xl border border-slate-100 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <b className="text-base">{campaign.title}</b>
                      <p className="mt-1 text-xs text-slate-500">{campaign.description || "لینکی تایبەتی شێر و خەڵات"}</p>
                      <span className={campaign.is_active ? "mt-2 inline-flex rounded-full bg-green-50 px-2.5 py-1 text-xs font-bold text-green-700" : "mt-2 inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600"}>
                        {campaign.is_active ? "لینک چالاکە" : "لینک ناچالاکە"}
                      </span>
                    </div>
                    <button onClick={() => void toggle(campaign)}
                      className="rounded-lg bg-slate-100 px-3 py-2 text-xs font-bold">
                      {campaign.is_active ? "ناچالاککردن" : "چالاککردن"}
                    </button>
                  </div>
                  <p className="mt-3 break-all rounded-lg bg-slate-50 p-3 text-left text-xs text-slate-600" dir="ltr">{shareUrl(campaign.id)}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button onClick={() => void shareLink(campaign.id, campaign.title)}
                      disabled={!campaign.is_active}
                      className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-l from-purple-700 to-[#f47721] px-4 py-2.5 text-sm font-black text-white disabled:opacity-40">
                      <Share2 size={16}/> شێرکردن بۆ سۆشیال میدیا
                    </button>
                    <button onClick={() => void copyLink(campaign.id)}
                      className="inline-flex items-center gap-2 rounded-xl border border-purple-200 bg-purple-50 px-4 py-2.5 text-sm font-bold text-purple-800">
                      <Copy size={16}/> کۆپیکردنی لینک
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="mt-6 rounded-2xl border border-green-100 bg-white p-6 shadow-soft">
          <div className="flex items-center gap-2">
            <Wallet className="text-green-700"/>
            <h2 className="text-xl font-black">یاسای کاشکردنی خەڵات</h2>
          </div>
          <p className="mt-2 text-sm leading-7 text-slate-600">
            کاتێک داواکارییەک بە تەواوی گەیەنرا، خەڵاتی هەر دانەی فرۆشراو بۆ جزدانی شێرکەر زیاد دەبێت. دواتر داوای کاشکردنی هەموو باڵانسی ئازاد بکە؛ سوپەر ئەدمین پارەدان پشتڕاست دەکاتەوە، ٧٥٪ بۆ تۆ و ٢٥٪ بۆ شاخ دەبێت و باڵانسی تایبەتی خەڵات بە تەواوی سفر دەبێتەوە.
          </p>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-green-50 p-4">
              <p className="text-xs text-green-800">ئەوەی بۆ تۆ دەگەڕێتەوە (٧٥٪)</p>
              <b className="mt-1 block text-xl text-green-900">{formatIQD(ownerCash)}</b>
            </div>
            <div className="rounded-xl bg-orange-50 p-4">
              <p className="text-xs text-orange-800">بەشی شاخ (٢٥٪)</p>
              <b className="mt-1 block text-xl text-orange-900">{formatIQD(shakhShare)}</b>
            </div>
          </div>
          <Link href="/dashboard/wallet" className="mt-4 inline-flex rounded-xl bg-shakh-blue px-5 py-3 text-sm font-bold text-white">
            بینینی جزدان و داوای کاشکردن
          </Link>
        </section>

        {message && <p role="status" className="mt-4 break-all rounded-xl bg-blue-50 p-4 text-sm text-blue-800">{message}</p>}
      </div>
    </main>
  );
}
