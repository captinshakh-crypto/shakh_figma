"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ShoppingCart, ShoppingBasket, Store, Search, Package, SlidersHorizontal, Share2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import ShakhBrand from "@/components/shakh-brand";
import { Headset } from "lucide-react";

type ProductVariant = {
  id: string;
  product_id: string;
  variant_label: string;
  image_path: string | null;
  price_iqd: number;
};
type ProductCategory = { id: string; store_type: string; category_key: string; name: string; is_active: boolean };
type ProductSubcategory = { id: string; category_id: string; subcategory_key: string; name: string; is_active: boolean };
type Product = {
  id: string;
  title: string;
  description: string | null;
  price_iqd: number;
  category_key: string;
  category_id: string | null;
  subcategory_id: string | null;
  merchant_id: string | null;
  is_shakh_store: boolean;
  image_path: string | null;
  referral_commission_iqd: number;
  stock_quantity: number | null;
  unit: string;
  variants: ProductVariant[];
};

type Merchant = { id: string; business_name: string; merchant_type: string; address: string | null };
type CartItem = {
  product_id: string;
  variant_id?: string;
  variant_label?: string;
  variant_image_path?: string | null;
  title: string;
  price_iqd: number;
  merchant_id: string | null;
  quantity: number;
  unit?: string;
  stock_quantity?: number | null;
  referral_campaign_id?: string | null;
};

const storeTypes = [
  { value: "all", label: "هەموو دوکانەکان" },
  { value: "supermarket", label: "سوپەرمارکێت" },
  { value: "restaurant", label: "چێشتخانە" },
  { value: "butcher_poultry", label: "گۆشت و سپیاتی" },
  { value: "grocery", label: "بەقالی" },
  { value: "shakh_store", label: "شاخ ستۆر" },
];

const typeLabels: Record<string, string> = Object.fromEntries(storeTypes.map((item) => [item.value, item.label]));
const unitLabels: Record<string, string> = { piece: "دانە", kg: "کیلۆگرام", g: "گرام", liter: "لیتر", pack: "پاکەت", box: "کارتۆن", portion: "پرس", plate: "قاپ", cup: "پەرداخ", bottle: "بوتڵ", bunch: "دەستە" };
const categoryLabels: Record<string, string> = {
  restaurant: "چێشتخانە", grocery: "بەقالی", butcher_poultry: "گۆشت و سپیاتی", supermarket: "سوپەرمارکێت",
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
  const [catalogCategories, setCatalogCategories] = useState<ProductCategory[]>([]);
  const [catalogSubcategories, setCatalogSubcategories] = useState<ProductSubcategory[]>([]);
  const [variantProduct, setVariantProduct] = useState<Product | null>(null);
  const [selectedVariantId, setSelectedVariantId] = useState("");
  const [variantQuantity, setVariantQuantity] = useState(1);
  const [cartCount, setCartCount] = useState(0);
  const [search, setSearch] = useState("");
  const [searchInitialized, setSearchInitialized] = useState(false);
  const [storeType, setStoreType] = useState("all");
  const [category, setCategory] = useState("all");
  const [subcategory, setSubcategory] = useState("all");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [catalogActionsReady, setCatalogActionsReady] = useState(false);
  const [referralCampaignId, setReferralCampaignId] = useState("");
  const [sharedProductId, setSharedProductId] = useState("");
  const [expandedProductIds, setExpandedProductIds] = useState<string[]>([]);

  useEffect(() => {
    const supabase = createClient();
    let active = true;
    let refreshing = false;
    let refreshAgain = false;
    let hasLoadedDetails = false;
    let refreshTimer: number | null = null;

    const urlParams = new URLSearchParams(window.location.search);
    const urlReferral = urlParams.get("ref");
    setSharedProductId(urlParams.get("product") || "");
    const savedReferral = urlReferral || localStorage.getItem("shakh-referral-campaign") || "";
    if (urlReferral) localStorage.setItem("shakh-referral-campaign", urlReferral);
    setReferralCampaignId(savedReferral);

    const scheduleCatalogRefresh = () => {
      if (refreshTimer !== null) window.clearTimeout(refreshTimer);
      refreshTimer = window.setTimeout(() => {
        refreshTimer = null;
        void refreshCatalog();
      }, 180);
    };

    const refreshCatalog = async () => {
      if (refreshing) {
        refreshAgain = true;
        return;
      }
      refreshing = true;
      try {
        const productResult = await supabase.from("products")
          .select("id,title,description,price_iqd,category_key,category_id,subcategory_id,merchant_id,is_shakh_store,image_path,referral_commission_iqd,stock_quantity,unit")
          .eq("is_available", true)
          .eq("approval_status", "approved")
          .order("created_at", { ascending: false })
          .range(0, 999);

        if (!active) return;
        if (productResult.error) {
          setMessage("نەتوانرا پۆستە بەردەستەکانی بازاڕ باربکرێن. تکایە دووبارە هەوڵ بدە.");
          setLoading(false);
          return;
        }

        const productRows = (productResult.data || []) as Omit<Product, "variants">[];
        setProducts((current) => {
          const variantsByProduct = new Map(current.map((product) => [product.id, product.variants]));
          return productRows.map((product) => ({ ...product, variants: variantsByProduct.get(product.id) || [] }));
        });
        setLoading(false);

        const productIds = productRows.map((product) => product.id);
        const [merchantResult, categoryResult, subcategoryResult, variantResult] = await Promise.all([
          supabase.from("merchant_profiles")
            .select("id,business_name,merchant_type,address").eq("approval_status", "approved"),
          supabase.from("product_categories")
            .select("id,store_type,category_key,name,is_active").eq("is_active", true).order("sort_order").order("name"),
          supabase.from("product_subcategories")
            .select("id,category_id,subcategory_key,name,is_active").eq("is_active", true).order("sort_order").order("name"),
          productIds.length > 0
            ? supabase.from("product_variants")
                .select("id,product_id,variant_label,image_path,price_iqd")
                .in("product_id", productIds).eq("is_active", true).order("sort_order")
            : Promise.resolve({ data: [], error: null }),
        ]);
        if (!active) return;

        if (!merchantResult.error) setMerchants(merchantResult.data || []);
        if (!categoryResult.error) setCatalogCategories((categoryResult.data || []) as ProductCategory[]);
        if (!subcategoryResult.error) setCatalogSubcategories((subcategoryResult.data || []) as ProductSubcategory[]);

        if (variantResult.error) {
          setMessage("هەندێک جۆری کاڵا نەکرا باربکرێت؛ بەڵام پۆستەکان لە بازاڕدا دەردەکەون.");
          if (!hasLoadedDetails) setCatalogActionsReady(false);
        } else {
          const byProduct = new Map<string, ProductVariant[]>();
          for (const variant of (variantResult.data || []) as ProductVariant[]) {
            const group = byProduct.get(variant.product_id) || [];
            group.push(variant);
            byProduct.set(variant.product_id, group);
          }
          setProducts(productRows.map((product) => ({ ...product, variants: byProduct.get(product.id) || [] })));
          setCatalogActionsReady(true);
        }

        if (merchantResult.error || categoryResult.error || subcategoryResult.error) {
          setMessage("کاڵاکان پیشان دراون؛ بەڵام هەندێک زانیاریی کاتەگۆری یان دوکان بارنەکرا.");
        } else if (!variantResult.error) {
          setMessage((current) => current.includes("نەتوانرا پۆست") ? current : "");
        }
        hasLoadedDetails = true;
      } catch {
        if (active) {
          setMessage("پۆستەکان پیشان دراون، بەڵام نوێکردنەوەی وردەکارییەکان سەرکەوتوو نەبوو.");
          setLoading(false);
        }
      } finally {
        refreshing = false;
        if (active && refreshAgain) {
          refreshAgain = false;
          scheduleCatalogRefresh();
        }
      }
    };

    void refreshCatalog();

    try {
      const cart = JSON.parse(localStorage.getItem("shakh-cart") || "[]") as CartItem[];
      setCartCount(cart.reduce((total, item) => total + item.quantity, 0));
    } catch { setCartCount(0); }

    const channel = supabase.channel("shakh-shop-catalog-visibility")
      .on("postgres_changes", { event: "*", schema: "public", table: "products" }, scheduleCatalogRefresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "product_variants" }, scheduleCatalogRefresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "product_categories" }, scheduleCatalogRefresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "product_subcategories" }, scheduleCatalogRefresh)
      .subscribe();

    const refreshOnPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) scheduleCatalogRefresh();
    };
    window.addEventListener("pageshow", refreshOnPageShow);

    return () => {
      active = false;
      if (refreshTimer !== null) window.clearTimeout(refreshTimer);
      window.removeEventListener("pageshow", refreshOnPageShow);
      void supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    setSearch(new URLSearchParams(window.location.search).get("q") || "");
    setSearchInitialized(true);
  }, []);

  useEffect(() => {
    if (!searchInitialized) return;
    const url = new URL(window.location.href);
    if (search.trim()) url.searchParams.set("q", search.trim());
    else url.searchParams.delete("q");
    window.history.replaceState({}, "", url.pathname + url.search + url.hash);
  }, [search, searchInitialized]);

  const merchantMap = useMemo(
    () => Object.fromEntries(merchants.map((merchant) => [merchant.id, merchant])) as Record<string, Merchant>,
    [merchants]
  );

  const typeForProduct = (product: Product) =>
    product.is_shakh_store ? "shakh_store" : merchantMap[product.merchant_id || ""]?.merchant_type || "all";

  const categories = useMemo(
    () => catalogCategories.filter((item) => storeType === "all" || item.store_type === storeType),
    [catalogCategories, storeType]
  );
  const subcategories = useMemo(
    () => category === "all" ? [] : catalogSubcategories.filter((item) => item.category_id === category && item.is_active),
    [catalogSubcategories, category]
  );

  const filtered = useMemo(() => products.filter((product) => {
    const merchant = product.merchant_id ? merchantMap[product.merchant_id] : null;
    const storeName = product.is_shakh_store ? "SHAKH Store شاخ ستۆر" : merchant?.business_name || "";
    const matchesSearch = (product.title + " " + (product.description || "") + " " + storeName + " " + (merchant?.address || ""))
      .toLowerCase().includes(search.toLowerCase());
    const matchesType = storeType === "all" || typeForProduct(product) === storeType;
    const matchesCategory = category === "all" || product.category_id === category;
    const matchesSubcategory = subcategory === "all" || product.subcategory_id === subcategory;
    const matchesSharedProduct = !sharedProductId || product.id === sharedProductId;
    return matchesSearch && matchesType && matchesCategory && matchesSubcategory && matchesSharedProduct;
  }), [products, merchants, search, storeType, category, subcategory, sharedProductId]);

  function addToCart(product: Product, quantity = 1, variant?: ProductVariant) {
    const availableStock = product.stock_quantity;
    if (availableStock === 0 || (availableStock !== null && availableStock !== undefined && quantity > availableStock)) {
      setMessage("ئەو بڕەی هەڵبژێردراو لە کۆگادا بەردەست نییە.");
      return;
    }
    try {
      const cart = JSON.parse(localStorage.getItem("shakh-cart") || "[]") as CartItem[];
      const activeReferral = referralCampaignId || cart.find((item) => item.referral_campaign_id)?.referral_campaign_id || null;
      const otherReferral = cart.find((item) => item.referral_campaign_id && item.referral_campaign_id !== activeReferral);
      if (otherReferral) { setMessage("سەبەتەکەت بە لینکی شێر و خەڵاتێکی ترە؛ تکایە یەک لینک بەکاربهێنە."); return; }
      const sameProductItems = cart.filter((item) => item.product_id === product.id);
      const existing = sameProductItems.find((item) => (item.variant_id || "") === (variant?.id || ""));
      const totalProductQuantity = sameProductItems.reduce((total, item) => total + item.quantity, 0);
      if (availableStock !== null && availableStock !== undefined && totalProductQuantity + quantity > availableStock) {
        setMessage("کۆگای هاوبەشی ئەم کاڵایە بەشی ئەو بڕە نییە؛ هەموو ڕەنگەکان لە یەک کۆگادا هەژمار دەکرێن.");
        return;
      }
      if (existing) {
        const nextQuantity = existing.quantity + quantity;
        existing.quantity = nextQuantity;
        existing.stock_quantity = availableStock;
        if (activeReferral) existing.referral_campaign_id = activeReferral;
      } else {
        cart.push({
          product_id: product.id,
          ...(variant ? {
            variant_id: variant.id,
            variant_label: variant.variant_label,
            variant_image_path: variant.image_path,
          } : {}),
          title: product.title,
          price_iqd: variant?.price_iqd ?? product.price_iqd,
          merchant_id: product.merchant_id,
          quantity,
          unit: product.unit,
          stock_quantity: availableStock,
          referral_campaign_id: activeReferral,
        });
      }
      localStorage.setItem("shakh-cart", JSON.stringify(cart));
      window.dispatchEvent(new Event("shakh:cart-updated"));
      setCartCount(cart.reduce((total, item) => total + item.quantity, 0));
      setMessage(variant ? `جۆری «${variant.variant_label}» زیاد کرا بۆ سەبەتە.` : "کاڵا زیاد کرا بۆ سەبەتە.");
    } catch {
      setMessage("نەتوانرا کاڵا زیاد بکرێت بۆ سەبەتە.");
    }
  }

  function add(product: Product) {
    if (product.variants.length > 0) {
      const firstAvailable = product.variants[0];
      setVariantProduct(product);
      setSelectedVariantId(firstAvailable.id);
      setVariantQuantity(product.unit === "kg" ? 0.5 : 1);
      return;
    }
    addToCart(product);
  }

  const selectedVariant = variantProduct?.variants.find((variant) => variant.id === selectedVariantId) || null;


  function getShopShareUrl(productId?: string) {
    const url = new URL("https://www.daim-post.online/shop");
    if (productId) url.searchParams.set("product", productId);
    if (referralCampaignId) url.searchParams.set("ref", referralCampaignId);
    return url.toString();
  }

  async function copyShareUrl(url: string) {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(url);
      return;
    }
    const field = document.createElement("textarea");
    field.value = url;
    field.setAttribute("readonly", "");
    field.style.position = "fixed";
    field.style.opacity = "0";
    document.body.appendChild(field);
    field.select();
    const copied = document.execCommand("copy");
    field.remove();
    if (!copied) throw new Error("Copy was not available");
  }

  async function shareUrl(url: string, title: string, text: string, successMessage: string) {
    try {
      if (typeof navigator.share === "function") {
        await navigator.share({ title, text, url });
        setMessage(successMessage);
        return;
      }
      await copyShareUrl(url);
      setMessage("بەستەری شێرکردن کۆپی کرا؛ دەتوانیت لە هەر سۆشیال میدیایەک دایبنێیت.");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      try {
        await copyShareUrl(url);
        setMessage("بەستەری شێرکردن کۆپی کرا؛ دەتوانیت لە هەر سۆشیال میدیایەک دایبنێیت.");
      } catch {
        setMessage("شێرکردن سەرکەوتوو نەبوو؛ تکایە دووبارە هەوڵ بدە.");
      }
    }
  }

  function shareProduct(product: Product) {
    const url = getShopShareUrl(product.id);
    const text = product.title + " — " + product.price_iqd.toLocaleString("en-US") +
      " د.ع. ئەم کاڵایە لە شاخ ستۆر ببینە و داوای بکە.";
    void shareUrl(url, product.title + " | SHAKH STORE", text, "لینکی ئەم پۆستە شێر کرا.");
  }

  function shareAllProducts() {
    const url = getShopShareUrl();
    const text = "هەموو " + products.length.toLocaleString("en-US") +
      " کاڵای بەردەست لە شاخ ستۆر ببینە؛ چێشتخانە، سوپەرمارکێت، گۆشت و سپیاتی و بەقالی لە یەک بازاڕدا.";
    void shareUrl(url, "بازاڕی شاخ ستۆر | SHAKH STORE", text, "لینکی هەموو کاڵاکانی بازاڕ شێر کرا.");
  }

  return (
    <main className="min-h-screen px-4 py-8">
      <div className="mx-auto max-w-7xl">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <ShakhBrand size="sm" />
          <div className="flex flex-wrap items-center gap-2">
            <Link href="/support" className="inline-flex items-center gap-2 rounded-xl border border-blue-100 bg-blue-50 px-3 py-2 text-sm font-bold text-[#1769aa] transition hover:bg-blue-100"><Headset size={16}/> پشتگیری</Link>
            <button type="button" onClick={shareAllProducts}
              className="inline-flex items-center gap-2 rounded-xl border border-orange-200 bg-orange-50 px-3 py-2 text-sm font-bold text-orange-800 transition hover:bg-orange-100">
              <Share2 size={17}/> شێرکردنی هەموو کاڵاکان
            </button>
            <Link href="/cart" className="flex items-center gap-2 rounded-xl bg-shakh-orange px-4 py-2 font-bold text-white">
              <ShoppingCart size={18}/> سەبەتە ({cartCount})
            </Link>
          </div>
        </header>
        <p className="mt-3 text-sm leading-6 text-slate-500">هەموو کەس دەتوانێت کاڵاکان ببینێت و بیانخاتە سەبەتە؛ بۆ ناردنی داواکاری، هەژمارێکی بەکارهێنەر پێویستە.</p>

        {referralCampaignId && <p className="mt-5 rounded-xl bg-purple-50 p-3 text-sm font-bold text-purple-800">لینکی شێر و خەڵات چالاکە؛ ئەگەر لەم لینکەوە بکڕیت، خەڵاتی دیاریکراوی کاڵا بۆ خاوەن لینک تۆمار دەکرێت.</p>}
        <div className="mt-8 flex flex-wrap items-end justify-between gap-4">
          <div><p className="font-bold text-shakh-orange">بازاڕی شاخ</p><h1 className="mt-2 text-3xl font-black">کاڵاکان و فرۆشگاکان</h1></div>
          <label className="flex w-full max-w-sm items-center gap-2 rounded-xl border bg-white px-3">
            <Search size={18} className="text-slate-400"/>
            <input aria-label="گەڕان بە ناوی کاڵا یان دوکان" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="گەڕان بە ناوی کاڵا یان دوکان..." className="w-full bg-transparent p-3 outline-none"/>
          </label>
        </div>

        {sharedProductId && <p className="mt-5 rounded-xl border border-purple-100 bg-purple-50 p-3 text-sm font-bold text-purple-900">ئەمە لینکی تایبەتی پۆستی شێرکراوە؛ تەنها ئەم کاڵایە پیشان دەدرێت. خەڵاتی خاوەن لینک دوای گەیاندنی داواکاری زیاد دەبێت.</p>}
        <section className="mt-6 rounded-2xl bg-white p-4 shadow-soft">
          <div className="flex items-center gap-2 text-sm font-bold text-slate-500"><SlidersHorizontal size={16}/> جۆری دوکان</div>
          <div className="mt-3 flex flex-wrap gap-2">
            {storeTypes.map((type) => (
              <button key={type.value} onClick={() => { setStoreType(type.value); setCategory("all"); setSubcategory("all"); }}
                className={`rounded-full px-4 py-2 text-sm font-bold transition ${storeType === type.value ? "bg-shakh-blue text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}>
                {type.label}
              </button>
            ))}
          </div>
          <div className="mt-3">
            <div className="flex flex-wrap gap-3">
              <select aria-label="کاتەگۆری سەرەکی" value={category} onChange={(event) => { setCategory(event.target.value); setSubcategory("all"); }} className="w-full max-w-xs rounded-xl border border-slate-200 p-3 text-sm">
                <option value="all">هەموو بەشەکانی کاڵا</option>
                {categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
              <select aria-label="ژێرکاتەگۆری کاڵا" value={subcategory} onChange={(event) => setSubcategory(event.target.value)} disabled={category === "all" || subcategories.length === 0} className="w-full max-w-xs rounded-xl border border-slate-200 p-3 text-sm disabled:bg-slate-50 disabled:text-slate-400">
                <option value="all">{category === "all" ? "سەرەتا کاتەگۆری هەڵبژێرە" : "هەموو ژێرکاتەگۆرییەکان"}</option>
                {subcategories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
            </div>
          </div>
        </section>

        {message && <p role="status" className="mt-4 rounded-xl bg-blue-50 p-3 text-sm text-blue-800">{message}</p>}

        {variantProduct && (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/50 p-3 sm:items-center" role="presentation" onClick={(event) => { if (event.target === event.currentTarget) setVariantProduct(null); }}>
            <section role="dialog" aria-modal="true" aria-labelledby="variant-dialog-title" className="max-h-[88vh] w-full max-w-xl overflow-y-auto rounded-3xl bg-white p-5 shadow-2xl">
              <div className="flex items-start justify-between gap-3">
                <div><p className="text-xs font-bold text-shakh-orange">هەڵبژاردنی جۆری کاڵا</p><h2 id="variant-dialog-title" className="mt-1 text-xl font-black">{variantProduct.title}</h2></div>
                <button type="button" onClick={() => setVariantProduct(null)} className="rounded-full border p-2" aria-label="داخستن">×</button>
              </div>
              <div className="mt-4 space-y-2">
                {variantProduct.variants.map((variant) => {
                  const isSelected = selectedVariantId === variant.id;
                  const exhausted = variantProduct.stock_quantity === 0;
                  const variantImageUrl = variant.image_path ? createClient().storage.from("product-images").getPublicUrl(variant.image_path).data.publicUrl : null;
                  return (
                    <button key={variant.id} type="button" disabled={exhausted} onClick={() => { setSelectedVariantId(variant.id); setVariantQuantity(variantProduct.unit === "kg" ? 0.5 : 1); }}
                      className={`flex w-full items-center gap-3 rounded-2xl border p-3 text-right transition ${isSelected ? "border-shakh-blue bg-blue-50 ring-1 ring-shakh-blue" : "border-slate-200"} ${exhausted ? "opacity-40" : ""}`}>
                      {variantImageUrl ? <img src={variantImageUrl} alt={variant.variant_label} loading="lazy" className="h-16 w-16 shrink-0 rounded-xl border border-slate-200 bg-white object-contain p-1"/> : <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-300"><Package size={22}/></span>}
                      <span className="min-w-0 flex-1"><b className="block text-sm">{variant.variant_label}</b><span className="mt-1 block text-[11px] text-slate-400">{exhausted ? "لە کۆگا نەماوە" : "بەردەست"}</span></span>
                      <span className="shrink-0 text-sm font-black text-shakh-orange">{variant.price_iqd.toLocaleString("en-US")} د.ع</span>
                      {isSelected && <span className="text-shakh-blue">✓</span>}
                    </button>
                  );
                })}
              </div>
              {selectedVariant && (
                <div className="mt-4 rounded-2xl bg-slate-50 p-4">
                  <div className="flex items-center justify-between gap-3"><b className="text-sm">بڕی داواکراو</b><span className="text-xs text-slate-500">{unitLabels[variantProduct.unit] || variantProduct.unit}</span></div>
                  <div className="mt-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <button type="button" onClick={() => setVariantQuantity((q) => Math.max(variantProduct.unit === "kg" ? 0.5 : 1, Math.round((q - (variantProduct.unit === "kg" ? 0.5 : 1)) * 1000) / 1000))} className="h-10 w-10 rounded-xl border bg-white">−</button>
                      <b className="min-w-10 text-center">{variantQuantity}</b>
                      <button type="button" disabled={variantProduct.stock_quantity !== null && variantQuantity + (variantProduct.unit === "kg" ? 0.5 : 1) > variantProduct.stock_quantity} onClick={() => setVariantQuantity((q) => Math.round((q + (variantProduct.unit === "kg" ? 0.5 : 1)) * 1000) / 1000)} className="h-10 w-10 rounded-xl border bg-white disabled:opacity-40">+</button>
                    </div>
                    <b className="text-lg text-shakh-orange">{Math.round(selectedVariant.price_iqd * variantQuantity).toLocaleString("en-US")} د.ع</b>
                  </div>
                  <button type="button" disabled={variantProduct.stock_quantity === 0 || (variantProduct.stock_quantity !== null && variantQuantity > variantProduct.stock_quantity)}
                    onClick={() => { addToCart(variantProduct, variantQuantity, selectedVariant); setVariantProduct(null); }}
                    className="mt-4 min-h-12 w-full rounded-xl bg-shakh-orange px-4 font-black text-white disabled:opacity-40">زیادکردن بۆ سەبەتە</button>
                </div>
              )}
            </section>
          </div>
        )}
        {loading ? <p className="mt-8">بارکردن...</p> : filtered.length === 0 ? (
          <div className="mt-8 rounded-2xl bg-white p-10 text-center text-slate-500">
            <Package size={32} className="mx-auto mb-3 text-slate-300"/>
            هیچ کاڵایەکی گونجاو لەگەڵ ئەم هەڵبژاردنە نەدۆزرایەوە.
          </div>
        ) : (
          <div className="mt-6 grid grid-cols-2 items-start gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
            {filtered.map((product) => {
              const merchant = product.merchant_id ? merchantMap[product.merchant_id] : null;
              const storeName = product.is_shakh_store ? "شاخ ستۆر" : merchant?.business_name || "فرۆشگا";
              const storeLabel = product.is_shakh_store ? "شاخ ستۆر" : typeLabels[merchant?.merchant_type || ""] || "فرۆشیار";
              const storeAddress = product.is_shakh_store ? "" : merchant?.address?.trim() || "";
              const imageUrl = product.image_path
                ? createClient().storage.from("product-images").getPublicUrl(product.image_path).data.publicUrl
                : null;
              const outOfStock = product.stock_quantity === 0;
              const listedPrice = product.variants.length > 0
                ? Math.min(...product.variants.map((variant) => variant.price_iqd))
                : product.price_iqd;
              const categoryName = catalogCategories.find((item) => item.id === product.category_id)?.name || categoryLabels[product.category_key] || product.category_key;
              const subcategoryName = catalogSubcategories.find((item) => item.id === product.subcategory_id)?.name || "";
              const detailsOpen = expandedProductIds.includes(product.id);

              return (
                <article key={product.id} className="flex flex-col overflow-hidden rounded-2xl bg-white shadow-soft">
                  <div className="relative grid aspect-square w-full shrink-0 place-items-center overflow-hidden bg-shakh-mist text-shakh-blue">
                    {imageUrl ? <img src={imageUrl} alt={product.title} loading="lazy" className="h-full w-full object-contain p-2 sm:p-3"/> : <Store size={36}/>}
                    <button
                      type="button"
                      onClick={() => add(product)}
                      disabled={outOfStock}
                      aria-label={outOfStock ? "ئەم کاڵایە لە کۆگا نەماوە" : "زیادکردن بۆ سەبەتە"}
                      title={outOfStock ? "لە کۆگا نەماوە" : "زیادکردن بۆ سەبەتە"}
                      className="absolute right-3 top-3 z-10 grid h-10 w-10 place-items-center rounded-full bg-shakh-blue text-white shadow-lg ring-2 ring-white/90 transition hover:scale-105 hover:bg-blue-800 disabled:cursor-not-allowed disabled:bg-slate-400 disabled:opacity-75"
                    >
                      <ShoppingBasket size={20} strokeWidth={2.4}/>
                    </button>
                    <button
                      type="button"
                      onClick={() => shareProduct(product)}
                      aria-label="شێرکردنی کاڵا"
                      title="شێرکردن"
                      className="absolute right-3 top-[3.5rem] z-10 grid h-10 w-10 place-items-center rounded-full bg-shakh-orange text-white shadow-lg ring-2 ring-white/90 transition hover:scale-105 hover:bg-orange-600"
                    >
                      <Share2 size={18}/>
                    </button>
                  </div>
                  <div className="flex flex-col gap-2 p-3 sm:p-4">
                    <p className="truncate text-sm font-semibold text-slate-600">{storeName}</p>
                    <p className="text-xs text-slate-500">{categoryName}{subcategoryName ? " · " + subcategoryName : ""}</p>
                    <p className="font-black text-lg text-shakh-orange">{product.variants.length > 0 ? "لە " : ""}{listedPrice.toLocaleString("en-US")} د.ع</p>
                    <button
                      type="button"
                      onClick={() => setExpandedProductIds((current) => detailsOpen ? current.filter((id) => id !== product.id) : [...current, product.id])}
                      aria-expanded={detailsOpen}
                      className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-shakh-blue transition hover:bg-slate-100"
                    >
                      {detailsOpen ? "داخستنی زانیاری" : "زانیاری زیاتر"}
                      <span aria-hidden="true" className={`text-base transition-transform ${detailsOpen ? "rotate-180" : ""}`}>⌄</span>
                    </button>
                    {detailsOpen && (
                      <div className="flex flex-col gap-2 border-t border-slate-100 pt-3 text-sm">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="font-bold text-shakh-orange">{storeLabel}</span>
                          <span className="text-xs text-slate-400">{categoryName}{subcategoryName ? " / " + subcategoryName : ""}</span>
                        </div>
                        <h2 className="font-bold leading-6 text-slate-800">{product.title}</h2>
                        {product.description && <p className="text-xs leading-5 text-slate-500">{product.description}</p>}
                        {storeAddress && <p className="flex items-start gap-1 text-xs text-slate-500"><span aria-hidden="true">📍</span><span>شوێنی دوکان: {storeAddress}</span></p>}
                        {product.variants.length > 0 ? (
                          <div className="rounded-xl bg-blue-50 p-2.5 text-xs text-blue-900">
                            {product.variants.length} جۆری جیاواز هەیە · نرخ و کۆگای هەر جۆرێک جیاوازە
                          </div>
                        ) : <>
                          <p className="text-xs text-slate-500">یەکە: {unitLabels[product.unit] || product.unit}</p>
                          <p className={`text-xs ${outOfStock ? "text-red-600" : "text-green-700"}`}>
                            {outOfStock ? "کۆگا تەواو بووە" : product.stock_quantity === null ? "بەردەست" : `ماوە: ${product.stock_quantity.toLocaleString("en-US")} ${unitLabels[product.unit] || product.unit}`}
                          </p>
                        </>}
                        {product.referral_commission_iqd > 0 && (
                          <div className="w-full rounded-xl border border-purple-100 bg-gradient-to-l from-purple-50 to-orange-50 px-2.5 py-2 text-xs font-black leading-5 text-purple-800">
                            <span className="mr-1 inline-block">🎁</span>
                            شێر بکە و {product.referral_commission_iqd.toLocaleString("en-US")} د.ع خەڵات وەربگرە / هەر دانە
                          </div>
                        )}
                      </div>
                    )}
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
