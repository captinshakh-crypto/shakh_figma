"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Pencil, Plus, Save, X } from "lucide-react";
import { ZoneBoundaryEditor, type ZoneBoundary } from "@/components/zone-boundary-editor";

type Zone = {
  id: string;
  name: string;
  description: string | null;
  delivery_fee_iqd: number;
  shakh_delivery_share_iqd: number;
  captain_delivery_share_iqd: number;
  is_active: boolean;
  boundary_geojson: ZoneBoundary | null;
};

const initialForm = {
  name: "",
  description: "",
  fee: "1000",
  shakh: "200",
  captain: "800",
  isActive: true,
};

export default function ZonesPage() {
  const [zones, setZones] = useState<Zone[]>([]);
  const [form, setForm] = useState(initialForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [boundary, setBoundary] = useState<ZoneBoundary | null>(null);
  const [boundaryEditorVersion, setBoundaryEditorVersion] = useState(0);

  const fee = Number(form.fee);
  const shakh = Number(form.shakh);
  const captain = Number(form.captain);
  const validAmounts = [fee, shakh, captain].every((value) =>
    Number.isSafeInteger(value) && value >= 0
  );
  const isSplitValid = validAmounts && shakh <= fee && captain === fee - shakh;
  const remaining = validAmounts ? fee - shakh - captain : Number.NaN;

  async function load() {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { window.location.href = "/login"; return; }

    const { data: profile } = await supabase.from("profiles")
      .select("role").eq("id", user.id).single();
    if (profile?.role !== "super_admin") { window.location.href = "/dashboard"; return; }

    const { data, error } = await supabase.from("service_zones")
      .select("id,name,description,delivery_fee_iqd,shakh_delivery_share_iqd,captain_delivery_share_iqd,is_active,boundary_geojson")
      .order("name");
    if (error) throw error;
    setZones((data || []) as unknown as Zone[]);
    setLoading(false);
  }

  useEffect(() => {
    load().catch(() => { setMessage("نەتوانرا زۆنەکان باربکرێن."); setLoading(false); });
  }, []);

  function editZone(zone: Zone) {
    setEditingId(zone.id);
    setBoundaryEditorVersion((version) => version + 1);
    setBoundary(zone.boundary_geojson);
    setForm({
      name: zone.name,
      description: zone.description || "",
      fee: String(zone.delivery_fee_iqd),
      shakh: String(zone.shakh_delivery_share_iqd),
      captain: String(zone.captain_delivery_share_iqd),
      isActive: zone.is_active,
    });
    setMessage("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function resetForm() {
    setEditingId(null);
    setForm(initialForm);
    setBoundary(null);
    setBoundaryEditorVersion((version) => version + 1);
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isSplitValid) {
      setMessage("کۆی بەشی شاخ و کاپتن دەبێت یەکسان بێت بە کرێی گەیاندن.");
      return;
    }
    setSaving(true);
    setMessage("");
    try {
      const args = {
        p_name: form.name.trim(),
        p_description: form.description.trim(),
        p_delivery_fee_iqd: fee,
        p_shakh_share_iqd: shakh,
        p_captain_share_iqd: captain,
        p_is_active: form.isActive,
      };
      const supabase = createClient();
      const { data: savedZoneId, error } = editingId
        ? await supabase.rpc("admin_save_service_zone", { ...args, p_zone_id: editingId })
        : await supabase.rpc("admin_save_service_zone", args);
      if (error) throw error;
      const zoneId = editingId || savedZoneId;
      if (!zoneId) throw new Error("ناسنامەی زۆن وەرنەگیرا.");
      setEditingId(zoneId);
      const { error: boundaryError } = await supabase.rpc("admin_save_service_zone_boundary", { p_zone_id: zoneId, p_boundary_geojson: boundary });
      if (boundaryError) throw boundaryError;
      setMessage(editingId ? "زۆن و نرخەکانی نوێ کرانەوە." : "زۆنی نوێ زیاد کرا.");
      resetForm();
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "پاشەکەوتکردنی زۆن سەرکەوتوو نەبوو.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleZone(zone: Zone) {
    setSaving(true);
    setMessage("");
    const { error } = await createClient().rpc("admin_save_service_zone", {
      p_zone_id: zone.id,
      p_name: zone.name,
      p_description: zone.description || "",
      p_delivery_fee_iqd: zone.delivery_fee_iqd,
      p_shakh_share_iqd: zone.shakh_delivery_share_iqd,
      p_captain_share_iqd: zone.captain_delivery_share_iqd,
      p_is_active: !zone.is_active,
    });
    setSaving(false);
    setMessage(error?.message || (zone.is_active ? "زۆن ناچالاک کرا." : "زۆن چالاک کرایەوە."));
    if (!error) await load();
  }

  const activeCount = useMemo(() => zones.filter((zone) => zone.is_active).length, [zones]);

  return (
    <main className="min-h-screen px-4 py-8">
      <div className="mx-auto max-w-5xl">
        <Link href="/dashboard/admin" className="font-bold text-shakh-blue">← سوپەر ئەدمین</Link>
        <div className="mt-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-3xl font-black">زۆنەکانی گەیاندن</h1>
            <p className="mt-2 text-sm text-slate-500">کرێی گەیاندن و دابەشکردنی بڕەکە بۆ شاخ و کاپتن بۆ هەر زۆنێک بە جیاوازی</p>
          </div>
          <span className="rounded-full bg-blue-50 px-4 py-2 text-sm font-bold text-shakh-blue">{activeCount} زۆنی چالاک</span>
        </div>

        {message && <p role="status" className="mt-5 rounded-xl bg-blue-50 p-4 text-sm text-blue-800">{message}</p>}

        <section className="mt-6 rounded-2xl bg-white p-6 shadow-soft">
          <div className="flex items-center gap-2">
            {editingId ? <Pencil className="text-shakh-orange"/> : <Plus className="text-shakh-orange"/>}
            <h2 className="text-xl font-black">{editingId ? "دەستکاریکردنی زۆن" : "زیادکردنی زۆنی نوێ"}</h2>
          </div>
          <form onSubmit={save} className="mt-5 space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <label className="block text-sm font-bold">ناوی زۆن / گەڕەک
                <input required maxLength={120} value={form.name} onChange={(event) => setForm((old) => ({ ...old, name: event.target.value }))} placeholder="بۆ نموونە: عەنکاوە" className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3"/>
              </label>
              <label className="block text-sm font-bold">تێبینی (ئارەزوومەندانە)
                <input maxLength={500} value={form.description} onChange={(event) => setForm((old) => ({ ...old, description: event.target.value }))} placeholder="سنووری ناوچە یان وردەکاری" className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3"/>
              </label>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <label className="block text-sm font-bold">کرێی گەیاندن (د.ع)
                <input required type="number" min="0" step="1" value={form.fee} onChange={(event) => setForm((old) => ({ ...old, fee: event.target.value }))} className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3"/>
              </label>
              <label className="block text-sm font-bold">بەشی شاخ (د.ع)
                <input required type="number" min="0" step="1" value={form.shakh} onChange={(event) => setForm((old) => ({ ...old, shakh: event.target.value }))} className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3"/>
              </label>
              <label className="block text-sm font-bold">بەشی کاپتن (د.ع)
                <input required type="number" min="0" step="1" value={form.captain} onChange={(event) => setForm((old) => ({ ...old, captain: event.target.value }))} className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3"/>
              </label>
            </div>

            <div className={`rounded-xl p-4 text-sm ${isSplitValid ? "bg-green-50 text-green-800" : "bg-amber-50 text-amber-800"}`}>
              <b>{isSplitValid ? "دابەشکردنی پارە دروستە" : "دابەشکردنی پارە یەکسان نییە"}</b>
              <p className="mt-1">
                شاخ: {validAmounts ? shakh.toLocaleString("en-US") : "—"} د.ع
                {" · "}
                کاپتن: {validAmounts ? captain.toLocaleString("en-US") : "—"} د.ع
                {" · "}
                کۆی گشتی: {validAmounts ? (shakh + captain).toLocaleString("en-US") : "—"} د.ع
              </p>
              {!isSplitValid && <p className="mt-1">جیاوازی: {Number.isFinite(remaining) ? remaining.toLocaleString("en-US") : "—"} د.ع؛ کۆی دوو بەشەکە دەبێت کرێی گەیاندن بێت.</p>}
            </div>

            <ZoneBoundaryEditor key={`${editingId || "new-zone"}-${boundaryEditorVersion}`} initialValue={boundary} onChange={setBoundary} />

            <label className="flex items-center gap-3 text-sm font-bold">
              <input type="checkbox" checked={form.isActive} onChange={(event) => setForm((old) => ({ ...old, isActive: event.target.checked }))} className="h-4 w-4"/>
              ئەم زۆنە چالاک بێت و لە Checkout پیشان بدرێت
            </label>

            <div className="flex flex-wrap gap-2">
              <button disabled={saving || !isSplitValid || !form.name.trim()} className="inline-flex items-center gap-2 rounded-xl bg-shakh-orange px-5 py-3 font-bold text-white disabled:opacity-50">
                <Save size={17}/>{saving ? "پاشەکەوت دەکرێت..." : editingId ? "پاشەکەوتکردنی گۆڕانکاری" : "زیادکردنی زۆن"}
              </button>
              {editingId && <button type="button" onClick={resetForm} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-5 py-3 font-bold text-slate-700"><X size={17}/> هەڵوەشاندنەوە</button>}
            </div>
          </form>
        </section>

        <section className="mt-7">
          <h2 className="text-xl font-black">هەموو زۆنەکان ({zones.length})</h2>
          {loading ? <p className="mt-4 text-sm text-slate-500">بارکردن...</p> : zones.length === 0 ? (
            <p className="mt-4 rounded-2xl bg-white p-8 text-center text-slate-500">هێشتا هیچ زۆنێک زیاد نەکراوە. لەسەرەوە یەکەم زۆن زیاد بکە.</p>
          ) : zones.map((zone) => (
            <article key={zone.id} className="mt-3 rounded-2xl bg-white p-5 shadow-soft">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-lg font-black">{zone.name}</h3>
                    <span className={`rounded-full px-3 py-1 text-xs font-bold ${zone.is_active ? "bg-green-50 text-green-700" : "bg-slate-100 text-slate-500"}`}>{zone.is_active ? "چالاک" : "ناچالاک"}</span>
                  </div>
                  {zone.description && <p className="mt-1 text-sm text-slate-500">{zone.description}</p>}
                  <p className={`mt-2 text-xs font-bold ${zone.boundary_geojson ? "text-emerald-700" : "text-amber-700"}`}>{zone.boundary_geojson ? "سنووری نەخشە تۆمار کراوە" : "سنووری نەخشە دیاری نەکراوە — ئۆردەر وەرناگیرێت"}</p>
                </div>
                <div className="text-left">
                  <p className="text-xs text-slate-500">کرێی گەیاندن</p>
                  <b className="text-xl">{zone.delivery_fee_iqd.toLocaleString("en-US")} د.ع</b>
                </div>
              </div>
              <div className="mt-4 grid gap-3 rounded-xl bg-slate-50 p-4 sm:grid-cols-2">
                <div><p className="text-xs text-slate-500">بەشی شاخ</p><b className="text-lg text-shakh-orange">{zone.shakh_delivery_share_iqd.toLocaleString("en-US")} د.ع</b></div>
                <div><p className="text-xs text-slate-500">بەشی کاپتن</p><b className="text-lg text-shakh-blue">{zone.captain_delivery_share_iqd.toLocaleString("en-US")} د.ع</b></div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <button onClick={() => editZone(zone)} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700">دەستکاری</button>
                <button disabled={saving} onClick={() => void toggleZone(zone)} className="rounded-lg bg-slate-100 px-4 py-2 text-sm font-bold disabled:opacity-50">{zone.is_active ? "ناچالاککردن" : "چالاککردن"}</button>
              </div>
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}
