"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Enums } from "@/lib/supabase/database.types";
import { PackagePlus, Pencil, Trash2, Eye, EyeOff, X, Save, Store, ImagePlus } from "lucide-react";

const merchantTypes: { value: Enums<"app_role">; label: string }[] = [
  { value: "supermarket", label: "سوپەرمارکێت" },
  { value: "restaurant", label: "چێشتخانە" },
  { value: "butcher_poultry", label: "گۆشت و سپیاتی" },
  { value: "grocery", label: "بەقالی" },
];

const roleNames: Record<string, string> = Object.fromEntries(merchantTypes.map((item) => [item.value, item.label]));

const categorySets: Record<string, { value: string; label: string }[]> = {
  supermarket: [
    { value: "groceries", label: "خۆراک و پێداویستی ماڵ" },
    { value: "dairy", label: "شیرەمەنی" },
    { value: "beverages", label: "خواردنەوە" },
    { value: "cleaning", label: "پاککەرەوە" },
    { value: "personal_care", label: "چاودێری کەسی" },
    { value: "frozen", label: "بەرهەمی ساردکراو" },
  ],
  restaurant: [
    { value: "meals", label: "خواردنی سەرەکی" },
    { value: "breakfast", label: "نانی بەیانی" },
    { value: "sides", label: "پاڵاوتە و لاوەکی" },
    { value: "drinks", label: "خواردنەوە" },
    { value: "desserts", label: "شیرینی" },
  ],
  butcher_poultry: [
    { value: "beef", label: "گۆشتی مانگا" },
    { value: "lamb", label: "گۆشتی مەڕ" },
    { value: "chicken", label: "گۆشتی مریشک" },
    { value: "poultry", label: "باڵندە" },
    { value: "spices", label: "سپیاتی و بەهارات" },
  ],
  grocery: [
    { value: "tomatoes", label: "تەماتە" },
    { value: "cucumbers", label: "خیار" },
    { value: "vegetables", label: "سەوزەوات" },
    { value: "fruits", label: "میوە" },
    { value: "leafy_greens", label: "سەوزەی گەڵادار" },
    { value: "herbs", label: "سەوزە و گیا بەهاراتییەکان" },
    { value: "staples", label: "پێداویستی بنەڕەتی" },
    { value: "other", label: "هی تر" },
  ],
  super_admin: [
    { value: "general", label: "گشتی" },
    { value: "household", label: "پێداویستی ماڵ" },
    { value: "electronics", label: "ئەلیکترۆنیات" },
    { value: "accessories", label: "ئاکسسوارات" },
    { value: "other", label: "هی تر" },
  ],
};

const units = [
  { value: "piece", label: "دانە" },
  { value: "kg", label: "کیلۆگرام" },
  { value: "g", label: "گرام" },
  { value: "liter", label: "لیتر" },
  { value: "pack", label: "پاکەت" },
  { value: "box", label: "کارتۆن" },
];

type Merchant = {
  id: string;
  business_name: string;
  merchant_type: Enums<"app_role">;
  address: string | null;
  description: string | null;
  approval_status: Enums<"record_status">;
};

type Product = {
  id: string;
  merchant_id: string | null;
  is_shakh_store: boolean;
  title: string;
  description: string | null;
  price_iqd: number;
  cost_price_iqd: number | null;
  stock_quantity: number | null;
  unit: string;
  category_key: string;
  image_path: string | null;
  is_available: boolean;
  created_at: string;
};

const emptyProduct = {
  title: "",
  description: "",
  price: "",
  costPrice: "",
  stock: "",
  unit: "piece",
  category: "general",
};

function formatIQD(value: number) {
  return value.toLocaleString("en-US") + " د.ع";
}

export default function StorePage() {
  const [role, setRole] = useState("");
  const [walletBalance, setWalletBalance] = useState(0);
  const [merchant, setMerchant] = useState<Merchant | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [business, setBusiness] = useState("");
  const [applicationType, setApplicationType] = useState<Enums<"app_role">>("restaurant");
  const [address, setAddress] = useState("");
  const [form, setForm] = useState(emptyProduct);
  const [image, setImage] = useState<File | null>(null);
  const [editing, setEditing] = useState<Product | null>(null);
  const [search, setSearch] = useState("");
  const [availabilityFilter, setAvailabilityFilter] = useState<"all" | "available" | "unavailable">("all");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const isAdmin = role === "super_admin";
  const categories = categorySets[role] || categorySets.super_admin;
  const formCategories = categories.some((item) => item.value === form.category)
    ? categories
    : [...categories, { value: form.category, label: form.category }];

  async function load() {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { window.location.href = "/login"; return; }

    const { data: profile, error: profileError } = await supabase
      .from("profiles").select("role").eq("id", user.id).single();
    if (profileError) throw profileError;

    const currentRole = profile.role || "customer";
    setRole(currentRole);
    if (currentRole !== "super_admin") {
      const { data: wallet } = await supabase.from("wallets").select("balance_iqd").eq("user_id", user.id).maybeSingle();
      setWalletBalance(wallet?.balance_iqd || 0);
    }

    if (currentRole === "super_admin") {
      setMerchant(null);
    } else {
      const { data: merchantData, error: merchantError } = await supabase
        .from("merchant_profiles")
        .select("id,business_name,merchant_type,address,description,approval_status")
        .eq("user_id", user.id).maybeSingle();
      if (merchantError) throw merchantError;
      setMerchant(merchantData);
      if (merchantData?.approval_status !== "approved" || merchantData.merchant_type !== currentRole) {
        setProducts([]);
        setLoading(false);
        return;
      }
    }

    let query = supabase.from("products")
      .select("id,merchant_id,is_shakh_store,title,description,price_iqd,cost_price_iqd,stock_quantity,unit,category_key,image_path,is_available,created_at")
      .order("created_at", { ascending: false });

    if (currentRole === "super_admin") query = query.eq("is_shakh_store", true);
    else if (merchant?.id) query = query.eq("merchant_id", merchant.id);
    else {
      const { data: ownerMerchant } = await supabase.from("merchant_profiles")
        .select("id,merchant_type,approval_status").eq("user_id", user.id).maybeSingle();
      if (!ownerMerchant || ownerMerchant.approval_status !== "approved" || ownerMerchant.merchant_type !== currentRole) {
        setProducts([]);
        setLoading(false);
        return;
      }
      query = query.eq("merchant_id", ownerMerchant.id);
    }

    const { data, error } = await query;
    if (error) throw error;
    setProducts(data || []);
    setLoading(false);
  }

  useEffect(() => {
    load().catch(() => { setMessage("نەتوانرا بەشی فرۆشگا باربکرێت."); setLoading(false); });
  }, []);

  const filteredProducts = useMemo(() => products.filter((product) => {
    const matchesSearch = (product.title + " " + (product.description || "")).toLowerCase().includes(search.toLowerCase());
    const matchesAvailability = availabilityFilter === "all"
      || (availabilityFilter === "available" && product.is_available && product.stock_quantity !== 0)
      || (availabilityFilter === "unavailable" && (!product.is_available || product.stock_quantity === 0));
    return matchesSearch && matchesAvailability;
  }), [products, search, availabilityFilter]);

  function resetProductForm() {
    setEditing(null);
    setForm({ ...emptyProduct, category: categories[0]?.value || "general" });
    setImage(null);
  }

  function startEditing(product: Product) {
    setEditing(product);
    setForm({
      title: product.title,
      description: product.description || "",
      price: String(product.price_iqd),
      costPrice: product.cost_price_iqd === null ? "" : String(product.cost_price_iqd),
      stock: product.stock_quantity === null ? "" : String(product.stock_quantity),
      unit: product.unit,
      category: product.category_key,
    });
    setImage(null);
    setMessage("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function applyForStore(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    try {
      const { error } = await createClient().rpc("request_merchant_account", {
        p_business_name: business.trim(),
        p_merchant_type: applicationType,
        p_address: address.trim(),
      });
      if (error) throw error;
      setMessage("داواکاری دوکان نێردرا. دوای پەسەندکردنی سوپەر ئەدمین دەتوانیت کاڵا زیاد بکەیت.");
      setBusiness("");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "ناردنی داواکاری دوکان سەرکەوتوو نەبوو.");
    } finally {
      setSaving(false);
    }
  }

  async function saveProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const price = Number(form.price);
    const stock = form.stock.trim() === "" ? null : Number(form.stock);
    if (!Number.isSafeInteger(price) || price <= 0) {
      setMessage("نرخ دەبێت ژمارەیەکی تەواوی زیاتر لە سفر بێت.");
      return;
    }
    const costPrice = form.costPrice.trim() === "" ? null : Number(form.costPrice);
    if (isAdmin && (costPrice === null || !Number.isSafeInteger(costPrice) || costPrice < 0)) {
      setMessage("نرخی کڕین دەبێت ژمارەیەکی تەواوی سفر یان زیاتر بێت.");
      return;
    }
    if (stock !== null && (!Number.isFinite(stock) || stock < 0 || stock > 100000000)) {
      setMessage("بڕی کۆگا نابێت ژمارەیەکی نەرێنی یان نادروست بێت.");
      return;
    }
    if (image && (!["image/jpeg", "image/png", "image/webp"].includes(image.type) || image.size > 5 * 1024 * 1024)) {
      setMessage("وێنە دەبێت JPG یان PNG یان WebP بێت و قەبارەکەی زیاتر نەبێت لە ٥MB.");
      return;
    }

    setSaving(true);
    setMessage("");
    const supabase = createClient();
    let uploadedPath: string | null = null;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("تکایە دووبارە بچۆ ژوورەوە.");

      if (image) {
        const extension = image.type === "image/png" ? "png" : image.type === "image/webp" ? "webp" : "jpg";
        uploadedPath = `${user.id}/${crypto.randomUUID()}.${extension}`;
        const { error: uploadError } = await supabase.storage.from("product-images").upload(uploadedPath, image, {
          contentType: image.type,
          upsert: false,
        });
        if (uploadError) throw uploadError;
      }

      const payload = {
        title: form.title.trim(),
        description: form.description.trim() || null,
        price_iqd: price,
        ...(isAdmin ? { cost_price_iqd: costPrice } : {}),
        stock_quantity: stock,
        unit: form.unit,
        category_key: form.category,
        ...(uploadedPath ? { image_path: uploadedPath } : {}),
      };

      const result = editing
        ? await supabase.from("products").update(payload).eq("id", editing.id)
        : await supabase.from("products").insert({
            ...payload,
            merchant_id: isAdmin ? null : merchant?.id,
            is_shakh_store: isAdmin,
            is_available: true,
          });

      if (result.error) throw result.error;

      if (uploadedPath && editing?.image_path) {
        await supabase.storage.from("product-images").remove([editing.image_path]);
      }

      setMessage(editing ? "کاڵاکە بە سەرکەوتوویی نوێکرایەوە." : "کاڵای نوێ زیاد کرا.");
      resetProductForm();
      await load();
    } catch (error) {
      if (uploadedPath) await supabase.storage.from("product-images").remove([uploadedPath]);
      setMessage(error instanceof Error ? error.message : "پاشەکەوتکردنی کاڵا سەرکەوتوو نەبوو.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleAvailability(product: Product) {
    setSaving(true);
    const { error } = await createClient().from("products")
      .update({ is_available: !product.is_available })
      .eq("id", product.id);
    setMessage(error?.message || (product.is_available ? "کاڵا ناچالاک کرا." : "کاڵا بەردەست کرا."));
    setSaving(false);
    if (!error) await load();
  }

  async function removeProduct(product: Product) {
    if (!window.confirm(`دڵنیایت لە سڕینەوەی «${product.title}»؟`)) return;
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase.from("products").delete().eq("id", product.id);
    if (error) {
      setMessage(error.message);
    } else {
      if (product.image_path) await supabase.storage.from("product-images").remove([product.image_path]);
      setMessage("کاڵا سڕایەوە.");
      if (editing?.id === product.id) resetProductForm();
      await load();
    }
    setSaving(false);
  }

  const availableCount = products.filter((product) => product.is_available && product.stock_quantity !== 0).length;
  const lowStockCount = products.filter((product) => product.stock_quantity !== null && product.stock_quantity > 0 && product.stock_quantity <= 5).length;

  return (
    <main className="min-h-screen px-4 py-8">
      <div className="mx-auto max-w-6xl">
        <Link href="/dashboard" className="font-bold text-shakh-blue">← داشبۆرد</Link>

        <header className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-bold text-shakh-orange">{isAdmin ? "SHAKH STORE" : merchant ? roleNames[merchant.merchant_type] : "بەڕێوەبردنی دوکان"}</p>
            <h1 className="mt-1 text-3xl font-black">{isAdmin ? "بەڕێوەبردنی شاخ ستۆر" : merchant?.business_name || "بەشی فرۆشگاکەت"}</h1>
            <p className="mt-2 text-sm text-slate-500">کاڵا، نرخ، کۆگا، وێنە و بەردەستبوون بەڕێوەببە.</p>
          </div>
          {(isAdmin || merchant?.approval_status === "approved") && (
            <span className="rounded-full bg-green-50 px-4 py-2 text-sm font-bold text-green-700">دوکان چالاکە</span>
          )}
        </header>

        {message && <p role="status" className="mt-5 rounded-xl bg-blue-50 p-4 text-sm text-blue-800">{message}</p>}
        {!isAdmin && merchant?.approval_status === "approved" && walletBalance <= 0 && <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">بۆ پۆستکردن یان دەستکاریکردنی کاڵا، جزدانەکەت نابێت بەتاڵ بێت. باڵانسی ئێستا: {walletBalance.toLocaleString("en-US")} د.ع. <Link href="/dashboard/wallet" className="font-black underline">پڕکردنەوەی جزدان</Link></div>}

        {role === "customer" && !merchant && (
          <section className="mt-6 rounded-2xl bg-white p-6 shadow-soft">
            <h2 className="text-xl font-black">داواکاری کردن بۆ کردنەوەی دوکان</h2>
            <p className="mt-2 text-sm text-slate-500">جۆری دوکانەکەت هەڵبژێرە. دوای پەسەندکردنی سوپەر ئەدمین، بەشی بەڕێوەبردنی کاڵاکانت بۆ دەکرێتەوە.</p>
            <form onSubmit={applyForStore} className="mt-5 space-y-3">
              <input required maxLength={120} value={business} onChange={(event) => setBusiness(event.target.value)} placeholder="ناوی دوکان" className="w-full rounded-xl border border-slate-200 p-3"/>
              <select value={applicationType} onChange={(event) => setApplicationType(event.target.value as Enums<"app_role">)} className="w-full rounded-xl border border-slate-200 p-3">
                {merchantTypes.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
              </select>
              <input value={address} onChange={(event) => setAddress(event.target.value)} placeholder="ناونیشانی دوکان" className="w-full rounded-xl border border-slate-200 p-3"/>
              <button disabled={saving || !business.trim()} className="rounded-xl bg-shakh-orange px-5 py-3 font-bold text-white disabled:opacity-50">{saving ? "تکایە چاوەڕێ بکە..." : "ناردنی داواکاری دوکان"}</button>
            </form>
          </section>
        )}

        {merchant?.approval_status === "pending" && <p className="mt-6 rounded-xl bg-amber-50 p-5 text-amber-800">داواکاری دوکانەکەت لە چاوەڕوانی پەسەندکردنی سوپەر ئەدمین دایە.</p>}
        {merchant?.approval_status === "rejected" && <p className="mt-6 rounded-xl bg-red-50 p-5 text-red-700">داواکاری دوکانەکەت ڕەتکرایەوە. بۆ زانیاری زیاتر پەیوەندی بە بەڕێوەبەرەوە بکە.</p>}

        {(isAdmin || merchant?.approval_status === "approved") && (
          <>
            <section className="mt-6 grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl bg-white p-5 shadow-soft"><p className="text-sm text-slate-500">کۆی کاڵاکان</p><b className="mt-1 block text-2xl">{products.length}</b></div>
              <div className="rounded-2xl bg-white p-5 shadow-soft"><p className="text-sm text-slate-500">کاڵای بەردەست</p><b className="mt-1 block text-2xl text-green-700">{availableCount}</b></div>
              <div className="rounded-2xl bg-white p-5 shadow-soft"><p className="text-sm text-slate-500">کاڵای کۆگای کەم (٥ یان کەمتر)</p><b className="mt-1 block text-2xl text-orange-600">{lowStockCount}</b></div>
            </section>

            <section id="product-form" className="mt-6 rounded-2xl bg-white p-6 shadow-soft">
              <div className="flex items-center gap-2">
                {editing ? <Pencil className="text-shakh-orange"/> : <PackagePlus className="text-shakh-orange"/>}
                <h2 className="text-xl font-black">{editing ? "دەستکاریکردنی کاڵا" : isAdmin ? "زیادکردن بۆ شاخ ستۆر" : "زیادکردنی کاڵای نوێ"}</h2>
              </div>
              <form onSubmit={saveProduct} className="mt-5 space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="block text-sm font-bold">ناوی کاڵا
                    <input required maxLength={180} value={form.title} onChange={(event) => setForm((old) => ({ ...old, title: event.target.value }))} placeholder="ناوی کاڵا" className="mt-2 w-full rounded-xl border border-slate-200 p-3"/>
                  </label>
                  <label className="block text-sm font-bold">بەشی کاڵا
                    <select value={form.category} onChange={(event) => setForm((old) => ({ ...old, category: event.target.value }))} className="mt-2 w-full rounded-xl border border-slate-200 p-3">
                      {formCategories.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                    </select>
                  </label>
                </div>
                <label className="block text-sm font-bold">وردەکاری کاڵا
                  <textarea maxLength={1000} rows={3} value={form.description} onChange={(event) => setForm((old) => ({ ...old, description: event.target.value }))} placeholder="پێناسە و زانیاریی کاڵا..." className="mt-2 w-full rounded-xl border border-slate-200 p-3"/>
                </label>
                <div className={`grid gap-4 ${isAdmin ? "md:grid-cols-4" : "md:grid-cols-3"}`}>
                  {isAdmin && <label className="block text-sm font-bold">نرخی کڕین (د.ع)
                    <input required type="number" min="0" step="1" value={form.costPrice} onChange={(event) => setForm((old) => ({ ...old, costPrice: event.target.value }))} placeholder="نرخی کڕین" className="mt-2 w-full rounded-xl border border-slate-200 p-3"/>
                  </label>}
                  <label className="block text-sm font-bold">نرخ بە دیناری عێراقی
                    <input required type="number" min="1" step="1" value={form.price} onChange={(event) => setForm((old) => ({ ...old, price: event.target.value }))} placeholder="١٠٠٠" className="mt-2 w-full rounded-xl border border-slate-200 p-3"/>
                  </label>
                  <label className="block text-sm font-bold">یەکەی فرۆشتن
                    <select value={form.unit} onChange={(event) => setForm((old) => ({ ...old, unit: event.target.value }))} className="mt-2 w-full rounded-xl border border-slate-200 p-3">
                      {units.map((unit) => <option key={unit.value} value={unit.value}>{unit.label}</option>)}
                    </select>
                  </label>
                  <label className="block text-sm font-bold">بڕی کۆگا (بەتاڵ = بێ سنوور)
                    <input type="number" min="0" step="0.001" value={form.stock} onChange={(event) => setForm((old) => ({ ...old, stock: event.target.value }))} placeholder="بۆ نموونە: ٢٥" className="mt-2 w-full rounded-xl border border-slate-200 p-3"/>
                  </label>
                </div>
                <label className="block text-sm font-bold">
                  <span className="flex items-center gap-2"><ImagePlus size={18}/> وێنەی کاڵا (JPG، PNG یان WebP، تا ٥MB)</span>
                  <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => setImage(event.target.files?.[0] || null)} className="mt-2 w-full rounded-xl border border-slate-200 p-3 text-sm"/>
                  {editing?.image_path && !image && <small className="mt-1 block text-slate-500">وێنەی ئێستا دەمێنێتەوە؛ بۆ گۆڕینی، وێنەی نوێ هەڵبژێرە.</small>}
                </label>
                <div className="flex flex-wrap gap-2">
                  <button disabled={saving || !form.title.trim() || !form.price || (!isAdmin && walletBalance <= 0)} className="inline-flex items-center gap-2 rounded-xl bg-shakh-orange px-5 py-3 font-bold text-white disabled:opacity-50">
                    <Save size={17}/>{saving ? "پاشەکەوت دەکرێت..." : editing ? "پاشەکەوتکردنی گۆڕانکاری" : "زیادکردنی کاڵا"}
                  </button>
                  {editing && <button type="button" onClick={resetProductForm} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-5 py-3 font-bold text-slate-700"><X size={17}/> هەڵوەشاندنەوە</button>}
                </div>
              </form>
            </section>

            <section className="mt-8">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div><h2 className="text-xl font-black">کاڵاکان ({products.length})</h2><p className="mt-1 text-sm text-slate-500">نرخ و کۆگا و بەردەستبوون لێرە بەڕێوەببە.</p></div>
                <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="گەڕان بە ناوی کاڵا..." className="w-full max-w-xs rounded-xl border border-slate-200 bg-white p-3"/>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {([{value:"all",label:"هەموو"},{value:"available",label:"بەردەست"},{value:"unavailable",label:"ناچالاک / تەواوبوو"}] as const).map((filter) => (
                  <button key={filter.value} onClick={() => setAvailabilityFilter(filter.value)} className={`rounded-full px-4 py-2 text-sm font-bold ${availabilityFilter === filter.value ? "bg-shakh-blue text-white" : "bg-white text-slate-600"}`}>{filter.label}</button>
                ))}
              </div>

              {loading ? <p className="mt-5 text-slate-500">بارکردن...</p> : filteredProducts.length === 0 ? (
                <div className="mt-5 rounded-2xl bg-white p-8 text-center text-slate-500">{products.length === 0 ? "هێشتا هیچ کاڵایەک زیاد نەکراوە." : "هیچ کاڵایەک لەگەڵ ئەم گەڕانەدا نەدۆزرایەوە."}</div>
              ) : (
                <div className="mt-5 grid gap-4 sm:grid-cols-2">
                  {filteredProducts.map((product) => {
                    const publicImage = product.image_path
                      ? createClient().storage.from("product-images").getPublicUrl(product.image_path).data.publicUrl
                      : null;
                    const outOfStock = product.stock_quantity === 0;
                    return (
                      <article key={product.id} className="overflow-hidden rounded-2xl bg-white shadow-soft">
                        <div className="flex gap-4 p-4">
                          <div className="grid h-24 w-24 shrink-0 place-items-center overflow-hidden rounded-xl bg-shakh-mist text-shakh-blue">
                            {publicImage ? <img src={publicImage} alt={product.title} className="h-full w-full object-cover"/> : <Store size={30}/>}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="font-black">{product.title}</h3>
                              <span className={`rounded-full px-2 py-1 text-[11px] font-bold ${product.is_available && !outOfStock ? "bg-green-50 text-green-700" : "bg-slate-100 text-slate-500"}`}>{outOfStock ? "کۆگا تەواو بووە" : product.is_available ? "بەردەست" : "ناچالاک"}</span>
                            </div>
                            {isAdmin && <p className="mt-1 text-xs font-semibold text-slate-500">نرخی کڕین: {product.cost_price_iqd === null ? "تۆمار نەکراوە" : formatIQD(product.cost_price_iqd)} · قازانجی هەر دانە: {product.cost_price_iqd === null ? "—" : formatIQD(product.price_iqd - product.cost_price_iqd)}</p>}
                            <p className="mt-1 text-lg font-black text-shakh-orange">{formatIQD(product.price_iqd)} <small className="text-xs font-medium text-slate-500">/ {units.find((unit) => unit.value === product.unit)?.label || product.unit}</small></p>
                            <p className="mt-1 text-sm text-slate-500">کۆگا: {product.stock_quantity === null ? "بێ سنوور" : product.stock_quantity.toLocaleString("en-US") + " " + (units.find((unit) => unit.value === product.unit)?.label || product.unit)}</p>
                            {product.description && <p className="mt-1 line-clamp-2 text-xs text-slate-500">{product.description}</p>}
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2 border-t border-slate-100 p-3">
                          <button disabled={saving} onClick={() => startEditing(product)} className="inline-flex items-center gap-1 rounded-lg bg-blue-50 px-3 py-2 text-sm font-bold text-blue-700 disabled:opacity-50"><Pencil size={15}/> دەستکاری</button>
                          <button disabled={saving} onClick={() => void toggleAvailability(product)} className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-3 py-2 text-sm font-bold text-slate-700 disabled:opacity-50">{product.is_available ? <EyeOff size={15}/> : <Eye size={15}/>} {product.is_available ? "ناچالاککردن" : "بەردەستکردن"}</button>
                          <button disabled={saving} onClick={() => void removeProduct(product)} className="inline-flex items-center gap-1 rounded-lg bg-red-50 px-3 py-2 text-sm font-bold text-red-700 disabled:opacity-50"><Trash2 size={15}/> سڕینەوە</button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </section>
          </>
        )}

        {role && !isAdmin && !merchant && role !== "customer" && (
          <section className="mt-6 rounded-2xl bg-white p-6 text-slate-600 shadow-soft">
            ئەم هەژمارە بەشی دوکان نییە. تەنها دوکانداری پەسەندکراو یان سوپەر ئەدمین دەتوانێت کاڵا بەڕێوەببات.
          </section>
        )}
      </div>
    </main>
  );
}
