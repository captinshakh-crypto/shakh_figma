"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ShoppingCart, Store, Search, Package, SlidersHorizontal } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Product = {
  id: string;
  title: string;
  description: string | null;
  price_iqd: number;
  category_key: string;
  merchant_id: string | null;
  is_shakh_store: boolean;
  image_path: string | null;
  stock_quantity: number | null;
  unit: string;
};

type Merchant = { id: string; business_name: string; merchant_type: string };
type CartItem = { product_id: string; title: string; price_iqd: number; merchant_id: string | null; quantity: number; unit?: string; referral_campaign_id?: string | null };

const storeTypes = [
  { value: "all", label: "هەموو دوکانەکان" },
  { value: "supermarket", label: "سوپەرمارکێت" },
  { value: "restaurant", label: "چێشتخانە" },
  { value: "butcher_poultry", label: "گۆشت و سپیاتی" },
  { value: "grocery", label: "بەقالی" },
  { value: "shakh_store", label: "شاخ ستۆر" },
];

const typeLabels: Record<string, string> = Object.fromEntries(storeTypes.map((item) => [item.value, item.label]));
const unitLabels: Record<string, string> = { piece: "دانە", kg: "کیلۆگرام", g: "گرام", liter: "لیتر", pack: "پاکەت", box: "کارتۆن" };
const categoryLabels: Record<string, string> = {
  groceries: "خۆراک و پێداویستی ماڵ", dairy: "شیرەمەنی", beverages: "خواردنەوە", cleaning: "پاککەرەوە",
  personal_care: "چاودێری کەسی", frozen: "بەرهەمی ساردکراو", meals: "خواردنی سەرەکی", breakfast: "نانی بەیانی",
  sides: "پاڵاوتە و لاوەکی", drinks: "خواردنەوە", desserts: "شیرینی", beef: "گۆشتی مانگا",
  lamb: "گۆشتی مەڕ", chicken: "گۆشتی مریشک", poultry: "باڵندە", spices: "سپیاتی و بەهارات",
  staples: "پێداویستی بنەڕەتی", snacks: "خواردنی سووک", household: "پێداویستی ماڵ", tomatoes: "تەماتە", cucumbers: "خیار", vegetables: "سەوزەوات", fruits: "میوە", leafy_greens: "سەوزەی گەڵادار", herbs: "سەوزە و گیا بەهاراتییەکان",
  general: "گشتی", electronics: "ئەلیکترۆنیات", accessories: "ئاکسسوارات", other: "هی تر",
};

export default function ShopPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [cartCount, setCartCount] = useState(0);
  const [search, setSearch] = useState("");
  const [storeType, setStoreType] = useState("all");
  const [category, setCategory] = useState("all");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [referralCampaignId, setReferralCampaignId] = useState("");

  useEffect(() => {
    const supabase = createClient();
    let active = true;
    const urlReferral = new URLSearchParams(window.location.search).get("ref");
    const savedReferral = urlReferral || localStorage.getItem("shakh-referral-campaign") || "";
    if (urlReferral) localStorage.setItem("shakh-referral-campaign", urlReferral);
    setReferralCampaignId(savedReferral);
    Promise.all([
      supabase.from("products")
        .select("id,title,description,price_iqd,category_key,merchant_id,is_shakh_store,image_path,stock_quantity,unit")
        .eq("is_available", true).order("created_at", { ascending: false }),
      supabase.from("merchant_profiles")
        .select("id,business_name,merchant_type").eq("approval_status", "approved"),
    ]).then(([productResult, merchantResult]) => {
      if (!active) return;
      if (productResult.error || merchantResult.error) setMessage("نەتوانرا زانیاری بازاڕ باربکرێن.");
      setProducts(productResult.data || []);
      setMerchants(merchantResult.data || []);
      setLoading(false);
    }).catch(() => {
      if (active) { setMessage("نەتوانرا بازاڕ باربکرێت."); setLoading(false); }
    });

    try {
      const cart = JSON.parse(localStorage.getItem("shakh-cart") || "[]") as CartItem[];
      setCartCount(cart.reduce((total, item) => total + item.quantity, 0));
    } catch { setCartCount(0); }

    return () => { active = false; };
  }, []);

  const merchantMap = useMemo(
    () => Object.fromEntries(merchants.map((merchant) => [merchant.id, merchant])) as Record<string, Merchant>,
    [merchants]
  );

  const typeForProduct = (product: Product) =>
    product.is_shakh_store ? "shakh_store" : merchantMap[product.merchant_id || ""]?.merchant_type || "all";

  const categories = useMemo(() => {
    const keys = [...new Set(products
      .filter((product) => storeType === "all" || typeForProduct(product) === storeType)
      .map((product) => product.category_key))];
    return keys.sort();
  }, [products, storeType, merchantMap]);

  const filtered = useMemo(() => products.filter((product) => {
    const merchant = product.merchant_id ? merchantMap[product.merchant_id] : null;
    const storeName = product.is_shakh_store ? "SHAKH Store شاخ ستۆر" : merchant?.business_name || "";
    const matchesSearch = (product.title + " " + (product.description || "") + " " + storeName)
      .toLowerCase().includes(search.toLowerCase());
    const matchesType = storeType === "all" || typeForProduct(product) === storeType;
    const matchesCategory = category === "all" || product.category_key === category;
    return matchesSearch && matchesType && matchesCategory;
  }), [products, merchants, search, storeType, category]);

  function add(product: Product) {
    if (product.stock_quantity === 0) {
      setMessage("ئەم کاڵایە لە ئێستادا لە کۆگا نەماوە.");
      return;
    }
    try {
      const cart = JSON.parse(localStorage.getItem("shakh-cart") || "[]") as CartItem[];
      const activeReferral = referralCampaignId || cart.find((item) => item.referral_campaign_id)?.referral_campaign_id || null;
      const otherReferral = cart.find((item) => item.referral_campaign_id && item.referral_campaign_id !== activeReferral);
      if (otherReferral) { setMessage("سەبەتەکەت بە لینکی شێر و خەڵاتێکی ترە؛ تکایە یەک لینک بەکاربهێنە."); return; }
      const existing = cart.find((item) => item.product_id === product.id);
      if (existing) { existing.quantity += 1; if (activeReferral) existing.referral_campaign_id = activeReferral; }
      else cart.push({
        product_id: product.id,
        title: product.title,
        price_iqd: product.price_iqd,
        merchant_id: product.merchant_id,
        quantity: 1,
        unit: product.unit,
        referral_campaign_id: activeReferral,
      });
      localStorage.setItem("shakh-cart", JSON.stringify(cart));
      setCartCount(cart.reduce((total, item) => total + item.quantity, 0));
      setMessage("کاڵا زیاد کرا بۆ سەبەتە.");
    } catch {
      setMessage("نەتوانرا کاڵا زیاد بکرێت بۆ سەبەتە.");
    }
  }

  return (
    <main className="min-h-screen px-4 py-8">
      <div className="mx-auto max-w-7xl">
        <header className="flex items-center justify-between">
          <Link href="/" className="text-2xl font-black text-shakh-orange">SHAKH</Link>
          <Link href="/cart" className="flex items-center gap-2 rounded-xl bg-shakh-orange px-4 py-2 font-bold text-white">
            <ShoppingCart size={18}/> سەبەتە ({cartCount})
          </Link>
        </header>

        {referralCampaignId && <p className="mt-5 rounded-xl bg-purple-50 p-3 text-sm font-bold text-purple-800">لینکی شێر و خەڵات چالاکە؛ ئەگەر لەم لینکەوە بکڕیت، خەڵاتی دیاریکراوی کاڵا بۆ خاوەن لینک تۆمار دەکرێت.</p>}
        <div className="mt-8 flex flex-wrap items-end justify-between gap-4">
          <div><p className="font-bold text-shakh-orange">بازاڕی شاخ</p><h1 className="mt-2 text-3xl font-black">کاڵاکان و فرۆشگاکان</h1></div>
          <label className="flex w-full max-w-sm items-center gap-2 rounded-xl border bg-white px-3">
            <Search size={18} className="text-slate-400"/>
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="گەڕان بە ناوی کاڵا یان دوکان..." className="w-full bg-transparent p-3 outline-none"/>
          </label>
        </div>

        <section className="mt-6 rounded-2xl bg-white p-4 shadow-soft">
          <div className="flex items-center gap-2 text-sm font-bold text-slate-500"><SlidersHorizontal size={16}/> جۆری دوکان</div>
          <div className="mt-3 flex flex-wrap gap-2">
            {storeTypes.map((type) => (
              <button key={type.value} onClick={() => { setStoreType(type.value); setCategory("all"); }}
                className={`rounded-full px-4 py-2 text-sm font-bold transition ${storeType === type.value ? "bg-shakh-blue text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}>
                {type.label}
              </button>
            ))}
          </div>
          <div className="mt-3">
            <select aria-label="بەشی کاڵا" value={category} onChange={(event) => setCategory(event.target.value)} className="w-full max-w-xs rounded-xl border border-slate-200 p-3 text-sm">
              <option value="all">هەموو بەشەکانی کاڵا</option>
              {categories.map((key) => <option key={key} value={key}>{categoryLabels[key] || key}</option>)}
            </select>
          </div>
        </section>

        {message && <p role="status" className="mt-4 rounded-xl bg-blue-50 p-3 text-sm text-blue-800">{message}</p>}
        {loading ? <p className="mt-8">بارکردن...</p> : filtered.length === 0 ? (
          <div className="mt-8 rounded-2xl bg-white p-10 text-center text-slate-500">
            <Package size={32} className="mx-auto mb-3 text-slate-300"/>
            هیچ کاڵایەکی گونجاو لەگەڵ ئەم هەڵبژاردنە نەدۆزرایەوە.
          </div>
        ) : (
          <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {filtered.map((product) => {
              const merchant = product.merchant_id ? merchantMap[product.merchant_id] : null;
              const storeName = product.is_shakh_store ? "شاخ ستۆر" : merchant?.business_name || "فرۆشگا";
              const storeLabel = product.is_shakh_store ? "شاخ ستۆر" : typeLabels[merchant?.merchant_type || ""] || "فرۆشیار";
              const imageUrl = product.image_path
                ? createClient().storage.from("product-images").getPublicUrl(product.image_path).data.publicUrl
                : null;
              const outOfStock = product.stock_quantity === 0;

              return (
                <article key={product.id} className="overflow-hidden rounded-2xl bg-white shadow-soft">
                  <div className="grid aspect-[4/3] place-items-center overflow-hidden bg-shakh-mist text-shakh-blue">
                    {imageUrl ? <img src={imageUrl} alt={product.title} loading="lazy" className="h-full w-full object-cover"/> : <Store size={36}/>}
                  </div>
                  <div className="p-4">
                    <div className="flex flex-wrap items-center justify-between gap-1">
                      <span className="text-xs font-bold text-shakh-orange">{storeLabel}</span>
                      <span className="text-[11px] text-slate-400">{categoryLabels[product.category_key] || product.category_key}</span>
                    </div>
                    <p className="mt-1 truncate text-xs text-slate-500">{storeName}</p>
                    <h2 className="mt-1 font-bold">{product.title}</h2>
                    {product.description && <p className="mt-1 line-clamp-2 text-xs text-slate-500">{product.description}</p>}
                    <p className="mt-3 font-black text-shakh-orange">{product.price_iqd.toLocaleString("en-US")} د.ع <small className="font-medium text-slate-500">/ {unitLabels[product.unit] || product.unit}</small></p>
                    <p className={`mt-1 text-xs ${outOfStock ? "text-red-600" : "text-green-700"}`}>
                      {outOfStock ? "کۆگا تەواو بووە" : product.stock_quantity === null ? "بەردەست" : `ماوە: ${product.stock_quantity.toLocaleString("en-US")} ${unitLabels[product.unit] || product.unit}`}
                    </p>
                    <button disabled={outOfStock} onClick={() => add(product)} className="mt-4 w-full rounded-xl bg-shakh-blue px-3 py-2 text-sm font-bold text-white disabled:cursor-not-allowed disabled:bg-slate-300">
                      {outOfStock ? "لە کۆگا نەماوە" : "زیادکردن بۆ سەبەتە"}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
