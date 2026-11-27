"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Enums } from "@/lib/supabase/database.types";

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
  const [nationalIdNumber, setNationalIdNumber] = useState("");
  const [identityDocument, setIdentityDocument] = useState<File | null>(null);
  const [agreementAccepted, setAgreementAccepted] = useState(false);
  const [captainAgreementAccepted, setCaptainAgreementAccepted] = useState(false);
  const [existingAgreementChecked, setExistingAgreementChecked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [requiresPhone, setRequiresPhone] = useState(false);

  async function load() {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { window.location.href = "/login"; return; }

    const [p, c, a, m, roleResult, agreementResult] = await Promise.all([
      supabase.from("profiles").select("email,full_name,phone,role").eq("id", user.id).single(),
      supabase.from("captain_profiles").select("captain_type,merchant_id,is_active").eq("user_id", user.id).maybeSingle(),
      supabase.from("captain_applications").select("id,captain_type,merchant_id,note,status,created_at").eq("user_id", user.id).order("created_at", { ascending: false }),
      supabase.from("merchant_profiles").select("id,business_name").eq("approval_status", "approved").order("business_name"),
      supabase.rpc("current_app_role"),
      supabase.from("captain_agreement_acceptances").select("id").eq("user_id", user.id).eq("agreement_version", "shakh-captain-terms-v1").maybeSingle(),
    ]);

    if (p.error) throw p.error;
    if (roleResult.error) throw roleResult.error;
    if (agreementResult.error) throw agreementResult.error;
    setProfile({
      ...p.data,
      role: roleResult.data || p.data.role,
    });
    setName(p.data.full_name || "");
    setPhone(p.data.phone || "");
    setCaptain(c.data);
    setCaptainAgreementAccepted(!!agreementResult.data);
    setApplications(a.data || []);
    setMerchants(m.data || []);
    if (c.data?.captain_type) setCaptainType(c.data.captain_type);
    setLoading(false);
  }

  useEffect(() => {
    setRequiresPhone(new URLSearchParams(window.location.search).get("require_phone") === "1");
    load().catch(() => { setMessage("نەتوانرا زانیاری پڕۆفایل باربکرێت."); setLoading(false); });
  }, []);

  async function saveProfile(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    if (!phone.trim()) { setMessage("ژمارەی مۆبایل مەرجە."); setSaving(false); return; }
    if (phone.replace(/\D/g, "").length < 7 || phone.replace(/\D/g, "").length > 20 || !/^[0-9+()\s-]+$/.test(phone.trim())) { setMessage("ژمارەی مۆبایل دروست نییە."); setSaving(false); return; }
    try {
      const { error } = await createClient().rpc("update_my_profile", {
        p_full_name: name.trim(),
        p_phone: phone.trim(),
      });
      if (error) throw error;
      setMessage("زانیاری پڕۆفایلەکەت پاشەکەوت کرا.");
      setRequiresPhone(false);
      window.history.replaceState({}, "", window.location.pathname);
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "پاشەکەوتکردنی زانیاری سەرکەوتوو نەبوو.");
    } finally {
      setSaving(false);
    }
  }

  async function acceptCurrentCaptainAgreement() {
    if (!existingAgreementChecked) { setMessage("پێویستە بەڵێننامەکە پەسەند بکەیت."); return; }
    setSaving(true);
    setMessage("");
    try {
      const { error } = await createClient().rpc("accept_current_captain_agreement", {
        p_user_agent: navigator.userAgent,
      });
      if (error) throw error;
      setCaptainAgreementAccepted(true);
      setMessage("بەڵێننامەی کاپتن پەسەند کرا و تۆمار کرا. ئێستا دەتوانیت دۆخی بەردەستبوون چالاک بکەیت.");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "پەسەندکردنی بەڵێننامە سەرکەوتوو نەبوو.");
    } finally {
      setSaving(false);
    }
  }

  async function applyForCaptain(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    let uploadedPath: string | null = null;
    try {
      const normalizedId = nationalIdNumber.replace(/\D/g, "");
      if (normalizedId.length < 5 || normalizedId.length > 20) throw new Error("ژمارەی ناسنامە دەبێت لە ٥ تا ٢٠ ژمارە بێت.");
      if (!identityDocument) throw new Error("وێنە یان PDF ـی ناسنامە باربکە.");
      if (identityDocument.size > 10 * 1024 * 1024) throw new Error("قەبارەی ناسنامە نابێت لە ١٠MB زیاتر بێت.");
      if (!["image/jpeg", "image/png", "image/webp", "application/pdf"].includes(identityDocument.type)) {
        throw new Error("فایلی ناسنامە دەبێت JPG، PNG، WebP یان PDF بێت.");
      }
      if (!agreementAccepted) throw new Error("پێویستە بەڵێننامەی کاپتن پەسەند بکەیت.");

      const supabase = createClient();
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!user) throw new Error("تکایە دووبارە بچۆ ژوورەوە.");

      const extension = identityDocument.type === "application/pdf" ? "pdf"
        : identityDocument.type === "image/png" ? "png"
        : identityDocument.type === "image/webp" ? "webp" : "jpg";
      uploadedPath = `${user.id}/${crypto.randomUUID()}.${extension}`;
      const { error: uploadError } = await supabase.storage.from("captain-documents").upload(uploadedPath, identityDocument, {
        contentType: identityDocument.type,
        upsert: false,
      });
      if (uploadError) throw uploadError;

      const { error } = await supabase.rpc("request_captain_application_v2", {
        p_captain_type: captainType,
        p_merchant_id: captainType === "merchant" ? merchantId : null,
        p_note: note.trim(),
        p_national_id_number: normalizedId,
        p_identity_document_path: uploadedPath,
        p_agreement_version: "shakh-captain-terms-v1",
        p_user_agent: navigator.userAgent,
      });
      if (error) throw error;
      uploadedPath = null;
      setMessage("داواکاری کاپتن لەگەڵ ناسنامە و پەسەندکردنی بەڵێننامە نێردرا. دوای پەسەندکردنی سوپەر ئەدمین ڕۆڵەکەت دەگۆڕدرێت.");
      setNote("");
      setNationalIdNumber("");
      setIdentityDocument(null);
      setAgreementAccepted(false);
      await load();
    } catch (error) {
      if (uploadedPath) await createClient().storage.from("captain-documents").remove([uploadedPath]);
      setMessage(error instanceof Error ? error.message : "ناردنی داواکاری سەرکەوتوو نەبوو.");
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

        {requiresPhone && <p role="alert" className="mt-5 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm font-bold leading-7 text-amber-900">بۆ بەردەوامبوون لە بەکارهێنانی شاخ، ژمارەی مۆبایلەکەت بنووسە. پشتڕاستکردنەوەی OTP پێویست نییە.</p>}
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

          {profile.role === "captain" && (
            <section className="mt-5 rounded-2xl border border-blue-100 bg-white p-6 shadow-soft">
              <h2 className="text-xl font-black">بەڵێننامەی کاپتن بۆ گەیاندن</h2>
              {captainAgreementAccepted ? (
                <p className="mt-3 rounded-xl bg-green-50 p-3 text-sm font-bold text-green-800">بەڵێننامەی shakh-captain-terms-v1 پەسەند کراوە و تۆمارەکە پارێزراوە.</p>
              ) : (
                <>
                  <p className="mt-2 text-sm leading-7 text-slate-600">پێش چالاککردنی بەردەستبوون و وەرگرتنی گەیاندن، پێویستە کاپتنی پێشتر پەسەندکراویش ئەم بەڵێننامەیە پەسەند بکات.</p>
                  <ul className="mt-3 list-disc space-y-1 pr-5 text-sm leading-7 text-slate-700">
                    <li>پاراستنی کەلوپەل و داواکارییەکانی کڕیار و دوکاندار.</li>
                    <li>ڕادەستکردنی دروستی کاڵا و پارە بە خاوەنەکەیان.</li>
                    <li>ڕێزگرتن لە کڕیار و دوکاندار و پاراستنی زانیاری تایبەتییان.</li>
                    <li>پابەندبوون بە یاسا و ڕێنمایی سەلامەتی هاتوچۆ و ڕێساکانی شاخ.</li>
                    <li>ڕاگەیاندنی هەر زیان، ونبوون یان دواخستنێک بە خێرایی.</li>
                    <li>وەرگرتنی بەرپرسیارێتی هەڵسوکەوتی خۆت لە چوارچێوەی یاسا و بەڵگەکاندا.</li>
                  </ul>
                  <label className="mt-4 flex cursor-pointer items-start gap-3 border-t border-slate-100 pt-4 text-sm font-bold">
                    <input type="checkbox" checked={existingAgreementChecked} onChange={(event) => setExistingAgreementChecked(event.target.checked)} className="mt-1"/>
                    <span>بەڵێننامەکەم خوێندووەتەوە و پەسەندی دەکەم.</span>
                  </label>
                  <button type="button" disabled={saving || !existingAgreementChecked} onClick={() => void acceptCurrentCaptainAgreement()} className="mt-4 rounded-xl bg-shakh-blue px-5 py-3 text-sm font-bold text-white disabled:opacity-50">{saving ? "تکایە چاوەڕێ بکە..." : "پەسەندکردنی بەڵێننامە"}</button>
                </>
              )}
            </section>
          )}

          <section className="mt-5 rounded-2xl bg-white p-6 shadow-soft">
            <h2 className="text-xl font-black">زانیاری کەسی</h2>
            <form onSubmit={saveProfile} className="mt-5 space-y-4">
              <label className="block text-sm font-bold">ناوی تەواو
                <input required maxLength={120} value={name} onChange={(event) => setName(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3"/>
              </label>
              <label className="block text-sm font-bold">ژمارەی مۆبایل
                <input type="tel" inputMode="tel" autoComplete="tel" required maxLength={30} value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="07xxxxxxxxx" className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3"/>
              </label>
              <button disabled={saving} className="rounded-xl bg-shakh-blue px-5 py-3 font-bold text-white disabled:opacity-50">
                {saving ? "تکایە چاوەڕێ بکە..." : "پاشەکەوتکردنی پڕۆفایل"}
              </button>
            </form>
          </section>

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

                  <label className="block text-sm font-bold">ژمارەی ناسنامەی فەرمی
                    <input required inputMode="numeric" maxLength={20} value={nationalIdNumber} onChange={(event) => setNationalIdNumber(event.target.value)} placeholder="ژمارەی ناسنامە" className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3"/>
                  </label>
                  <label className="block text-sm font-bold">وێنەی ناسنامە (JPG، PNG، WebP یان PDF — تا ١٠MB)
                    <input required type="file" accept="image/jpeg,image/png,image/webp,application/pdf" capture="environment" onChange={(event) => setIdentityDocument(event.target.files?.[0] || null)} className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"/>
                    <small className="mt-1 block text-xs font-normal text-slate-500">تەنها سوپەر ئەدمین دەتوانێت ئەم بەڵگەنامەیە ببینێت.</small>
                  </label>

                  <div className="rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm leading-7 text-blue-950">
                    <b className="block text-base">بەڵێننامەی کاپتن — شاخ</b>
                    <ol className="mt-2 list-decimal space-y-1 pr-5">
                      <li>کەلوپەل و داواکارییەکانی کڕیار و دوکاندار بە ئەمانەت و پارێزراوی دەگەیەنم.</li>
                      <li>پارە و کاڵا بە دروستی ڕادەستی خاوەنەکەیان دەکەم.</li>
                      <li>ڕێز لە کڕیار و دوکاندار دەگرم و زانیاری تایبەتییان دەپارێزم.</li>
                      <li>پابەندی یاسا، ڕێنمایی سەلامەتی هاتوچۆ و ڕێساکانی شاخ دەبم.</li>
                      <li>هەر زیان، ونبوون، کێشە یان دواخستنێک بە خێرایی بە شاخ ڕادەگەیەنم.</li>
                      <li>بەرپرسیارێتی هەڵسوکەوتی خۆم لە چوارچێوەی یاسا و بەڵگە پەیوەندیدارەکاندا دەگرمە ئەستۆ.</li>
                    </ol>
                    <label className="mt-4 flex cursor-pointer items-start gap-3 border-t border-blue-200 pt-3 font-bold">
                      <input type="checkbox" required checked={agreementAccepted} onChange={(event) => setAgreementAccepted(event.target.checked)} className="mt-1"/>
                      <span>بەڵێننامەکەم خوێندووەتەوە و پەسەندی دەکەم.</span>
                    </label>
                    <p className="mt-2 text-xs text-blue-800">وەشانی بەڵێننامە: shakh-captain-terms-v1 · کاتی پەسەندکردن بە ئۆتۆماتیکی لە سیستەم تۆمار دەکرێت.</p>
                  </div>

                  <label className="block text-sm font-bold">تێبینی (ئارەزوومەندانە)
                    <textarea value={note} onChange={(event) => setNote(event.target.value)} rows={3} maxLength={500} className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3" placeholder="زانیاری زیادە بۆ داواکاری..."/>
                  </label>
                  <button disabled={saving || (captainType === "merchant" && !merchantId)} className="rounded-xl bg-shakh-orange px-5 py-3 font-bold text-white disabled:opacity-50">
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
