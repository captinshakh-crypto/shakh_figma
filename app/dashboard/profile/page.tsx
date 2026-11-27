"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Enums, Json } from "@/lib/supabase/database.types";

type Profile = {
  email: string | null;
  full_name: string | null;
  phone: string | null;
  role: Enums<"app_role">;
};
type Merchant = { id: string; business_name: string };
type CaptainProfile = { captain_type: Enums<"captain_type">; merchant_id: string | null; is_active: boolean };
type Application = {
  id: string;
  captain_type: Enums<"captain_type">;
  merchant_id: string | null;
  note: string | null;
  status: Enums<"record_status">;
  created_at: string;
  pledge_version: string | null;
  pledge_full_name: string | null;
  pledge_accepted_at: string | null;
  pledge_terms: Json | null;
};
const pledgeCommitments = [
  { key: "protect_goods", title: "پاراستنی کەل و پەل و کاڵا", detail: "کاڵا و گەیاندراوەکان بە وریایی و بێ زیان بپارێزم؛ هیچ شتێک بەبێ مۆڵەت نەکەمەوە یان لەدەستی نەدەم." },
  { key: "honest_delivery", title: "ڕاستگۆیی و گەیاندنی سەلامەت", detail: "داواکاری بە ڕاستگۆیی، دڵسۆزی و بە پێی ڕێنمایی سیستەم بگەیەنم و هەر کێشەیەک ڕاستەوخۆ ڕاپۆرت بکەم." },
  { key: "respect_community", title: "ڕێزگرتن لە بەها کۆمەڵایەتییەکان", detail: "ڕێز لە کڕیار، دوکاندار، خەڵک و نەریت و بەها کۆمەڵایەتییەکان بگرم؛ بە ڕەفتاری باش و بێ جیاوازی مامەڵە بکەم." },
  { key: "protect_privacy", title: "پاراستنی نهێنی و زانیاری", detail: "ژمارە، ناونیشان، شوێنی GPS و زانیاریی کڕیار و دوکان لەگەڵ کەسی تر هاوبەش نەکەم." },
  { key: "follow_rules", title: "پابەندبوون بە یاسا و ڕێنمایی شاخ", detail: "ڕێساکانی گەیاندن، سەلامەتی، هەڵسوکەوت و ڕێنمایی سوپەر ئەدمین جێبەجێ بکەم." },
] as const;
type PledgeKey = typeof pledgeCommitments[number]["key"];
type PledgeChoices = Record<PledgeKey, boolean>;
const emptyPledge: PledgeChoices = {
  protect_goods: false, honest_delivery: false, respect_community: false,
  protect_privacy: false, follow_rules: false,
};

const roleNames: Record<string, string> = {
  super_admin: "سوپەر ئەدمین",
  customer: "کڕیار",
  captain: "کاپتن",
  supermarket: "سوپەرمارکێت",
  restaurant: "چێشتخانە",
  butcher_poultry: "گۆشت و سپیاتی",
  grocery: "بەقالی",
};

const statusNames: Record<string, string> = {
  pending: "لە چاوەڕوانی پەسەندکردندایە",
  approved: "پەسەند کرا",
  rejected: "ڕەتکرایەوە",
};

export default function ProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [captain, setCaptain] = useState<CaptainProfile | null>(null);
  const [applications, setApplications] = useState<Application[]>([]);
  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [captainType, setCaptainType] = useState<Enums<"captain_type">>("shakh");
  const [merchantId, setMerchantId] = useState("");
  const [note, setNote] = useState("");
  const [nationalId, setNationalId] = useState("");
  const [pledgeSignature, setPledgeSignature] = useState("");
  const [pledgeChoices, setPledgeChoices] = useState<PledgeChoices>(emptyPledge);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function load() {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { window.location.href = "/login"; return; }

    const [p, c, a, m, roleResult, identityResult] = await Promise.all([
      supabase.from("profiles").select("email,full_name,phone,role").eq("id", user.id).single(),
      supabase.from("captain_profiles").select("captain_type,merchant_id,is_active").eq("user_id", user.id).maybeSingle(),
      supabase.from("captain_applications").select("id,captain_type,merchant_id,note,status,created_at,pledge_version,pledge_full_name,pledge_accepted_at,pledge_terms").eq("user_id", user.id).order("created_at", { ascending: false }),
      supabase.from("merchant_profiles").select("id,business_name").eq("approval_status", "approved").order("business_name"),
      supabase.rpc("current_app_role"),
      supabase.from("captain_identity_details").select("national_id_number").eq("user_id", user.id).maybeSingle(),
    ]);

    if (p.error) throw p.error;
    if (roleResult.error) throw roleResult.error;
    if (identityResult.error) throw identityResult.error;
    setProfile({
      ...p.data,
      role: roleResult.data || p.data.role,
    });
    setName(p.data.full_name || "");
    setPhone(p.data.phone || "");
    setPledgeSignature((current) => current || p.data.full_name || "");
    setNationalId(identityResult.data?.national_id_number || "");
    setCaptain(c.data);
    setApplications(a.data || []);
    setMerchants(m.data || []);
    if (c.data?.captain_type) setCaptainType(c.data.captain_type);
    setLoading(false);
  }

  useEffect(() => {
    load().catch(() => { setMessage("نەتوانرا زانیاری پڕۆفایل باربکرێت."); setLoading(false); });
  }, []);

  async function saveProfile(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    if (!/^\+?(964)?0?7[0-9]{9}$/.test(phone.trim())) {
      setMessage("ژمارەی مۆبایلی عێراقی بە شێوەی دروست بنووسە.");
      setSaving(false);
      return;
    }
    try {
      const { error } = await createClient().rpc("update_my_profile", {
        p_full_name: name.trim(),
        p_phone: phone.trim(),
      });
      if (error) throw error;
      setMessage("زانیاری پڕۆفایلەکەت پاشەکەوت کرا.");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "پاشەکەوتکردنی زانیاری سەرکەوتوو نەبوو.");
    } finally {
      setSaving(false);
    }
  }

  async function applyForCaptain(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    if (!/^\+?(964)?0?7[0-9]{9}$/.test(phone.trim())) {
      setMessage("پێش داواکاری کاپتن، ژمارەی مۆبایلت لە پڕۆفایل تەواو بکە.");
      setSaving(false);
      return;
    }
    if (Object.values(pledgeChoices).some((accepted) => !accepted)) {
      setMessage("پێویستە هەموو خاڵەکانی پەیمانی کاپتن پەسەند بکەیت.");
      setSaving(false);
      return;
    }
    if (!nationalId.trim() || !pledgeSignature.trim()) {
      setMessage("ژمارەی ناسنامە و ناوی تەواو بۆ واژۆی پەیمان پێویستن.");
      setSaving(false);
      return;
    }
    try {
      const { error } = await createClient().rpc("request_captain_application_with_pledge", {
        p_captain_type: captainType,
        p_merchant_id: captainType === "merchant" ? merchantId : null,
        p_note: note.trim(),
        p_national_id_number: nationalId.trim(),
        p_pledge_full_name: pledgeSignature.trim(),
        p_pledge_terms: pledgeChoices,
      });
      if (error) throw error;
      setMessage("داواکاری کاپتن نێردرا. دوای پەسەندکردنی سوپەر ئەدمین ڕۆڵەکەت دەگۆڕدرێت.");
      setNote("");
      setPledgeChoices(emptyPledge);
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "ناردنی داواکاری سەرکەوتوو نەبوو.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleCaptainAvailability() {
    if (!captain) return;
    setSaving(true);
    setMessage("");
    try {
      const nextActive = !captain.is_active;
      const { error } = await createClient().rpc("set_my_captain_availability", { p_is_active: nextActive });
      if (error) throw error;
      setMessage(nextActive ? "کاپتن ئێستا ئامادەی وەرگرتنی داواکارییە." : "کاپتن بە شێوەی کاتی ناچالاک کرا؛ هەژمارەکەت هێشتا چالاکە.");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "گۆڕینی دۆخی کاپتن سەرکەوتوو نەبوو.");
    } finally {
      setSaving(false);
    }
  }

  async function updateCaptainIdentity(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    try {
      const { error } = await createClient().rpc("update_my_captain_identity", { p_national_id_number: nationalId.trim() });
      if (error) throw error;
      setMessage("ژمارەی ناسنامەی کاپتن نوێ کرایەوە؛ تەنها سوپەر ئەدمین دەتوانێت بیبینێت.");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "نوێکردنەوەی ناسنامەی کاپتن سەرکەوتوو نەبوو.");
    } finally {
      setSaving(false);
    }
  }

  const selectedStore = merchants.find((merchant) => merchant.id === captain?.merchant_id)?.business_name;
  const pending = applications.some((application) => application.status === "pending");

  return (
    <main className="min-h-screen px-4 py-8">
      <div className="mx-auto max-w-3xl">
        <Link href="/dashboard" className="font-bold text-shakh-blue">← داشبۆرد</Link>
        <h1 className="mt-6 text-3xl font-black text-shakh-ink">پڕۆفایلی من</h1>
        <p className="mt-2 text-sm text-slate-500">زانیاری کەسی و داواکاری گۆڕینی ڕۆڵ لە شاخ</p>

        {message && <p role="status" className="mt-5 rounded-xl bg-blue-50 p-4 text-sm text-blue-800">{message}</p>}
        {loading ? <p className="mt-8">بارکردن...</p> : profile && <>
          <section className="mt-6 rounded-2xl bg-white p-6 shadow-soft">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold text-slate-500">ئیمەیڵی هەژمار</p>
                <p className="mt-1 font-bold">{profile.email || "—"}</p>
              </div>
              <span className="rounded-full bg-orange-50 px-4 py-2 text-sm font-black text-shakh-orange">
                {roleNames[profile.role] || profile.role}
              </span>
            </div>
            {profile.role === "captain" && captain && (
              <div className="mt-4 rounded-xl bg-blue-50 p-4 text-sm text-blue-900">
                {captain.captain_type === "shakh"
                  ? "کاپتنی شاخ — دەتوانێت بۆ داواکارییەکانی هەموو دوکانەکان دیاری بکرێت."
                  : `کاپتنی تایبەت بە دوکان — سنووردارە بە ${selectedStore || "دوکانی دیاریکراو"}.`}
              </div>
            )}
          </section>

          <section className="mt-5 rounded-2xl bg-white p-6 shadow-soft">
            <h2 className="text-xl font-black">زانیاری کەسی</h2>
            <form onSubmit={saveProfile} className="mt-5 space-y-4">
              <label className="block text-sm font-bold">ناوی تەواو
                <input required maxLength={120} value={name} onChange={(event) => setName(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3"/>
              </label>
              <label className="block text-sm font-bold">ژمارەی مۆبایل
                <input required type="tel" maxLength={16} value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="0750XXXXXXX" pattern="(\+?(964)?0?7[0-9]{9})" className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3"/>
              </label>
              <button disabled={saving} className="rounded-xl bg-shakh-blue px-5 py-3 font-bold text-white disabled:opacity-50">
                {saving ? "تکایە چاوەڕێ بکە..." : "پاشەکەوتکردنی پڕۆفایل"}
              </button>
            </form>
          </section>

          {profile.role === "captain" && captain && (
            <section className="mt-5 rounded-2xl bg-white p-6 shadow-soft">
              <h2 className="text-xl font-black">دۆخی بەردەستبوونی کاپتن</h2>
              <p className="mt-2 text-sm leading-7 text-slate-600">ئەم دوگمەیە تەنها ئامادەبوونت بۆ وەرگرتنی داواکاری گۆڕێت؛ هەژمار و ڕۆڵی کاپتنت ناچالاک ناکات.</p>
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                <span className={`rounded-full px-4 py-2 text-sm font-black ${captain.is_active ? "bg-green-50 text-green-700" : "bg-slate-100 text-slate-600"}`}>{captain.is_active ? "ئامادەی وەرگرتنی داواکاری" : "ئێستا ناچالاکە"}</span>
                <button type="button" disabled={saving} onClick={() => void toggleCaptainAvailability()} className={`rounded-xl px-5 py-3 font-black text-white disabled:opacity-50 ${captain.is_active ? "bg-red-600" : "bg-green-600"}`}>
                  {captain.is_active ? "ناچالاککردنی کاپتن" : "چالاککردنی کاپتن"}
                </button>
              </div>
              <form onSubmit={updateCaptainIdentity} className="mt-5 border-t border-slate-100 pt-5">
                <label className="block text-sm font-bold">ژمارەی ناسنامەی نیشتمانی
                  <input required maxLength={30} value={nationalId} onChange={(event) => setNationalId(event.target.value)} placeholder="ژمارەی ناسنامە" className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3"/>
                </label>
                <p className="mt-2 text-xs leading-6 text-slate-500">زانیاریی ناسنامە نهێنییە و تەنها سوپەر ئەدمین بۆ پشکنینی کاپتن دەیبینێت.</p>
                <button disabled={saving || !nationalId.trim()} className="mt-3 rounded-xl bg-shakh-blue px-4 py-3 text-sm font-bold text-white disabled:opacity-50">پاشەکەوتکردنی ناسنامە</button>
              </form>
            </section>
          )}

          {profile.role === "customer" && !captain?.is_active && (
            <section className="mt-5 rounded-2xl bg-white p-6 shadow-soft">
              <h2 className="text-xl font-black">داواکاری بوون بە کاپتن</h2>
              <p className="mt-2 text-sm leading-7 text-slate-600">جۆری کاپتن هەڵبژێرە. سوپەر ئەدمین داواکارییەکەت پێداچوونەوەی بۆ دەکات پێش ئەوەی ڕۆڵەکەت بگۆڕدرێت.</p>

              {pending ? (
                <p className="mt-4 rounded-xl bg-amber-50 p-4 text-sm text-amber-800">داواکارییەکت لە چاوەڕوانی پەسەندکردندایە.</p>
              ) : (
                <form onSubmit={applyForCaptain} className="mt-5 space-y-4">
                  <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 p-4">
                    <input type="radio" name="captainType" checked={captainType === "shakh"} onChange={() => setCaptainType("shakh")} className="mt-1"/>
                    <span><b className="block">کاپتنی شاخ</b><small className="mt-1 block leading-6 text-slate-500">بۆ هەموو دوکانەکانی پلاتفۆرمی شاخ.</small></span>
                  </label>
                  <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 p-4">
                    <input type="radio" name="captainType" checked={captainType === "merchant"} onChange={() => setCaptainType("merchant")} className="mt-1"/>
                    <span><b className="block">کاپتنی تایبەت بە یەک دوکان</b><small className="mt-1 block leading-6 text-slate-500">تەنها بۆ گەیاندنی داواکارییەکانی ئەو دوکانەی هەڵیدەبژێریت.</small></span>
                  </label>

                  {captainType === "merchant" && (
                    <label className="block text-sm font-bold">دوکانی پەیوەندیدار
                      <select required value={merchantId} onChange={(event) => setMerchantId(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3">
                        <option value="">دوکان هەڵبژێرە</option>
                        {merchants.map((merchant) => <option key={merchant.id} value={merchant.id}>{merchant.business_name}</option>)}
                      </select>
                      {merchants.length === 0 && <small className="mt-2 block text-amber-700">هیچ دوکانێکی پەسەندکراو ئامادە نییە.</small>}
                    </label>
                  )}

                  <section className="rounded-2xl border border-orange-100 bg-orange-50/70 p-4">
                    <h3 className="text-lg font-black text-[#0a3157]">پەیمانی کاپتن و پاراستنی کەل و پەل</h3>
                    <p className="mt-2 text-xs leading-7 text-slate-600">پێش ناردنی داواکاری، ئەم پەیمانە بە وردی بخوێنەرەوە. هەموو خاڵەکان پێویستە پەسەند بکرێن.</p>
                    <label className="mt-4 block text-sm font-bold">ژمارەی ناسنامەی نیشتمانی
                      <input required maxLength={30} value={nationalId} onChange={(event) => setNationalId(event.target.value)} placeholder="ژمارەی ناسنامە" className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3"/>
                    </label>
                    <label className="mt-3 block text-sm font-bold">واژۆی پەیمان – ناوی تەواوت بنووسە
                      <input required maxLength={120} value={pledgeSignature} onChange={(event) => setPledgeSignature(event.target.value)} placeholder="ناوی تەواو وەک ناسنامە" className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3"/>
                    </label>
                    <div className="mt-4 space-y-3">
                      {pledgeCommitments.map((commitment) => (
                        <label key={commitment.key} className="flex cursor-pointer items-start gap-3 rounded-xl border border-orange-100 bg-white p-3">
                          <input type="checkbox" checked={pledgeChoices[commitment.key]}
                            onChange={(event) => setPledgeChoices((current) => ({ ...current, [commitment.key]: event.target.checked }))}
                            className="mt-1 h-4 w-4 shrink-0 accent-[#f47721]"/>
                          <span className="text-sm leading-7"><b className="block">{commitment.title}</b><small className="mt-1 block text-slate-600">{commitment.detail}</small></span>
                        </label>
                      ))}
                    </div>
                    <p className="mt-3 text-xs leading-6 text-slate-600">بە ناردنی داواکاری، پشتڕاست دەکەیتەوە کە پەیمانەکەت خوێندووەتەوە و بە خۆڕایی پەسەندی دەکەیت. وەشانی پەیمان و کاتی واژۆکردن تۆمار دەکرێت.</p>
                  </section>

                  <label className="block text-sm font-bold">تێبینی (ئارەزوومەندانە)
                    <textarea value={note} onChange={(event) => setNote(event.target.value)} rows={3} maxLength={500} className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3" placeholder="زانیاری زیادە بۆ داواکاری..."/>
                  </label>
                  <button disabled={saving || !phone.trim() || !nationalId.trim() || !pledgeSignature.trim() || Object.values(pledgeChoices).some((accepted) => !accepted) || (captainType === "merchant" && !merchantId)} className="rounded-xl bg-shakh-orange px-5 py-3 font-bold text-white disabled:opacity-50">
                    {saving ? "تکایە چاوەڕێ بکە..." : "ناردنی داواکاری کاپتن"}
                  </button>
                </form>
              )}
            </section>
          )}

          {applications.length > 0 && (
            <section className="mt-5 rounded-2xl bg-white p-6 shadow-soft">
              <h2 className="text-lg font-black">مێژووی داواکارییەکان</h2>
              {applications.map((application) => (
                <div key={application.id} className="mt-3 flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 py-3 last:border-0">
                  <div>
                    <b>{application.captain_type === "shakh" ? "کاپتنی شاخ" : "کاپتنی تایبەت بە دوکان"}</b>
                    <p className="mt-1 text-xs text-slate-500">{new Date(application.created_at).toLocaleDateString("ckb-IQ")}</p>
                  </div>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold">{statusNames[application.status] || application.status}</span>
                </div>
              ))}
            </section>
          )}
        </>}
      </div>
    </main>
  );
}
