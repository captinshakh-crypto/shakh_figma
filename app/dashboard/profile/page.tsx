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
  captain: "کپتن",
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
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function load() {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { window.location.href = "/login"; return; }

    const [p, c, a, m] = await Promise.all([
      supabase.from("profiles").select("email,full_name,phone,role").eq("id", user.id).single(),
      supabase.from("captain_profiles").select("captain_type,merchant_id,is_active").eq("user_id", user.id).maybeSingle(),
      supabase.from("captain_applications").select("id,captain_type,merchant_id,note,status,created_at").eq("user_id", user.id).order("created_at", { ascending: false }),
      supabase.from("merchant_profiles").select("id,business_name").eq("approval_status", "approved").order("business_name"),
    ]);

    if (p.error) throw p.error;
    setProfile(p.data);
    setName(p.data.full_name || "");
    setPhone(p.data.phone || "");
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
    try {
      const { error } = await createClient().rpc("update_my_profile", {
        p_full_name: name.trim(),
        p_phone: phone.trim() || null,
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
    try {
      const { error } = await createClient().rpc("request_captain_application", {
        p_captain_type: captainType,
        p_merchant_id: captainType === "merchant" ? merchantId : null,
        p_note: note.trim() || null,
      });
      if (error) throw error;
      setMessage("داواکاری کپتن نێردرا. دوای پەسەندکردنی سوپەر ئەدمین ڕۆڵەکەت دەگۆڕدرێت.");
      setNote("");
      await load();
    } catch (error) {
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
                  ? "کپتنی شاخ — دەتوانێت بۆ داواکارییەکانی هەموو دوکانەکان دیاری بکرێت."
                  : `کپتنی تایبەت بە دوکان — سنووردارە بە ${selectedStore || "دوکانی دیاریکراو"}.`}
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
                <input type="tel" maxLength={30} value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="07xxxxxxxxx" className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3"/>
              </label>
              <button disabled={saving} className="rounded-xl bg-shakh-blue px-5 py-3 font-bold text-white disabled:opacity-50">
                {saving ? "تکایە چاوەڕێ بکە..." : "پاشەکەوتکردنی پڕۆفایل"}
              </button>
            </form>
          </section>

          {profile.role === "customer" && !captain?.is_active && (
            <section className="mt-5 rounded-2xl bg-white p-6 shadow-soft">
              <h2 className="text-xl font-black">داواکاری بوون بە کپتن</h2>
              <p className="mt-2 text-sm leading-7 text-slate-600">جۆری کپتن هەڵبژێرە. سوپەر ئەدمین داواکارییەکەت پێداچوونەوەی بۆ دەکات پێش ئەوەی ڕۆڵەکەت بگۆڕدرێت.</p>

              {pending ? (
                <p className="mt-4 rounded-xl bg-amber-50 p-4 text-sm text-amber-800">داواکارییەکت لە چاوەڕوانی پەسەندکردندایە.</p>
              ) : (
                <form onSubmit={applyForCaptain} className="mt-5 space-y-4">
                  <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 p-4">
                    <input type="radio" name="captainType" checked={captainType === "shakh"} onChange={() => setCaptainType("shakh")} className="mt-1"/>
                    <span><b className="block">کپتنی شاخ</b><small className="mt-1 block leading-6 text-slate-500">بۆ هەموو دوکانەکانی پلاتفۆرمی شاخ.</small></span>
                  </label>
                  <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 p-4">
                    <input type="radio" name="captainType" checked={captainType === "merchant"} onChange={() => setCaptainType("merchant")} className="mt-1"/>
                    <span><b className="block">کپتنی تایبەت بە یەک دوکان</b><small className="mt-1 block leading-6 text-slate-500">تەنها بۆ گەیاندنی داواکارییەکانی ئەو دوکانەی هەڵیدەبژێریت.</small></span>
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

                  <label className="block text-sm font-bold">تێبینی (ئارەزوومەندانە)
                    <textarea value={note} onChange={(event) => setNote(event.target.value)} rows={3} maxLength={500} className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3" placeholder="زانیاری زیادە بۆ داواکاری..."/>
                  </label>
                  <button disabled={saving || (captainType === "merchant" && !merchantId)} className="rounded-xl bg-shakh-orange px-5 py-3 font-bold text-white disabled:opacity-50">
                    {saving ? "تکایە چاوەڕێ بکە..." : "ناردنی داواکاری کپتن"}
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
                    <b>{application.captain_type === "shakh" ? "کپتنی شاخ" : "کپتنی تایبەت بە دوکان"}</b>
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
