"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Application = {
  id: string;
  user_id: string;
  captain_type: "shakh" | "merchant";
  merchant_id: string | null;
  note: string | null;
  created_at: string;
};
type Profile = { id: string; full_name: string | null; email: string | null; phone: string | null };
type Merchant = { id: string; business_name: string };

export default function CaptainApplicationsPage() {
  const [applications, setApplications] = useState<Application[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [merchants, setMerchants] = useState<Record<string, string>>({});
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
      .select("id,user_id,captain_type,merchant_id,note,created_at")
      .eq("status", "pending").order("created_at", { ascending: true });
    if (error) throw error;

    const userIds = [...new Set((data || []).map((item) => item.user_id))];
    const merchantIds = [...new Set((data || []).map((item) => item.merchant_id).filter((id): id is string => !!id))];
    const [profileResult, merchantResult] = await Promise.all([
      userIds.length ? supabase.from("profiles").select("id,full_name,email,phone").in("id", userIds) : Promise.resolve({ data: [], error: null }),
      merchantIds.length ? supabase.from("merchant_profiles").select("id,business_name").in("id", merchantIds) : Promise.resolve({ data: [], error: null }),
    ]);

    setApplications(data || []);
    setProfiles(Object.fromEntries((profileResult.data || []).map((item) => [item.id, item])));
    setMerchants(Object.fromEntries((merchantResult.data || []).map((item) => [item.id, item.business_name])));
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
    setMessage(approve ? "داواکاری پەسەند کرا و ڕۆڵی کپتن چالاک بوو." : "داواکاری ڕەتکرایەوە.");
    await load();
  }

  return (
    <main className="min-h-screen px-4 py-8">
      <div className="mx-auto max-w-5xl">
        <Link href="/dashboard/admin" className="font-bold text-shakh-blue">← داشبۆردی سوپەر ئەدمین</Link>
        <h1 className="mt-6 text-3xl font-black">داواکارییەکانی کپتن</h1>
        <p className="mt-2 text-sm text-slate-500">پێداچوونەوە و پەسەندکردنی دوو جۆری کپتن</p>
        {message && <p role="status" className="mt-4 rounded-xl bg-blue-50 p-3 text-sm text-blue-800">{message}</p>}
        {loading ? <p className="mt-8">بارکردن...</p> : applications.length === 0 ? (
          <p className="mt-6 rounded-2xl bg-white p-8 text-center text-slate-500">هیچ داواکاری کپتنێکی چاوەڕوانکراو نییە.</p>
        ) : applications.map((application) => {
          const profile = profiles[application.user_id];
          return (
            <article key={application.id} className="mt-4 rounded-2xl bg-white p-5 shadow-soft">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-black">{profile?.full_name || "بێ ناو"}</h2>
                  <p className="mt-1 text-sm text-slate-500">{profile?.email || application.user_id}</p>
                  {profile?.phone && <p className="mt-1 text-sm text-slate-500">{profile.phone}</p>}
                </div>
                <span className="rounded-full bg-orange-50 px-3 py-2 text-sm font-bold text-shakh-orange">
                  {application.captain_type === "shakh" ? "کپتنی شاخ" : "کپتنی تایبەت بە دوکان"}
                </span>
              </div>
              {application.captain_type === "merchant" && (
                <p className="mt-3 rounded-xl bg-blue-50 p-3 text-sm text-blue-900">دوکان: {application.merchant_id ? merchants[application.merchant_id] || "دوکان نەدۆزرایەوە" : "—"}</p>
              )}
              {application.note && <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-slate-600">{application.note}</p>}
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
