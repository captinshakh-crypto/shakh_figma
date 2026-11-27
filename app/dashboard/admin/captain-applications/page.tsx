"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Json } from "@/lib/supabase/database.types";

type Application = {
  id: string;
  user_id: string;
  captain_type: "shakh" | "merchant";
  merchant_id: string | null;
  note: string | null;
  created_at: string;
  pledge_version: string | null;
  pledge_full_name: string | null;
  pledge_accepted_at: string | null;
  pledge_terms: Json | null;
};
type Profile = { id: string; full_name: string | null; email: string | null; phone: string | null };
type Merchant = { id: string; business_name: string };

export default function CaptainApplicationsPage() {
  const [applications, setApplications] = useState<Application[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [merchants, setMerchants] = useState<Record<string, string>>({});
  const [identities, setIdentities] = useState<Record<string, string>>({});
  const [identities, setIdentities] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");

  async function load() {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { window.location.href = "/login"; return; }
    const { data: admin } = await supabase.from("profiles").select("role").eq("id", user.id).single();
    if (admin?.role !== "super_admin") { window.location.href = "/dashboard"; return; }

    const { data, error } = await supabase.from("captain_applications")
      .select("id,user_id,captain_type,merchant_id,note,created_at,pledge_version,pledge_full_name,pledge_accepted_at,pledge_terms")
      .eq("status", "pending").order("created_at", { ascending: true });
    if (error) throw error;

    const userIds = [...new Set((data || []).map((item) => item.user_id))];
    const merchantIds = [...new Set((data || []).map((item) => item.merchant_id).filter((id): id is string => !!id))];
    const [profileResult, merchantResult, identityResult] = await Promise.all([
      userIds.length ? supabase.from("profiles").select("id,full_name,email,phone").in("id", userIds) : Promise.resolve({ data: [], error: null }),
      merchantIds.length ? supabase.from("merchant_profiles").select("id,business_name").in("id", merchantIds) : Promise.resolve({ data: [], error: null }),
      userIds.length ? supabase.from("captain_identity_details").select("user_id,national_id_number").in("user_id", userIds) : Promise.resolve({ data: [], error: null }),
    ]);
    if (profileResult.error) throw profileResult.error;
    if (merchantResult.error) throw merchantResult.error;
    if (identityResult.error) throw identityResult.error;

    setApplications(data || []);
    setProfiles(Object.fromEntries((profileResult.data || []).map((item) => [item.id, item])));
    setMerchants(Object.fromEntries((merchantResult.data || []).map((item) => [item.id, item.business_name])));
    setIdentities(Object.fromEntries((identityResult.data || []).map((item) => [item.user_id, item.national_id_number])));
    setIdentities(Object.fromEntries((identityResult.data || []).map((item) => [item.user_id, item.national_id_number])));
    setLoading(false);
  }

  useEffect(() => {
    load().catch(() => { setMessage("نەتوانرا داواکارییەکان باربکرێن."); setLoading(false); });
  }, []);

  async function review(id: string, approve: boolean) {
    setBusyId(id);
    setMessage("");
    const { error } = await createClient().rpc("review_captain_application", {
      p_application_id: id,
      p_approve: approve,
      p_admin_note: approve ? "" : "تکایە زانیاری داواکارییەکەت تەواو بکە و دووبارە هەوڵ بدەرەوە.",
    });
    setBusyId("");
    if (error) { setMessage(error.message); return; }
    setMessage(approve ? "داواکاری پەسەند کرا و ڕۆڵی کاپتن چالاک بوو." : "داواکاری ڕەتکرایەوە.");
    await load();
  }

  return (
    <main className="min-h-screen px-4 py-8">
      <div className="mx-auto max-w-5xl">
        <Link href="/dashboard/admin" className="font-bold text-shakh-blue">← داشبۆردی سوپەر ئەدمین</Link>
        <h1 className="mt-6 text-3xl font-black">داواکارییەکانی کاپتن</h1>
        <p className="mt-2 text-sm text-slate-500">پێداچوونەوە و پەسەندکردنی دوو جۆری کاپتن</p>
        {message && <p role="status" className="mt-4 rounded-xl bg-blue-50 p-3 text-sm text-blue-800">{message}</p>}
        {loading ? <p className="mt-8">بارکردن...</p> : applications.length === 0 ? (
          <p className="mt-6 rounded-2xl bg-white p-8 text-center text-slate-500">هیچ داواکاری کاپتنێکی چاوەڕوانکراو نییە.</p>
        ) : applications.map((application) => {
          const profile = profiles[application.user_id];
          return (
            <article key={application.id} className="mt-4 rounded-2xl bg-white p-5 shadow-soft">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-black">{profile?.full_name || "بێ ناو"}</h2>
                  <p className="mt-1 text-sm text-slate-500">{profile?.email || application.user_id}</p>
                  {profile?.phone && <p className="mt-1 text-sm text-slate-500">مۆبایل: {profile.phone}</p>}
                  <p className="mt-1 text-sm text-slate-700">ژمارەی ناسنامە: <span dir="ltr" className="font-mono">{identities[application.user_id] || "تۆمار نەکراوە"}</span></p>
                </div>
                <span className="rounded-full bg-orange-50 px-3 py-2 text-sm font-bold text-shakh-orange">
                  {application.captain_type === "shakh" ? "کاپتنی شاخ" : "کاپتنی تایبەت بە دوکان"}
                </span>
              </div>
              {application.captain_type === "merchant" && (
                <p className="mt-3 rounded-xl bg-blue-50 p-3 text-sm text-blue-900">دوکان: {application.merchant_id ? merchants[application.merchant_id] || "دوکان نەدۆزرایەوە" : "—"}</p>
              )}
              {application.note && <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-slate-600">{application.note}</p>}
              {(() => {
                const terms = application.pledge_terms && typeof application.pledge_terms === "object" && !Array.isArray(application.pledge_terms)
                  ? application.pledge_terms as Record<string, Json>
                  : {};
                return (
                  <div className="mt-4 rounded-xl border border-orange-100 bg-orange-50/70 p-4">
                    <h3 className="font-black text-[#0a3157]">پەیمانی کاپتن</h3>
                    <p className="mt-2 text-sm">واژۆ: <b>{application.pledge_full_name || "تۆمار نەکراوە"}</b></p>
                    <p className="mt-1 text-xs text-slate-500">وەشان: {application.pledge_version || "—"} {application.pledge_accepted_at ? `· واژۆکراوە لە ${new Date(application.pledge_accepted_at).toLocaleString("ckb-IQ")}` : ""}</p>
                    <ul className="mt-3 space-y-1 text-sm text-slate-700">
                      <li>{terms.protect_goods === true ? "✓" : "—"} پاراستنی کەل و پەل و کاڵا</li>
                      <li>{terms.honest_delivery === true ? "✓" : "—"} ڕاستگۆیی و گەیاندنی سەلامەت</li>
                      <li>{terms.respect_community === true ? "✓" : "—"} ڕێزگرتن لە بەها کۆمەڵایەتییەکان</li>
                      <li>{terms.protect_privacy === true ? "✓" : "—"} پاراستنی نهێنی و زانیاری</li>
                      <li>{terms.follow_rules === true ? "✓" : "—"} پابەندبوون بە ڕێنمایی شاخ</li>
                    </ul>
                  </div>
                );
              })()}

              <p className="mt-3 text-xs text-slate-400">{new Date(application.created_at).toLocaleString("ckb-IQ")}</p>
              <div className="mt-5 flex flex-wrap gap-2">
                <button disabled={busyId === application.id} onClick={() => review(application.id, true)} className="rounded-xl bg-green-600 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">پەسەندکردن</button>
                <button disabled={busyId === application.id} onClick={() => review(application.id, false)} className="rounded-xl bg-red-50 px-4 py-2.5 text-sm font-bold text-red-700 disabled:opacity-50">ڕەتکردنەوە</button>
              </div>
            </article>
          );
        })}
      </div>
    </main>
  );
}
