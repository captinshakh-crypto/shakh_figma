"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Check, ChevronDown, ChevronUp, Pencil, Plus, RefreshCw, Save, X } from "lucide-react";

type StoreType = "supermarket" | "restaurant" | "butcher_poultry" | "grocery" | "shakh_store";
type Category = { id: string; store_type: StoreType; category_key: string; name: string; sort_order: number; is_active: boolean };
type Subcategory = { id: string; category_id: string; subcategory_key: string; name: string; sort_order: number; is_active: boolean };

const storeTypes: { value: StoreType; label: string }[] = [
  { value: "supermarket", label: "سوپەرمارکێت" },
  { value: "restaurant", label: "چێشتخانە" },
  { value: "butcher_poultry", label: "گۆشت و سپیاتی" },
  { value: "grocery", label: "بەقالی" },
  { value: "shakh_store", label: "شاخ ستۆر" },
];

const emptyCategory = { category_key: "", name: "", sort_order: "0" };
const emptySubcategory = { subcategory_key: "", name: "", sort_order: "0" };

export default function AdminCategoriesPage() {
  const [storeType, setStoreType] = useState<StoreType>("supermarket");
  const [categories, setCategories] = useState<Category[]>([]);
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState("");
  const [categoryForm, setCategoryForm] = useState(emptyCategory);
  const [subcategoryForm, setSubcategoryForm] = useState(emptySubcategory);
  const [editingCategoryId, setEditingCategoryId] = useState("");
  const [editingSubcategoryId, setEditingSubcategoryId] = useState("");
  const [showSubcategories, setShowSubcategories] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function load() {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { window.location.assign("/login"); return; }
    const { data: profile, error: profileError } = await supabase.from("profiles").select("role").eq("id", user.id).single();
    if (profileError) throw profileError;
    if (profile?.role !== "super_admin") { window.location.assign("/dashboard"); return; }

    const [categoryResult, subcategoryResult] = await Promise.all([
      supabase.from("product_categories").select("*").order("store_type").order("sort_order").order("name"),
      supabase.from("product_subcategories").select("*").order("sort_order").order("name"),
    ]);
    if (categoryResult.error) throw categoryResult.error;
    if (subcategoryResult.error) throw subcategoryResult.error;
    const categoryRows = (categoryResult.data || []) as Category[];
    setCategories(categoryRows);
    setSubcategories((subcategoryResult.data || []) as Subcategory[]);
    setSelectedCategoryId((current) => current && categoryRows.some((row) => row.id === current) ? current : categoryRows.find((row) => row.store_type === storeType)?.id || "");
    setLoading(false);
  }

  useEffect(() => {
    void load().catch((error) => { setMessage(error instanceof Error ? error.message : "نەتوانرا کاتەگۆرییەکان باربکرێن."); setLoading(false); });
  }, []);

  const visibleCategories = useMemo(
    () => categories.filter((category) => category.store_type === storeType),
    [categories, storeType]
  );
  const selectedCategory = categories.find((category) => category.id === selectedCategoryId) || null;
  const visibleSubcategories = subcategories.filter((subcategory) => subcategory.category_id === selectedCategoryId);

  function resetCategoryForm() {
    setCategoryForm(emptyCategory);
    setEditingCategoryId("");
  }

  function editCategory(category: Category) {
    setCategoryForm({ category_key: category.category_key, name: category.name, sort_order: String(category.sort_order) });
    setEditingCategoryId(category.id);
  }

  async function saveCategory(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    try {
      const payload = {
        category_key: categoryForm.category_key.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "_"),
        name: categoryForm.name.trim(),
        sort_order: Number(categoryForm.sort_order || 0),
      };
      if (!payload.category_key || !payload.name || !Number.isSafeInteger(payload.sort_order)) {
        throw new Error("کلیل و ناو و ڕیزبەندییەکە بە دروستی پڕ بکەرەوە.");
      }
      const supabase = createClient();
      const result = editingCategoryId
        ? await supabase.from("product_categories").update(payload).eq("id", editingCategoryId)
        : await supabase.from("product_categories").insert({ ...payload, store_type: storeType });
      if (result.error) throw result.error;
      setMessage(editingCategoryId ? "کاتەگۆری نوێ کرایەوە." : "کاتەگۆری زیاد کرا.");
      resetCategoryForm();
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "پاشەکەوتکردن سەرکەوتوو نەبوو.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleCategory(category: Category) {
    if (!window.confirm(category.is_active ? "کاتەگۆرییەکە ناچالاک بکرێت؟ لە پۆستی نوێدا هەڵنابژێردرێت." : "کاتەگۆرییەکە دووبارە چالاک بکرێتەوە؟")) return;
    setSaving(true);
    try {
      const { error } = await createClient().from("product_categories").update({ is_active: !category.is_active }).eq("id", category.id);
      if (error) throw error;
      setMessage(category.is_active ? "کاتەگۆری ناچالاک کرا؛ مێژووی پۆستە کۆنەکان پارێزراوە." : "کاتەگۆری چالاک کرایەوە.");
      await load();
    } catch (error) { setMessage(error instanceof Error ? error.message : "گۆڕینی دۆخی کاتەگۆری سەرکەوتوو نەبوو."); }
    finally { setSaving(false); }
  }

  function resetSubcategoryForm() {
    setSubcategoryForm(emptySubcategory);
    setEditingSubcategoryId("");
  }

  function editSubcategory(subcategory: Subcategory) {
    setSubcategoryForm({ subcategory_key: subcategory.subcategory_key, name: subcategory.name, sort_order: String(subcategory.sort_order) });
    setEditingSubcategoryId(subcategory.id);
  }

  async function saveSubcategory(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedCategoryId) { setMessage("سەرەتا کاتەگۆرییەکی سەرەکی هەڵبژێرە."); return; }
    setSaving(true);
    setMessage("");
    try {
      const payload = {
        category_id: selectedCategoryId,
        subcategory_key: subcategoryForm.subcategory_key.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "_"),
        name: subcategoryForm.name.trim(),
        sort_order: Number(subcategoryForm.sort_order || 0),
      };
      if (!payload.subcategory_key || !payload.name || !Number.isSafeInteger(payload.sort_order)) {
        throw new Error("کلیل و ناو و ڕیزبەندییەکە بە دروستی پڕ بکەرەوە.");
      }
      const supabase = createClient();
      const result = editingSubcategoryId
        ? await supabase.from("product_subcategories").update(payload).eq("id", editingSubcategoryId)
        : await supabase.from("product_subcategories").insert(payload);
      if (result.error) throw result.error;
      setMessage(editingSubcategoryId ? "ژێرکاتەگۆری نوێ کرایەوە." : "ژێرکاتەگۆری زیاد کرا.");
      resetSubcategoryForm();
      await load();
    } catch (error) { setMessage(error instanceof Error ? error.message : "پاشەکەوتکردنی ژێرکاتەگۆری سەرکەوتوو نەبوو."); }
    finally { setSaving(false); }
  }

  async function toggleSubcategory(subcategory: Subcategory) {
    setSaving(true);
    try {
      const { error } = await createClient().from("product_subcategories").update({ is_active: !subcategory.is_active }).eq("id", subcategory.id);
      if (error) throw error;
      setMessage(subcategory.is_active ? "ژێرکاتەگۆری ناچالاک کرا." : "ژێرکاتەگۆری چالاک کرایەوە.");
      await load();
    } catch (error) { setMessage(error instanceof Error ? error.message : "گۆڕینی دۆخی ژێرکاتەگۆری سەرکەوتوو نەبوو."); }
    finally { setSaving(false); }
  }

  return (
    <main className="min-h-screen px-4 py-8">
      <div className="mx-auto max-w-6xl">
        <Link href="/dashboard/admin" className="font-bold text-shakh-blue">← داشبۆردی سوپەر ئەدمین</Link>
        <header className="mt-6">
          <p className="text-sm font-bold text-shakh-orange">SHAKH · CENTRAL CATALOG</p>
          <h1 className="mt-1 text-3xl font-black">بەڕێوەبردنی کاتەگۆری و ژێرکاتەگۆری</h1>
          <p className="mt-2 text-sm leading-7 text-slate-500">هەموو دوکاندارەکان هەمان لیستی ناوەندی بەکار دەهێنن. کاتەگۆریی ناچالاک لە پۆستی نوێدا نیشان نادرێت؛ پۆست و مێژووی کۆن بەردەوام دەمێننەوە.</p>
        </header>
        {message && <p role="status" className="mt-5 rounded-xl bg-blue-50 p-4 text-sm text-blue-800">{message}</p>}
        <section className="mt-6 rounded-2xl bg-white p-5 shadow-soft">
          <label className="block text-sm font-bold">جۆری دوکان
            <select value={storeType} onChange={(event) => { const next = event.target.value as StoreType; setStoreType(next); setEditingCategoryId(""); resetCategoryForm(); setSelectedCategoryId(categories.find((item) => item.store_type === next)?.id || ""); resetSubcategoryForm(); }} className="mt-2 w-full rounded-xl border border-slate-200 p-3">
              {storeTypes.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
            </select>
          </label>
        </section>
        {loading ? <p className="mt-6 text-slate-500">بارکردنی کاتەگۆرییەکان...</p> : (
          <div className="mt-6 grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
            <section className="rounded-2xl bg-white p-5 shadow-soft">
              <div className="flex items-center justify-between gap-2"><h2 className="text-xl font-black">کاتەگۆرییە سەرەکییەکان ({visibleCategories.length})</h2><button type="button" onClick={() => void load()} className="rounded-lg border p-2" aria-label="نوێکردنەوە"><RefreshCw size={17}/></button></div>
              <form onSubmit={saveCategory} className="mt-4 grid gap-3 sm:grid-cols-2">
                <label className="text-sm font-bold">ناوی کاتەگۆری
                  <input required maxLength={120} value={categoryForm.name} onChange={(event) => setCategoryForm((old) => ({ ...old, name: event.target.value }))} placeholder="نموونە: پاککەرەوەکان" className="mt-2 w-full rounded-xl border p-3"/>
                </label>
                <label className="text-sm font-bold">کلیل بە ئینگلیزی
                  <input required maxLength={80} pattern="[A-Za-z0-9_-]+" value={categoryForm.category_key} onChange={(event) => setCategoryForm((old) => ({ ...old, category_key: event.target.value }))} placeholder="cleaning" dir="ltr" className="mt-2 w-full rounded-xl border p-3"/>
                </label>
                <label className="text-sm font-bold">ڕیزبەندی
                  <input type="number" step="1" value={categoryForm.sort_order} onChange={(event) => setCategoryForm((old) => ({ ...old, sort_order: event.target.value }))} className="mt-2 w-full rounded-xl border p-3"/>
                </label>
                <div className="flex items-end gap-2">
                  <button disabled={saving} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-shakh-orange px-4 font-bold text-white disabled:opacity-50"><Save size={16}/>{editingCategoryId ? "نوێکردنەوە" : "زیادکردن"}</button>
                  {editingCategoryId && <button type="button" onClick={resetCategoryForm} className="inline-flex min-h-11 items-center gap-2 rounded-xl border px-4 font-bold"><X size={16}/> پاشگەزبوونەوە</button>}
                </div>
              </form>
              <div className="mt-5 space-y-2">
                {visibleCategories.map((category) => (
                  <div key={category.id} className={`flex flex-wrap items-center gap-2 rounded-xl border p-3 ${selectedCategoryId === category.id ? "border-shakh-blue bg-blue-50" : "border-slate-100"}`}>
                    <button type="button" onClick={() => { setSelectedCategoryId(category.id); resetSubcategoryForm(); }} className="min-w-0 flex-1 text-right">
                      <b className="block">{category.name}</b><span className="text-xs text-slate-400" dir="ltr">{category.category_key} · {subcategories.filter((row) => row.category_id === category.id).length} ژێرکاتەگۆری</span>
                    </button>
                    <span className={`rounded-full px-2 py-1 text-[11px] font-bold ${category.is_active ? "bg-green-50 text-green-700" : "bg-slate-100 text-slate-500"}`}>{category.is_active ? "چالاک" : "ناچالاک"}</span>
                    <button type="button" onClick={() => editCategory(category)} aria-label="دەستکاریکردن" className="rounded-lg border p-2"><Pencil size={15}/></button>
                    <button type="button" disabled={saving} onClick={() => void toggleCategory(category)} aria-label="گۆڕینی دۆخ" className="rounded-lg border p-2">{category.is_active ? <X size={15}/> : <Check size={15}/>}</button>
                  </div>
                ))}
                {visibleCategories.length === 0 && <p className="rounded-xl bg-slate-50 p-5 text-center text-sm text-slate-500">هێشتا کاتەگۆری بۆ ئەم دوکانە نییە.</p>}
              </div>
            </section>

            <section className="rounded-2xl bg-white p-5 shadow-soft">
              <button type="button" onClick={() => setShowSubcategories((value) => !value)} className="flex w-full items-center justify-between text-right">
                <span><h2 className="text-xl font-black">ژێرکاتەگۆری</h2><span className="mt-1 block text-xs text-slate-500">{selectedCategory?.name || "کاتەگۆرییەک هەڵبژێرە"}</span></span>
                {showSubcategories ? <ChevronUp size={19}/> : <ChevronDown size={19}/>}
              </button>
              {showSubcategories && <>
                <form onSubmit={saveSubcategory} className="mt-4 space-y-3">
                  <label className="block text-sm font-bold">ناوی ژێرکاتەگۆری
                    <input required maxLength={120} disabled={!selectedCategoryId} value={subcategoryForm.name} onChange={(event) => setSubcategoryForm((old) => ({ ...old, name: event.target.value }))} placeholder="نموونە: مایعی قاپشۆر" className="mt-2 w-full rounded-xl border p-3"/>
                  </label>
                  <label className="block text-sm font-bold">کلیل بە ئینگلیزی
                    <input required maxLength={80} pattern="[A-Za-z0-9_-]+" dir="ltr" disabled={!selectedCategoryId} value={subcategoryForm.subcategory_key} onChange={(event) => setSubcategoryForm((old) => ({ ...old, subcategory_key: event.target.value }))} placeholder="dishwashing" className="mt-2 w-full rounded-xl border p-3"/>
                  </label>
                  <label className="block text-sm font-bold">ڕیزبەندی
                    <input type="number" step="1" disabled={!selectedCategoryId} value={subcategoryForm.sort_order} onChange={(event) => setSubcategoryForm((old) => ({ ...old, sort_order: event.target.value }))} className="mt-2 w-full rounded-xl border p-3"/>
                  </label>
                  <div className="flex gap-2">
                    <button disabled={saving || !selectedCategoryId} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-shakh-blue px-4 font-bold text-white disabled:opacity-50"><Plus size={16}/>{editingSubcategoryId ? "نوێکردنەوە" : "زیادکردنی ژێرکاتەگۆری"}</button>
                    {editingSubcategoryId && <button type="button" onClick={resetSubcategoryForm} className="inline-flex min-h-11 items-center gap-2 rounded-xl border px-3 font-bold"><X size={16}/></button>}
                  </div>
                </form>
                <div className="mt-5 space-y-2">
                  {visibleSubcategories.map((subcategory) => (
                    <div key={subcategory.id} className="flex items-center gap-2 rounded-xl border border-slate-100 p-3">
                      <span className="min-w-0 flex-1"><b className="block text-sm">{subcategory.name}</b><span dir="ltr" className="text-[11px] text-slate-400">{subcategory.subcategory_key}</span></span>
                      <span className={`rounded-full px-2 py-1 text-[10px] font-bold ${subcategory.is_active ? "bg-green-50 text-green-700" : "bg-slate-100 text-slate-500"}`}>{subcategory.is_active ? "چالاک" : "ناچالاک"}</span>
                      <button type="button" onClick={() => editSubcategory(subcategory)} aria-label="دەستکاریکردن" className="rounded-lg border p-2"><Pencil size={14}/></button>
                      <button type="button" onClick={() => void toggleSubcategory(subcategory)} aria-label="گۆڕینی دۆخ" className="rounded-lg border p-2">{subcategory.is_active ? <X size={14}/> : <Check size={14}/>}</button>
                    </div>
                  ))}
                  {selectedCategoryId && visibleSubcategories.length === 0 && <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">هیچ ژێرکاتەگۆرییەک نییە.</p>}
                </div>
              </>}
            </section>
          </div>
        )}
      </div>
    </main>
  );
}
