"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Enums } from "@/lib/supabase/database.types";
import { PackagePlus, Pencil, Trash2, Eye, EyeOff, X, Save, Store, ImagePlus, Camera, Share2, Plus } from "lucide-react";

const merchantTypes: { value: Enums<"app_role">; label: string }[] = [
  { value: "supermarket", label: "سوپەرمارکێت" },
  { value: "restaurant", label: "چێشتخانە" },
  { value: "butcher_poultry", label: "گۆشت و سپیاتی" },
  { value: "grocery", label: "بەقالی" },
];

const roleNames: Record<string, string> = Object.fromEntries(merchantTypes.map((item) => [item.value, item.label]));

const units = [
  { value: "piece", label: "دانە" },
  { value: "kg", label: "کیلۆگرام" },
  { value: "g", label: "گرام" },
  { value: "liter", label: "لیتر" },
  { value: "pack", label: "پاکەت" },
  { value: "box", label: "کارتۆن" },
  { value: "portion", label: "پرس" },
  { value: "plate", label: "قاپ" },
  { value: "cup", label: "پەرداخ" },
  { value: "bottle", label: "بوتڵ" },
  { value: "bunch", label: "دەستە" },
];

const unitsByCategory: Record<string, string[]> = {
  supermarket: ["piece", "kg", "g", "liter", "pack", "box"],
  grocery: ["kg", "g", "piece", "bunch"],
  butcher_poultry: ["kg", "g", "piece"],
  restaurant: ["portion", "plate", "piece", "cup", "bottle", "box"],
};

function getUnitsForCategory(category: string) {
  const allowed = unitsByCategory[category];
  return allowed ? units.filter((unit) => allowed.includes(unit.value)) : units;
}

type Merchant = {
  id: string;
  business_name: string;
  merchant_type: Enums<"app_role">;
  address: string | null;
  description: string | null;
  approval_status: string;
};

type Category = { id: string; store_type: string; category_key: string; name: string; sort_order: number; is_active: boolean };
type Subcategory = { id: string; category_id: string; subcategory_key: string; name: string; sort_order: number; is_active: boolean };
type ProductVariant = { id: string; product_id: string; variant_label: string; price_iqd: number; cost_price_iqd: number | null; stock_quantity: number | null; image_path: string | null; is_active: boolean; sort_order: number };
type VariantDraft = { id?: string; variant_label: string; price: string; costPrice: string; image_path: string | null; image_file: File | null; image_preview: string | null };
type Product = {
  id: string;
  merchant_id: string | null;
  is_shakh_store: boolean;
  title: string;
  description: string | null;
  price_iqd: number;
  cost_price_iqd: number | null;
  referral_commission_iqd: number;
  stock_quantity: number | null;
  unit: string;
  category_key: string;
  category_id: string | null;
  subcategory_id: string | null;
  image_path: string | null;
  is_available: boolean;
  approval_status: string;
  rejection_reason: string | null;
  created_at: string;
  variants: ProductVariant[];
};

const emptyProduct = {
  title: "",
  description: "",
  price: "",
  costPrice: "",
  referralCommission: "",
  stock: "",
  unit: "piece",
  category: "",
  categoryId: "",
  subcategoryId: "",
};

async function compressProductImage(file: File): Promise<File> {
  if (file.size > 10 * 1024 * 1024) {
    throw new Error("قەبارەی وێنە نابێت لە ١٠MB زیاتر بێت.");
  }
  if (typeof createImageBitmap !== "function") return file;
  const bitmap = await createImageBitmap(file);
  try {
    const maxDimension = 1800;
    const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("نەتوانرا وێنە ئامادە بکرێت.");
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((value) => value ? resolve(value) : reject(new Error("کەمکردنەوەی قەبارەی وێنە سەرکەوتوو نەبوو.")), "image/webp", 0.82);
    });
    const extension = blob.type === "image/webp" ? "webp" : blob.type === "image/png" ? "png" : "jpg";
    const baseName = file.name.replace(/\\.[^.]+$/, "") || "product-image";
    return new File([blob], baseName + "." + extension, { type: blob.type || "image/jpeg", lastModified: Date.now() });
  } finally {
    bitmap.close();
  }
}

function formatIQD(value: number) {
  return value.toLocaleString("en-US") + " د.ع";
}

export default function StorePage() {
  const [role, setRole] = useState("");
  const [walletBalance, setWalletBalance] = useState(0);
  const [merchant, setMerchant] = useState<Merchant | null>(null);
  const [merchantNames, setMerchantNames] = useState<Record<string, string>>({});
  const [products, setProducts] = useState<Product[]>([]);
  const [catalogCategories, setCatalogCategories] = useState<Category[]>([]);
  const [catalogSubcategories, setCatalogSubcategories] = useState<Subcategory[]>([]);
  const [formStoreType, setFormStoreType] = useState("shakh_store");
  const [variantDrafts, setVariantDrafts] = useState<VariantDraft[]>([]);
  const [loadingVariants, setLoadingVariants] = useState(false);
  const variantLoadRequest = useRef(0);
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
  const formCategories = catalogCategories.filter((item) => item.store_type === formStoreType && item.is_active);
  const formSubcategories = catalogSubcategories.filter((item) => item.category_id === form.categoryId && item.is_active);
  const formUnits = getUnitsForCategory(formStoreType);

  async function load() {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { window.location.href = "/login"; return; }

    const { data: profile, error: profileError } = await supabase
      .from("profiles").select("role").eq("id", user.id).single();
    if (profileError) throw profileError;

    const currentRole = profile.role || "customer";
    setRole(currentRole);
    const currentStoreType = currentRole === "super_admin" ? "shakh_store" : currentRole;
    setFormStoreType(currentStoreType);
    const [categoryResult, subcategoryResult] = await Promise.all([
      supabase.from("product_categories").select("id,store_type,category_key,name,sort_order,is_active").order("sort_order"),
      supabase.from("product_subcategories").select("id,category_id,subcategory_key,name,sort_order,is_active").order("sort_order"),
    ]);
    if (categoryResult.error) throw categoryResult.error;
    if (subcategoryResult.error) throw subcategoryResult.error;
    setCatalogCategories((categoryResult.data || []) as Category[]);
    setCatalogSubcategories((subcategoryResult.data || []) as Subcategory[]);
    if (!editing) {
      const firstCategory = (categoryResult.data || []).find((item) => item.store_type === currentStoreType && item.is_active);
      if (firstCategory) setForm((old) => old.categoryId ? old : ({ ...old, category: firstCategory.category_key, categoryId: firstCategory.id }));
    }
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
      .select("id,merchant_id,is_shakh_store,title,description,price_iqd,cost_price_iqd,referral_commission_iqd,stock_quantity,unit,category_key,category_id,subcategory_id,image_path,is_available,approval_status,rejection_reason,created_at")
      .order("created_at", { ascending: false });

    // Super Admin must see every product post here, including merchant-owned posts.
    if (currentRole !== "super_admin" && merchant?.id) query = query.eq("merchant_id", merchant.id);
    else if (currentRole !== "super_admin") {
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

    const rows = data || [];
    const productIds = rows.map((product) => product.id);
    let variantRows: ProductVariant[] = [];
    if (productIds.length > 0) {
      const { data: variantsData, error: variantsError } = await supabase
        .from("product_variants")
        .select("id,product_id,variant_label,price_iqd,cost_price_iqd,stock_quantity,image_path,is_active,sort_order")
        .in("product_id", productIds).eq("is_active", true).order("sort_order");
      if (variantsError) throw variantsError;
      variantRows = (variantsData || []) as ProductVariant[];
    }
    const variantsByProduct = new Map<string, ProductVariant[]>();
    for (const variant of variantRows) {
      const group = variantsByProduct.get(variant.product_id) || [];
      group.push(variant);
      variantsByProduct.set(variant.product_id, group);
    }
    const productsWithVariants = rows.map((product) => ({
      ...product,
      variants: variantsByProduct.get(product.id) || [],
    }));
    if (currentRole === "super_admin") {
      const merchantIds = [...new Set(rows.map((product) => product.merchant_id).filter((id): id is string => Boolean(id)))];
      if (merchantIds.length > 0) {
        const { data: merchantRows, error: merchantNamesError } = await supabase
          .from("merchant_profiles")
          .select("id,business_name")
          .in("id", merchantIds);
        if (merchantNamesError) throw merchantNamesError;
        setMerchantNames(Object.fromEntries((merchantRows || []).map((item) => [item.id, item.business_name])));
      } else {
        setMerchantNames({});
      }
    } else {
      setMerchantNames({});
    }

    setProducts(productsWithVariants);
    setLoading(false);
  }

  useEffect(() => {
    load().catch(() => { setMessage("نەتوانرا بەشی فرۆشگا باربکرێت."); setLoading(false); });
  }, []);

  const filteredProducts = useMemo(() => products.filter((product) => {
    const matchesSearch = (product.title + " " + (product.description || "")).toLowerCase().includes(search.toLowerCase());
    const outOfStock = product.stock_quantity === 0;
    const matchesAvailability = availabilityFilter === "all"
      || (availabilityFilter === "available" && product.is_available && !outOfStock)
      || (availabilityFilter === "unavailable" && (!product.is_available || outOfStock));
    return matchesSearch && matchesAvailability;
  }), [products, search, availabilityFilter]);

  function setVariantImage(index: number, file: File | null) {
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 10 * 1024 * 1024) {
      setMessage("وێنەی جۆر دەبێت JPG یان PNG یان WebP بێت و قەبارەکەی زیاتر نەبێت لە ١٠MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setVariantDrafts((current) => current.map((row, rowIndex) => rowIndex === index
      ? { ...row, image_file: file, image_preview: typeof reader.result === "string" ? reader.result : null }
      : row));
    reader.readAsDataURL(file);
  }

  function resetProductForm() {
    variantLoadRequest.current += 1;
    setEditing(null);
    setLoadingVariants(false);
    setVariantDrafts([]);
    setFormStoreType(isAdmin ? "shakh_store" : role);
    const firstCategory = catalogCategories.find((item) => item.store_type === (isAdmin ? "shakh_store" : role) && item.is_active);
    setForm({ ...emptyProduct, category: firstCategory?.category_key || "", categoryId: firstCategory?.id || "" });
    setImage(null);
  }

  function startEditing(product: Product) {
    setEditing(product);
    const productCategory = catalogCategories.find((item) => item.id === product.category_id)
      || catalogCategories.find((item) => item.store_type === (product.is_shakh_store ? "shakh_store" : role) && item.category_key === product.category_key);
    setFormStoreType(productCategory?.store_type || (product.is_shakh_store ? "shakh_store" : role));
    setForm({
      title: product.title,
      description: product.description || "",
      price: String(product.price_iqd),
      costPrice: product.cost_price_iqd === null ? "" : String(product.cost_price_iqd),
      referralCommission: String(product.referral_commission_iqd || 0),
      stock: product.stock_quantity === null ? "" : String(product.stock_quantity),
      unit: product.unit,
      category: product.category_key,
      categoryId: productCategory?.id || "",
      subcategoryId: product.subcategory_id || "",
    });
    setImage(null);
    const requestId = ++variantLoadRequest.current;
    setLoadingVariants(true);
    setVariantDrafts([]);
    void (async () => {
      try {
        const { data, error } = await createClient().from("product_variants")
          .select("id,product_id,variant_label,price_iqd,cost_price_iqd,stock_quantity,image_path,is_active,sort_order")
          .eq("product_id", product.id).order("sort_order");
        if (requestId !== variantLoadRequest.current) return;
        if (error) {
          setMessage("نەتوانرا جۆرەکانی کاڵا باربکرێن: " + error.message);
          return;
        }
        const activeVariants = ((data || []) as ProductVariant[]).filter((variant) => variant.is_active);
        if (product.stock_quantity === null && activeVariants.length > 0 && activeVariants.every((variant) => variant.stock_quantity !== null)) {
          const legacyCombinedStock = activeVariants.reduce((total, variant) => total + (variant.stock_quantity || 0), 0);
          setForm((old) => old.stock.trim() ? old : { ...old, stock: String(legacyCombinedStock) });
        }
        setVariantDrafts(activeVariants.map((variant) => ({
          id: variant.id,
          variant_label: variant.variant_label,
          price: String(variant.price_iqd),
          costPrice: variant.cost_price_iqd === null ? "" : String(variant.cost_price_iqd),
          image_path: variant.image_path || null,
          image_file: null,
          image_preview: variant.image_path ? createClient().storage.from("product-images").getPublicUrl(variant.image_path).data.publicUrl : null,
        })));
      } catch {
        if (requestId === variantLoadRequest.current) setMessage("هەڵەیەک ڕوویدا لە بارکردنی جۆرەکانی کاڵا.");
      } finally {
        if (requestId === variantLoadRequest.current) setLoadingVariants(false);
      }
    })();
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
    if (loadingVariants) {
      setMessage("تکایە چاوەڕێی بارکردنی جۆرەکانی کاڵا بکە پێش پاشەکەوتکردن.");
      return;
    }
    if (!form.categoryId || !form.category) {
      setMessage("تکایە کاتەگۆرییەکی چالاک هەڵبژێرە.");
      return;
    }
    const chosenCategory = catalogCategories.find((item) => item.id === form.categoryId && item.store_type === formStoreType && item.is_active);
    if (!chosenCategory) {
      setMessage("کاتەگۆرییەکە لە لیستی ناوەندی چالاک نییە؛ دووبارە هەڵیبژێرە.");
      return;
    }
    const chosenSubcategory = catalogSubcategories.find((item) =>
      item.id === form.subcategoryId && item.category_id === chosenCategory.id && item.is_active
    );
    const hasActiveSubcategories = catalogSubcategories.some((item) =>
      item.category_id === chosenCategory.id && item.is_active
    );
    if (hasActiveSubcategories && !chosenSubcategory) {
      setMessage("تکایە ژێرکاتەگۆرییەکی گونجاو هەڵبژێرە بۆ ئەوەی کاڵاکە بە دروستی پۆلێن بکرێت.");
      return;
    }
    if (form.subcategoryId && !chosenSubcategory) {
      setMessage("ژێرکاتەگۆرییەکە لەگەڵ کاتەگۆریی سەرەکی ناگونجێت؛ دووبارە هەڵیبژێرە.");
      return;
    }
    const costPrice = form.costPrice.trim() === "" ? null : Number(form.costPrice);
    const referralCommission = Number(form.referralCommission || 0);
    if (!Number.isSafeInteger(referralCommission) || referralCommission < 0) {
      setMessage("خەڵاتی شێر دەبێت سفر یان ژمارەیەکی تەواوی ئەرێنی بێت.");
      return;
    }
    if (isAdmin && (costPrice === null || !Number.isSafeInteger(costPrice) || costPrice < 0)) {
      setMessage("نرخی کڕین دەبێت ژمارەیەکی تەواوی سفر یان زیاتر بێت.");
      return;
    }
    if (stock !== null && (!Number.isFinite(stock) || stock < 0 || stock > 100000000)) {
      setMessage("بڕی کۆگا نابێت ژمارەیەکی نەرێنی یان نادروست بێت.");
      return;
    }
    const parsedVariants = variantDrafts.map((variant) => ({
      id: variant.id,
      variant_label: variant.variant_label.trim(),
      price_iqd: Number(variant.price),
      cost_price_iqd: variant.costPrice.trim() === "" ? null : Number(variant.costPrice),
      image_path: variant.image_path,
      image_file: variant.image_file,
    }));
    for (const variant of parsedVariants) {
      if (!variant.variant_label || !Number.isSafeInteger(variant.price_iqd) || variant.price_iqd <= 0) {
        setMessage("هەر جۆرێک دەبێت ناو و نرخی دروستی هەبێت.");
        return;
      }
      if (isAdmin && (variant.cost_price_iqd === null || !Number.isSafeInteger(variant.cost_price_iqd) || variant.cost_price_iqd < 0)) {
        setMessage("نرخی کڕینی هەر ڕەنگێک دەبێت سفر یان ژمارەیەکی تەواوی دروست بێت.");
        return;
      }
      if (!variant.image_path && !variant.image_file && !variant.id) {
        setMessage("تکایە وێنەی هەر ڕەنگێکی نوێ زیاد بکە.");
        return;
      }
      if (variant.image_file && (!["image/jpeg", "image/png", "image/webp"].includes(variant.image_file.type) || variant.image_file.size > 10 * 1024 * 1024)) {
        setMessage("وێنەی هەر جۆرێک دەبێت JPG یان PNG یان WebP بێت و تا ١٠MB بێت.");
        return;
      }
    }
    if (image && (!["image/jpeg", "image/png", "image/webp"].includes(image.type) || image.size > 10 * 1024 * 1024)) {
      setMessage("وێنە دەبێت JPG یان PNG یان WebP بێت و قەبارەکەی زیاتر نەبێت لە ١٠MB.");
      return;
    }

    setSaving(true);
    setMessage("");
    const supabase = createClient();
    let uploadedPath: string | null = null;
    let keepUploadedPath = false;
    const uploadedVariantPaths: string[] = [];
    let keepUploadedVariantPaths = false;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("تکایە دووبارە بچۆ ژوورەوە.");

      if (image) {
        const uploadFile = await compressProductImage(image);
        if (uploadFile.size > 10 * 1024 * 1024) throw new Error("دوای گونجاندنیش قەبارەی وێنە لە ١٠MB زیاترە.");
        const extension = uploadFile.type === "image/png" ? "png" : uploadFile.type === "image/webp" ? "webp" : "jpg";
        uploadedPath = `${user.id}/${crypto.randomUUID()}.${extension}`;
        const { error: uploadError } = await supabase.storage.from("product-images").upload(uploadedPath, uploadFile, {
          contentType: uploadFile.type,
          upsert: false,
        });
        if (uploadError) throw uploadError;
      }

      const payload = {
        title: form.title.trim(),
        description: form.description.trim() || null,
        price_iqd: parsedVariants.length ? Math.min(...parsedVariants.map((v) => v.price_iqd)) : price,
        ...(isAdmin ? { cost_price_iqd: costPrice } : {}),
        referral_commission_iqd: referralCommission,
        stock_quantity: stock,
        unit: form.unit,
        category_key: chosenCategory.category_key,
        category_id: chosenCategory.id,
        subcategory_id: chosenSubcategory?.id || null,
        ...(uploadedPath ? { image_path: uploadedPath } : {}),
      };

      const result = editing
        ? await supabase.from("products").update(payload).eq("id", editing.id).select("id").single()
        : await supabase.from("products").insert({
            ...payload,
            merchant_id: isAdmin ? null : merchant?.id,
            is_shakh_store: isAdmin,
            is_available: true,
          }).select("id").single();
      if (result.error) throw result.error;
      const productId = result.data.id;
      keepUploadedPath = true;

      let retainedVariantIds = new Set<string>();
      const replacedVariantImagePaths: string[] = [];
      if (parsedVariants.length) {
        for (const variant of parsedVariants) {
          if (!variant.image_file) continue;
          const uploadFile = await compressProductImage(variant.image_file);
          if (uploadFile.size > 10 * 1024 * 1024) throw new Error("دوای گونجاندنیش قەبارەی وێنەی جۆر لە ١٠MB زیاترە.");
          const extension = uploadFile.type === "image/png" ? "png" : uploadFile.type === "image/webp" ? "webp" : "jpg";
          const path = `${user.id}/variants/${crypto.randomUUID()}.${extension}`;
          const { error: uploadError } = await supabase.storage.from("product-images").upload(path, uploadFile, { contentType: uploadFile.type, upsert: false });
          if (uploadError) throw uploadError;
          uploadedVariantPaths.push(path);
          if (variant.image_path) replacedVariantImagePaths.push(variant.image_path);
          variant.image_path = path;
        }
        const variantPayload = parsedVariants.map((variant, index) => ({
          ...(variant.id ? { id: variant.id } : {}),
          product_id: productId,
          variant_label: variant.variant_label,
          color_name: null,
          color_hex: null,
          scent: null,
          size_label: null,
          unit: form.unit,
          price_iqd: variant.price_iqd,
          cost_price_iqd: variant.cost_price_iqd,
          stock_quantity: null,
          sku: null,
          image_path: variant.image_path,
          sort_order: index,
          is_active: true,
        }));
        const { data: upsertedVariantRows, error: variantsError } = await supabase.from("product_variants").upsert(variantPayload).select("id");
        if (variantsError) throw variantsError;
        retainedVariantIds = new Set((upsertedVariantRows || []).map((variant) => variant.id));
      }

      // Only deactivate removed options after all submitted options were saved successfully.
      const { data: savedVariantRows, error: variantListError } = await supabase
        .from("product_variants").select("id,image_path").eq("product_id", productId);
      if (variantListError) throw variantListError;
      const removedVariantRows = (savedVariantRows || []).filter((variant) => !retainedVariantIds.has(variant.id));
      const retainedImagePaths = new Set(parsedVariants.map((variant) => variant.image_path).filter((path): path is string => Boolean(path)));
      const removedVariantIds = removedVariantRows.map((variant) => variant.id);
      if (removedVariantIds.length) {
        const { error: deactivateError } = await supabase.from("product_variants")
          .update({ is_active: false }).in("id", removedVariantIds);
        if (deactivateError) throw deactivateError;
      }

      keepUploadedVariantPaths = true;
      const obsoleteVariantPaths = [...new Set([...replacedVariantImagePaths, ...(savedVariantRows || []).map((variant) => variant.image_path).filter((path): path is string => Boolean(path) && !retainedImagePaths.has(path as string))])];
      if (obsoleteVariantPaths.length) await supabase.storage.from("product-images").remove(obsoleteVariantPaths);
      if (uploadedPath && editing?.image_path) {
        await supabase.storage.from("product-images").remove([editing.image_path]);
      }

      setMessage(editing ? "کاڵا و جۆرەکانی نوێ کرانەوە." : isAdmin ? "کاڵا و جۆرەکانی بۆ شاخ ستۆر زیاد کران." : "پۆستەکەت نێردرا بۆ سوپەر ئەدمین. تا دیاریکردنی کۆمسیۆن، ناچالاک و نادیار دەمێنێتەوە؛ ئاگادارکردنەوەش بۆت نێردرا.");
      resetProductForm();
      await load();
    } catch (error) {
      if (uploadedPath && !keepUploadedPath) await supabase.storage.from("product-images").remove([uploadedPath]);
      if (uploadedVariantPaths.length && !keepUploadedVariantPaths) await supabase.storage.from("product-images").remove(uploadedVariantPaths);
      setMessage(error instanceof Error ? error.message : "پاشەکەوتکردنی کاڵا سەرکەوتوو نەبوو.");
    } finally {
      setSaving(false);
    }
  }

  async function shareProductReward(product: Product) {
    if (product.referral_commission_iqd <= 0) {
      setMessage("ئەم کاڵایە خەڵاتی شێری نییە؛ بڕی خەڵات لە پۆستەکە سفرە.");
      return;
    }
    if (product.approval_status !== "approved" || !product.is_available || product.stock_quantity === 0) {
      setMessage("تەنها پۆستی پەسەندکراو و بەردەست دەتوانرێت بۆ خەڵات شێر بکرێت.");
      return;
    }

    setSaving(true);
    setMessage("");
    try {
      const supabase = createClient();
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!user) throw new Error("تکایە دووبارە بچۆ ژوورەوە.");

      const { data: existingCampaign, error: campaignError } = await supabase
        .from("reward_campaigns")
        .select("id")
        .eq("owner_user_id", user.id)
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (campaignError) throw campaignError;

      let campaignId = existingCampaign?.id;
      if (!campaignId) {
        const { data: createdCampaign, error: createError } = await supabase
          .from("reward_campaigns")
          .insert({
            owner_user_id: user.id,
            title: "لینکی شێرکردنی پۆستەکانم",
            description: "لینکی تایبەتی خاوەنی پۆست بۆ کاڵا خەڵاتدارەکان",
            reward_amount_iqd: 0,
            is_active: true,
          })
          .select("id")
          .single();
        if (createError) throw createError;
        campaignId = createdCampaign.id;
      }

      const url = new URL("https://www.daim-post.online/shop");
      url.searchParams.set("ref", campaignId);
      url.searchParams.set("product", product.id);
      const shareUrl = url.toString();
      const shareText = `ئەم کاڵایە لە شاخ ستۆر ببینە: ${product.title}. ئەگەر بە لینکەکەم داواکاری بکەیت و گەیاندن تەواو بێت، خەڵاتی شێر بۆ من تۆمار دەکرێت.`;

      if (typeof navigator.share === "function") {
        try {
          await navigator.share({ title: "SHAKH STORE | شاخ ستۆر", text: shareText, url: shareUrl });
          setMessage("لینکی تایبەتی ئەم پۆستە شێر کرا. خەڵات دوای گەیاندنی داواکاریی کڕیار بۆ جزدان زیاد دەبێت.");
          return;
        } catch (error) {
          if (error instanceof DOMException && error.name === "AbortError") return;
        }
      }

      try {
        await navigator.clipboard.writeText(shareUrl);
        setMessage("لینکی تایبەتی ئەم پۆستە کۆپی کرا. بۆ کڕیاری تر بینێرە؛ خەڵات دوای گەیاندن بۆ جزدان زیاد دەبێت.");
      } catch {
        setMessage("لینکی تایبەتی ئەم پۆستە: " + shareUrl);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "دروستکردنی لینکی شێرکردنی پۆست سەرکەوتوو نەبوو.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleAvailability(product: Product) {
    setSaving(true);
    setMessage("");
    try {
      const { data, error } = await createClient().from("products")
        .update({ is_available: !product.is_available })
        .eq("id", product.id)
        .select("id,is_available")
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error("پۆستەکە نەدۆزرایەوە یان مۆڵەتی گۆڕینی دۆخت نییە.");
      setProducts((current) => current.map((item) => item.id === product.id ? { ...item, is_available: data.is_available } : item));
      setMessage(data.is_available ? "پۆستەکە دووبارە بەردەست کرا." : "پۆستەکە ناچالاک کرا و لە بازاڕ شاردرایەوە.");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "گۆڕینی دۆخی پۆست سەرکەوتوو نەبوو.");
    } finally {
      setSaving(false);
    }
  }

  async function removeProduct(product: Product) {
    if (!window.confirm(`دڵنیایت لە سڕینەوەی یەکجاری «${product.title}»؟ ئەم کردارە ناگەڕێتەوە. تەنها مێژووی داواکارییە کۆنەکان دەمێننەوە.`)) return;
    setSaving(true);
    setMessage("");
    const supabase = createClient();
    try {
      const { data, error } = await supabase.from("products")
        .delete()
        .eq("id", product.id)
        .select("id");
      if (error) throw error;
      if (!data || data.length === 0) {
        throw new Error("هیچ پۆستێک نەسڕایەوە؛ پشکنینی دەسەڵات و هەبوونی پۆستەکە بکە.");
      }
      setProducts((current) => current.filter((item) => item.id !== product.id));
      if (product.image_path) await supabase.storage.from("product-images").remove([product.image_path]);
      setMessage("پۆستەکە بە یەکجاری سڕایەوە؛ مێژووی داواکارییە کۆنەکان پارێزراون.");
      if (editing?.id === product.id) resetProductForm();
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "سڕینەوەی پۆست سەرکەوتوو نەبوو.");
    } finally {
      setSaving(false);
    }
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
            <h1 className="mt-1 text-3xl font-black">{isAdmin ? "بەڕێوەبردنی شاخ ستۆر و پۆستەکانی هەموو دوکانەکان" : merchant?.business_name || "بەشی فرۆشگاکەت"}</h1>
            <p className="mt-2 text-sm text-slate-500">کاڵا، نرخ، کۆگا، وێنە و بەردەستبوون بەڕێوەببە.</p>
            {isAdmin && <p className="mt-2 rounded-xl bg-blue-50 p-3 text-sm font-semibold text-blue-900">لەو بەشەدا هەموو پۆستەکانی شاخ ستۆر و هەموو دوکاندارەکان دەبینیت. پۆستی دوکاندارانی تر دەتوانیت بسڕیتەوە؛ دەستکاریکردنیان لە لای خاوەنی دوکانەکە دەمێنێتەوە.</p>}
            {!isAdmin && merchant && <p className="mt-2 text-sm text-slate-600">شوێنی دوکان: {merchant.address?.trim() || "شوێن تۆمار نەکراوە"}</p>}
          </div>
          {(isAdmin || merchant?.approval_status === "approved") && (
            <span className="rounded-full bg-green-50 px-4 py-2 text-sm font-bold text-green-700">دوکان چالاکە</span>
          )}
        </header>

        {message && <p role="status" className="mt-5 rounded-xl bg-blue-50 p-4 text-sm text-blue-800">{message}</p>}
        {!isAdmin && merchant?.approval_status === "approved" && <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"><b>ڕێسای کۆمسیۆنی پۆست:</b> هەر پۆستێکی نوێ تا سوپەر ئەدمین کۆمسیۆنی هەر دانەیەکی دیاری نەکات، ناچالاک و نادیار دەمێنێتەوە. دوای دیاریکردنی کۆمسیۆن، پۆستەکە چالاک دەبێت. کۆمسیۆن لە کاتی فرۆشتن و تەواوبوونی گەیاندن لە جزدان کەم دەکرێتەوە.</div>}

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
                  <label className="block text-sm font-bold">کاتەگۆری سەرەکی
                    <select required value={form.categoryId} onChange={(event) => {
                      const selected = formCategories.find((item) => item.id === event.target.value);
                      setForm((old) => ({
                        ...old,
                        categoryId: event.target.value,
                        category: selected?.category_key || "",
                        subcategoryId: "",
                      }));
                    }} className="mt-2 w-full rounded-xl border border-slate-200 p-3">
                      <option value="">کاتەگۆری هەڵبژێرە</option>
                      {formCategories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                    </select>
                    <small className="mt-1 block text-xs font-medium leading-5 text-slate-500">هەمان لیستی ناوەندیی سوپەر ئەدمین بەکاردەهێنرێت.</small>
                  </label>
                  <label className="block text-sm font-bold">ژێرکاتەگۆری
                    <select value={form.subcategoryId} onChange={(event) => setForm((old) => ({ ...old, subcategoryId: event.target.value }))} disabled={!form.categoryId || formSubcategories.length === 0} required={formSubcategories.length > 0} className="mt-2 w-full rounded-xl border border-slate-200 p-3 disabled:bg-slate-50">
                      <option value="">{formSubcategories.length > 0 ? "ژێرکاتەگۆری هەڵبژێرە" : "ژێرکاتەگۆری نییە"}</option>
                      {formSubcategories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                    </select>
                    <small className="mt-1 block text-xs font-medium leading-5 text-slate-500">کاتێک ژێرکاتەگۆری هەیە، هەڵبژاردنی پێویستە بۆ جیاکردنەوەی کاڵاکان.</small>
                  </label>
                </div>
                <label className="block text-sm font-bold">وردەکاری کاڵا
                  <textarea maxLength={1000} rows={3} value={form.description} onChange={(event) => setForm((old) => ({ ...old, description: event.target.value }))} placeholder="پێناسە و زانیاریی کاڵا..." className="mt-2 w-full rounded-xl border border-slate-200 p-3"/>
                </label>
                <div className={`grid gap-4 ${isAdmin ? "md:grid-cols-5" : "md:grid-cols-4"}`}>
                  {isAdmin && <label className="block text-sm font-bold">نرخی کڕین (د.ع)
                    <input required type="number" min="0" step="1" value={form.costPrice} onChange={(event) => setForm((old) => ({ ...old, costPrice: event.target.value }))} placeholder="نرخی کڕین" className="mt-2 w-full rounded-xl border border-slate-200 p-3"/>
                  </label>}
                  <label className="block text-sm font-bold">نرخ بە دیناری عێراقی
                    <input required type="number" min="1" step="1" value={form.price} onChange={(event) => setForm((old) => ({ ...old, price: event.target.value }))} placeholder="١٠٠٠" className="mt-2 w-full rounded-xl border border-slate-200 p-3"/>
                  </label>
                  <label className="block text-sm font-bold">یەکەی فرۆشتن
                    <select value={form.unit} onChange={(event) => setForm((old) => ({ ...old, unit: event.target.value }))} className="mt-2 w-full rounded-xl border border-slate-200 p-3">
                      {formUnits.map((unit) => <option key={unit.value} value={unit.value}>{unit.label}</option>)}
                    </select>
                    {form.unit === "kg" && <small className="mt-1 block text-xs font-medium leading-5 text-slate-500">لە بازاڕ و سەبەتەدا بڕی کاڵای کیلۆیی بە هەنگاوی نیو کیلۆ (٠.٥) زیاد و کەم دەکرێت؛ نرخ بۆ هەر کیلۆیەکە.</small>}
                  </label>
                  <label className="block text-sm font-black text-purple-800">خەڵاتی شێر بۆ هەر دانە (ئارەزوومەندانە)
                    <input type="number" min="0" step="1" value={form.referralCommission} onChange={(event) => setForm((old) => ({ ...old, referralCommission: event.target.value }))} placeholder="٠ = بێ خەڵات · نموونە: ٥٠٠ د.ع" className="mt-2 w-full rounded-xl border-2 border-purple-200 bg-purple-50 p-3 text-base font-black text-purple-900 focus:border-purple-500 focus:outline-none"/>
                    <small className="mt-2 block text-xs font-medium leading-6 text-slate-500">٠ دابنێ ئەگەر ناتەوێت ئەم کاڵایە خەڵاتی شێری هەبێت. تەنها کاتێک بڕێکی زیاتر لە سفر دابنێیت، ئەم کاڵایە لە پرۆگرامی شێر و خەڵاتدا دەردەکەوێت؛ خەڵاتەکە دوای گەیاندنی داواکاری زیاد دەکرێت.</small>
                  </label>
                  <label className="block text-sm font-bold">بڕی کۆگای هەموو ڕەنگەکان (بەتاڵ = بێ سنوور)
                    <input type="number" min="0" step="0.001" value={form.stock} onChange={(event) => setForm((old) => ({ ...old, stock: event.target.value }))} placeholder="بۆ نموونە: ٢٥" className="mt-2 w-full rounded-xl border border-slate-200 p-3"/>
                    {variantDrafts.length > 0 && <small className="mt-1 block text-xs font-medium text-slate-500">کۆگا بۆ هەموو ڕەنگەکان یەکە؛ سیستەم بڕی فرۆشراو لە کۆگای هاوبەشی کاڵاکە کەم دەکاتەوە.</small>}
                  </label>
                </div>
                {loadingVariants && <p className="rounded-xl bg-blue-50 p-3 text-xs font-bold text-blue-800">بارکردنی جۆرەکانی ئەم کاڵایە...</p>}
                <section className="rounded-2xl border border-blue-100 bg-blue-50/50 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h3 className="font-black text-slate-900">ڕەنگە جیاوازەکانی کاڵا</h3>
                      <p className="mt-1 text-xs leading-6 text-slate-600">هەر ڕەنگێک تەنها ناو، وێنە، نرخی کڕین و نرخی فرۆشتنی تایبەتی خۆی هەیە؛ قەبارە و ناوەڕۆک و یەکەکەی هەموویان هاوبەشە.</p>
                    </div>
                    <button type="button" onClick={() => setVariantDrafts((current) => [...current, { variant_label: "", price: form.price, costPrice: "", image_path: null, image_file: null, image_preview: null }])} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-shakh-blue px-4 text-sm font-bold text-white">
                      <Plus size={16}/> زیادکردنی جۆر
                    </button>
                  </div>
                  {variantDrafts.length > 0 && <div className="mt-4 space-y-3">
                    {variantDrafts.map((variant, index) => (
                      <div key={variant.id || index} className="rounded-xl border border-slate-200 bg-white p-3">
                        <div className="flex items-center justify-between gap-2">
                          <b className="text-sm">جۆری ژمارە {index + 1}</b>
                          <button type="button" onClick={() => setVariantDrafts((current) => current.filter((_, rowIndex) => rowIndex !== index))} className="rounded-lg border border-red-100 p-2 text-red-600" aria-label="سڕینەوەی جۆر"><Trash2 size={15}/></button>
                        </div>
                        <div className="mt-3 grid gap-3 sm:grid-cols-2">
                          <div className="sm:col-span-2 rounded-xl border border-dashed border-blue-200 bg-blue-50/60 p-3">
                            <div className="flex items-center gap-3">
                              {variant.image_preview ? <img src={variant.image_preview} alt={`وێنەی جۆری ${index + 1}`} className="h-20 w-20 rounded-lg border bg-white object-contain p-1"/> : <div className="grid h-20 w-20 shrink-0 place-items-center rounded-lg border bg-white text-slate-300"><ImagePlus size={26}/></div>}
                              <div className="min-w-0 flex-1">
                                <label className="block text-xs font-black">وێنەی ئەم ڕەنگە
                                  <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => setVariantImage(index, event.target.files?.[0] || null)} className="mt-2 block w-full text-xs font-medium"/>
                                </label>
                                <p className="mt-1 text-[11px] text-slate-500">وێنەی ئەم ڕەنگە؛ JPG / PNG / WebP تا ١٠MB</p>
                                {variant.image_file && <p className="mt-1 truncate text-[11px] font-bold text-green-700">{variant.image_file.name}</p>}
                                {variant.image_path && !variant.image_file && <p className="mt-1 text-[11px] text-green-700">وێنەی پاشەکەوتکراو</p>}
                              </div>
                              {(variant.image_path || variant.image_file) && <button type="button" onClick={() => setVariantDrafts((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, image_path: null, image_file: null, image_preview: null } : row))} className="rounded-lg border border-red-200 p-2 text-red-600" aria-label="لابردنی وێنەی جۆر"><X size={16}/></button>}
                            </div>
                          </div>
                          <label className="text-xs font-bold">ناوی ڕەنگ / جۆر (پێویستە)
                            <input required maxLength={160} value={variant.variant_label} onChange={(event) => setVariantDrafts((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, variant_label: event.target.value } : row))} placeholder="نموونە: ڕەش، سپی، سوور" className="mt-1 w-full rounded-lg border p-2.5 text-sm"/>
                          </label>
                          {isAdmin && <label className="text-xs font-bold">نرخی کڕین (د.ع)
                            <input required type="number" min="0" step="1" value={variant.costPrice} onChange={(event) => setVariantDrafts((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, costPrice: event.target.value } : row))} className="mt-1 w-full rounded-lg border p-2.5 text-sm"/>
                          </label>}
                          <label className="text-xs font-bold">نرخی فرۆشتن (د.ع)
                            <input required type="number" min="1" step="1" value={variant.price} onChange={(event) => setVariantDrafts((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, price: event.target.value } : row))} className="mt-1 w-full rounded-lg border p-2.5 text-sm"/>
                          </label>
                        </div>
                      </div>
                    ))}
                  </div>}
                </section>
                <div className="block text-sm font-bold">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="flex items-center gap-2"><ImagePlus size={18}/> وێنەی کاڵا</span>
                    <span className="text-xs font-medium text-slate-500">JPG، PNG یان WebP · تا ١٠MB</span>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-3">
                    <label className="group relative flex min-h-28 cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-shakh-blue/30 bg-blue-50 px-3 py-4 text-center transition hover:border-shakh-blue hover:bg-blue-100 focus-within:ring-2 focus-within:ring-shakh-blue">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(event) => setImage(event.target.files?.[0] || null)}
                        className="sr-only"
                        aria-label="هەڵبژاردنی وێنە لە گەلەری یان فایلەکان"
                      />
                      <span className="grid h-11 w-11 place-items-center rounded-full bg-white text-shakh-blue shadow-sm transition group-hover:scale-105">
                        <ImagePlus size={23} strokeWidth={2.2}/>
                      </span>
                      <span className="text-sm font-black text-shakh-blue">هەڵبژاردنی وێنە</span>
                      <span className="text-[11px] font-medium text-slate-500">گەلەری مۆبایل / فایلەکان</span>
                    </label>
                    <label className="group relative flex min-h-28 cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-shakh-orange/40 bg-orange-50 px-3 py-4 text-center transition hover:border-shakh-orange hover:bg-orange-100 focus-within:ring-2 focus-within:ring-shakh-orange">
                      <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        onChange={(event) => setImage(event.target.files?.[0] || null)}
                        className="sr-only"
                        aria-label="کردنەوەی کامێرا بۆ وێنگرتن"
                      />
                      <span className="grid h-11 w-11 place-items-center rounded-full bg-white text-shakh-orange shadow-sm transition group-hover:scale-105">
                        <Camera size={23} strokeWidth={2.2}/>
                      </span>
                      <span className="text-sm font-black text-shakh-orange">وێنگرتن بە کامێرا</span>
                      <span className="text-[11px] font-medium text-slate-500">کامێرای پێشەوە / دواوە</span>
                    </label>
                  </div>
                  {image && <p className="mt-3 flex items-center gap-2 rounded-xl bg-green-50 px-3 py-2 text-xs font-bold text-green-800"><ImagePlus size={15}/> وێنە هەڵبژێردرا: <span className="min-w-0 truncate" dir="auto">{image.name}</span></p>}
                  {editing?.image_path && !image && <small className="mt-2 block text-xs font-medium text-slate-500">وێنەی ئێستا دەمێنێتەوە؛ بۆ گۆڕینی، یەکێک لە دوو هەڵبژاردەکە بەکاربهێنە.</small>}
                </div>
                <div className="flex flex-wrap gap-2">
                  <button disabled={saving || loadingVariants || !form.title.trim() || !form.price || (!isAdmin && walletBalance <= 0)} className="inline-flex items-center gap-2 rounded-xl bg-shakh-orange px-5 py-3 font-bold text-white disabled:opacity-50">
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
                     const lowestVariantPrice = product.variants.length > 0
                       ? Math.min(...product.variants.map((variant) => variant.price_iqd))
                       : product.price_iqd;
                    return (
                      <article key={product.id} className="overflow-hidden rounded-2xl bg-white shadow-soft">
                        <div className="flex gap-4 p-4">
                          <div className="grid h-24 w-24 shrink-0 place-items-center overflow-hidden rounded-xl bg-shakh-mist text-shakh-blue">
                            {publicImage ? <img src={publicImage} alt={product.title} className="h-full w-full object-cover"/> : <Store size={30}/>}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="font-black">{product.title}</h3>
                              <span className={`rounded-full px-2 py-1 text-[11px] font-bold ${product.approval_status === "pending" ? "bg-amber-50 text-amber-800" : product.approval_status === "rejected" ? "bg-red-50 text-red-700" : product.is_available && !outOfStock ? "bg-green-50 text-green-700" : "bg-slate-100 text-slate-500"}`}>{product.approval_status === "pending" ? "چاوەڕوانی پەسەندکردن" : product.approval_status === "rejected" ? "ڕەفزکراو" : outOfStock ? "کۆگا تەواو بووە" : product.is_available ? "بەردەست" : "ناچالاک"}</span>
                            </div>
                            {isAdmin && <p className="mt-1 text-xs font-semibold text-slate-500">{product.variants.length > 0
                               ? `${product.variants.length} ڕەنگی جیاواز · تێچوو و قازانج بەپێی نرخی کڕینی هەر ڕەنگ تۆمار دەکرێت`
                               : `نرخی کڕین: ${product.cost_price_iqd === null ? "تۆمار نەکراوە" : formatIQD(product.cost_price_iqd)} · قازانجی هەر دانە: ${product.cost_price_iqd === null ? "—" : formatIQD(product.price_iqd - product.cost_price_iqd)}`}</p>}
                            {isAdmin && !product.is_shakh_store && <p className="mt-1 rounded-lg bg-blue-50 px-2 py-1 text-xs font-bold text-blue-800">خاوەنی پۆست: {merchantNames[product.merchant_id || ""] || "دوکانداری نەناسراو"}</p>}
                            {product.referral_commission_iqd > 0
                              ? <p className="mt-1 rounded-lg bg-purple-50 px-2 py-1 text-xs font-black text-purple-800">خەڵاتی شێر بۆ هەر دانە: {formatIQD(product.referral_commission_iqd)}</p>
                              : <p className="mt-1 rounded-lg bg-slate-50 px-2 py-1 text-xs font-medium text-slate-500">ئەم کاڵایە بە شێوەی ئاسایی دەفرۆشرێت؛ شێر و خەڵاتی نییە.</p>}
                            <p className="mt-1 text-lg font-black text-shakh-orange">{product.variants.length > 0 ? "لە " : ""}{formatIQD(lowestVariantPrice)} <small className="text-xs font-medium text-slate-500">/ {units.find((unit) => unit.value === product.unit)?.label || product.unit}</small></p>
                             <p className="mt-1 text-sm text-slate-500">کۆگای هاوبەش: {product.stock_quantity === null ? "بێ سنوور" : product.stock_quantity.toLocaleString("en-US") + " " + (units.find((unit) => unit.value === product.unit)?.label || product.unit)}</p>
                            {product.description && <p className="mt-1 line-clamp-2 text-xs text-slate-500">{product.description}</p>}{product.rejection_reason && <p className="mt-2 rounded-lg bg-red-50 p-2 text-xs text-red-700">هۆکاری ڕەفز: {product.rejection_reason}</p>}
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2 border-t border-slate-100 p-3">
                          {(!isAdmin || product.is_shakh_store) && product.referral_commission_iqd > 0 && product.approval_status === "approved" && product.is_available && !outOfStock && (
                            <button disabled={saving} onClick={() => void shareProductReward(product)} className="inline-flex items-center gap-1 rounded-lg bg-purple-50 px-3 py-2 text-sm font-bold text-purple-800 disabled:opacity-50"><Share2 size={15}/> شێرکردنی پۆست و وەرگرتنی خەڵات</button>
                          )}
                          {(!isAdmin || product.is_shakh_store) && <>
                            <button disabled={saving} onClick={() => startEditing(product)} className="inline-flex items-center gap-1 rounded-lg bg-blue-50 px-3 py-2 text-sm font-bold text-blue-700 disabled:opacity-50"><Pencil size={15}/> دەستکاری</button>
                            <button disabled={saving} onClick={() => void toggleAvailability(product)} className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-3 py-2 text-sm font-bold text-slate-700 disabled:opacity-50">{product.is_available ? <EyeOff size={15}/> : <Eye size={15}/>} {product.is_available ? "ناچالاککردن" : "بەردەستکردن"}</button>
                          </>}
                          <button disabled={saving} onClick={() => void removeProduct(product)} className="inline-flex items-center gap-1 rounded-lg bg-red-50 px-3 py-2 text-sm font-bold text-red-700 disabled:opacity-50"><Trash2 size={15}/> سڕینەوەی یەکجاری</button>
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
