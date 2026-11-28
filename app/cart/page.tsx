"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import ShakhBrand from "@/components/shakh-brand";
import { CheckCircle2, LocateFixed, MapPin } from "lucide-react";

type CartItem = {
  product_id: string;
  title: string;
  price_iqd: number;
  merchant_id: string | null;
  quantity: number;
  unit?: string;
  stock_quantity?: number | null;
  variant_id?: string;
  variant_label?: string;
  variant_image_path?: string | null;
  is_shakh_store?: boolean;
  referral_campaign_id?: string | null;
};

type ProductSnapshot = {
  id: string;
  title: string;
  price_iqd: number;
  merchant_id: string | null;
  unit: string;
  stock_quantity: number | null;
  is_available: boolean;
  is_shakh_store: boolean;
};

type VariantSnapshot = {
  id: string;
  product_id: string;
  variant_label: string;
  image_path: string | null;
  price_iqd: number;
  is_active: boolean;
};

type ZoneBoundary = { type: "Polygon"; coordinates: [number, number][][] };
type Zone = {
  id: string; name: string; delivery_fee_iqd: number; boundary_geojson: ZoneBoundary | null;
  zone_type: "polygon" | "circle"; circle_center_latitude: number | null; circle_center_longitude: number | null;
  circle_outer_radius_m: number | null; circle_inner_radius_m: number; circle_ring_order: number | null;
};
function pointInsidePolygon(boundary: ZoneBoundary, latitude: number, longitude: number) {
  const ring=boundary.coordinates?.[0]; if(!ring||ring.length<4)return false; let inside=false;
  for(let i=0,j=ring.length-1;i<ring.length;j=i++){
    const [xi,yi]=ring[i]; const [xj,yj]=ring[j];
    const cross=(longitude-xi)*(yj-yi)-(latitude-yi)*(xj-xi);
    if(Math.abs(cross)<1e-10&&longitude>=Math.min(xi,xj)&&longitude<=Math.max(xi,xj)&&latitude>=Math.min(yi,yj)&&latitude<=Math.max(yi,yj))return true;
    const crosses=(yi>latitude)!==(yj>latitude)&&longitude<((xj-xi)*(latitude-yi))/(yj-yi)+xi;
    if(crosses)inside=!inside;
  }
  return inside;
}
function zoneContainsPoint(zone: Zone, latitude: number, longitude: number) {
  if(zone.zone_type==="circle"){
    if(zone.circle_center_latitude===null||zone.circle_center_longitude===null||zone.circle_outer_radius_m===null)return false;
    const rad=(value:number)=>(value*Math.PI)/180;
    const lat1=rad(zone.circle_center_latitude),lat2=rad(latitude);
    const dLat=rad(latitude-zone.circle_center_latitude),dLon=rad(longitude-zone.circle_center_longitude);
    const a=Math.sin(dLat/2)**2+Math.cos(lat1)*Math.cos(lat2)*Math.sin(dLon/2)**2;
    const distance=2*6371008.8*Math.asin(Math.min(1,Math.sqrt(Math.max(0,a))));
    return distance>=zone.circle_inner_radius_m&&distance<=zone.circle_outer_radius_m;
  }
  return zone.boundary_geojson?pointInsidePolygon(zone.boundary_geojson,latitude,longitude):false;
}

const unitLabels: Record<string, string> = {
  piece: "دانە", kg: "کیلۆگرام", g: "گرام", liter: "لیتر", pack: "پاکەت", box: "کارتۆن",
  portion: "پرس", plate: "قاپ", cup: "پەرداخ", bottle: "بوتڵ", bunch: "دەستە",
};

export default function CartPage() {
  const [items, setItems] = useState<CartItem[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [merchantNames, setMerchantNames] = useState<Record<string, string>>({});
  const [zone, setZone] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [deliveryPhone, setDeliveryPhone] = useState("");
  const [deliveryNotes, setDeliveryNotes] = useState("");
  const [deliveryCoordinates, setDeliveryCoordinates] = useState<{ latitude: number; longitude: number; accuracy: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [cartVerified, setCartVerified] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [idempotencyKey, setIdempotencyKey] = useState("");

  useEffect(() => {
    let active = true;
    async function load() {
      const supabase = createClient();
      let saved: CartItem[] = [];
      try {
        saved = JSON.parse(localStorage.getItem("shakh-cart") || "[]") as CartItem[];
        if (!Array.isArray(saved)) saved = [];
      } catch { saved = []; }

      if (saved.length > 0) {
        const ids = [...new Set(saved.map((item) => item.product_id))];
        const { data, error } = await supabase.from("products")
          .select("id,title,price_iqd,merchant_id,unit,stock_quantity,is_available,is_shakh_store")
          .in("id", ids);
        const variantIds = [...new Set(saved.map((item) => item.variant_id).filter((id): id is string => !!id))];
        const variantResult = variantIds.length
          ? await supabase.from("product_variants")
              .select("id,product_id,variant_label,image_path,price_iqd,is_active")
              .in("id", variantIds)
          : { data: [], error: null };

        if (!active) return;
        if (error || variantResult.error) {
          setItems(saved);
          setMessage("نەتوانرا نرخ و کۆگای نوێ پشتڕاست بکرێتەوە؛ تکایە پەیوەندی ئینتەرنێت بپشکنە.");
          setCartVerified(false);
        } else {
          const productMap: Record<string, ProductSnapshot> = Object.fromEntries(
            (data || []).map((product) => [product.id, product as ProductSnapshot])
          );
          const variantMap: Record<string, VariantSnapshot> = Object.fromEntries(
            ((variantResult.data || []) as VariantSnapshot[]).map((variant) => [variant.id, variant])
          );
          let removed = 0;
          let adjusted = false;
          const refreshed = saved.flatMap((item) => {
            const product = productMap[item.product_id];
            if (!product || !product.is_available || product.stock_quantity === 0) {
              removed += 1;
              return [];
            }
            const variant = item.variant_id ? variantMap[item.variant_id] : null;
            if (item.variant_id && (!variant || !variant.is_active || variant.product_id !== product.id)) {
              removed += 1;
              return [];
            }
            const currentPrice = variant?.price_iqd ?? product.price_iqd;
            const currentUnit = variant?.unit || product.unit;
            const currentStock = product.stock_quantity;
            const quantity = currentStock === null ? item.quantity : Math.min(item.quantity, currentStock);
            if (quantity !== item.quantity || currentPrice !== item.price_iqd) adjusted = true;
            return [{
              ...item,
              title: product.title,
              price_iqd: currentPrice,
              merchant_id: product.merchant_id,
              unit: currentUnit,
              stock_quantity: currentStock,
              is_shakh_store: product.is_shakh_store,
              ...(variant ? {
                variant_label: variant.variant_label,
                variant_image_path: variant.image_path,
              } : {}),
              quantity,
            }];
          });
          setItems(refreshed);
          localStorage.setItem("shakh-cart", JSON.stringify(refreshed));
          const merchantIds = [...new Set(refreshed.map((item) => item.merchant_id).filter((id): id is string => !!id))];
          if (merchantIds.length > 0) {
            const { data: merchantRows } = await supabase.from("merchant_profiles")
              .select("id,business_name").in("id", merchantIds);
            if (active) setMerchantNames(Object.fromEntries((merchantRows || []).map((merchant) => [merchant.id, merchant.business_name])));
          }
          if (removed > 0 || adjusted) setMessage("هەندێک کاڵا یان بڕی کۆگا نوێکرایەوە؛ سەبەتەکەت نوێ کراوەتەوە.");
          setCartVerified(true);
        }
      } else {
        setCartVerified(true);
      }

      const [{ data: { user } }, zoneResult] = await Promise.all([
        supabase.auth.getUser(),
        supabase.from("service_zones").select("id,name,delivery_fee_iqd,boundary_geojson,zone_type,circle_center_latitude,circle_center_longitude,circle_outer_radius_m,circle_ring_order").eq("is_active", true).order("name"),
      ]);
      if (!active) return;
      setIsAuthenticated(Boolean(user));
      const zoneRows = (zoneResult.data || []) as unknown as Omit<Zone, "circle_inner_radius_m">[];
      const circleRows = zoneRows.filter((item) => item.zone_type === "circle").sort((a,b)=>(a.circle_ring_order||0)-(b.circle_ring_order||0));
      const zoneRowsWithInner = zoneRows.map((item) => ({
        ...item,
        circle_inner_radius_m: item.zone_type === "circle"
          ? circleRows.filter((previous)=>(previous.circle_ring_order||0)<(item.circle_ring_order||0))
              .reduce((max,previous)=>Math.max(max,previous.circle_outer_radius_m||0),0)
          : 0,
      })) as Zone[];
      const orderedZones = [
        ...zoneRowsWithInner.filter((item)=>item.zone_type==="circle").sort((a,b)=>(a.circle_ring_order||0)-(b.circle_ring_order||0)),
        ...zoneRowsWithInner.filter((item)=>item.zone_type!=="circle").sort((a,b)=>a.name.localeCompare(b.name)),
      ];
      setZones(orderedZones);
      if (orderedZones[0]) setZone(orderedZones[0].id);
      if (user) {
        const { data: profile } = await supabase.from("profiles").select("phone").eq("id", user.id).maybeSingle();
        if (active && profile?.phone) setDeliveryPhone(profile.phone);
      }
      const savedKey = localStorage.getItem("shakh-checkout-key");
      if (savedKey) setIdempotencyKey(savedKey);
    }
    void load().catch(() => {
      if (active) { setMessage("نەتوانرا زانیاری سەبەتە باربکرێت."); setCartVerified(false); }
    });
    return () => { active = false; };
  }, []);

  const storeIds = Array.from(new Set(items.map((item) =>
    item.is_shakh_store || item.merchant_id === null ? "shakh_store" : item.merchant_id
  )));
  const storeGroups = storeIds.map((storeId) => {
    const groupItems = items.filter((item) =>
      (item.is_shakh_store || item.merchant_id === null ? "shakh_store" : item.merchant_id) === storeId
    );
    const merchantId = storeId === "shakh_store" ? null : storeId;
    return {
      storeId,
      merchantId,
      storeName: storeId === "shakh_store" ? "شاخ ستۆر" : merchantNames[storeId] || "فرۆشگای هاوبەش",
      items: groupItems,
      subtotal: groupItems.reduce((sum, item) => sum + item.price_iqd * item.quantity, 0),
    };
  });
  const subtotal = items.reduce((total, item) => total + item.price_iqd * item.quantity, 0);
  const referralIds = [...new Set(items.map((item) => item.referral_campaign_id).filter((id): id is string => !!id))];
  const referralCampaignId = referralIds.length === 1 ? referralIds[0] : null;
  const mixedReferrals = referralIds.length > 1;
  const deliveryFeePerStore = zones.find((item) => item.id === zone)?.delivery_fee_iqd || 0;
  const deliveryFee = deliveryFeePerStore * storeGroups.length;
  const total = subtotal + deliveryFee;

  function persist(next: CartItem[]) {
    setItems(next);
    localStorage.setItem("shakh-cart", JSON.stringify(next));
    window.dispatchEvent(new Event("shakh:cart-updated"));
  }

  function changeQuantity(item: CartItem, direction: -1 | 1) {
    const step = item.unit === "kg" ? 0.5 : 1;
    const nextQuantity = Math.max(0, Math.round((item.quantity + direction * step) * 1000) / 1000);
    update(item.product_id, item.variant_id, nextQuantity);
  }

  function update(id: string, variantId: string | undefined, quantity: number) {
    const item = items.find((value) => value.product_id === id && (value.variant_id || "") === (variantId || ""));
    if (!item) return;
    if (quantity > 0 && item.stock_quantity !== null && item.stock_quantity !== undefined && quantity > item.stock_quantity) {
      setMessage("ئەو بڕەی داوات کردووە لە کۆگا زیاترە.");
      return;
    }
    const next = items.map((value) => value.product_id === id && (value.variant_id || "") === (variantId || "")
      ? { ...value, quantity }
      : value).filter((value) => value.quantity > 0);
    persist(next);
  }

  function captureDeliveryLocation() {
    if (!navigator.geolocation) {
      setMessage("ئەم وێبگەڕە GPS پشتگیری ناکات. تکایە لە مۆبایل یان وێبگەڕێکی نوێتر هەوڵ بدەرەوە.");
      return;
    }
    setLocating(true);
    setMessage("");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const coordinates={latitude:position.coords.latitude,longitude:position.coords.longitude,accuracy:position.coords.accuracy};
        setDeliveryCoordinates(coordinates); setLocating(false);
        const selectedZone=zones.find((item)=>item.id===zone);
        if(!selectedZone)setMessage("زۆنی گەیاندن هەڵنەبژێردراوە.");
        else if(!zoneContainsPoint(selectedZone,coordinates.latitude,coordinates.longitude))setMessage("گەیاندن بۆ ئەم شوێنە بەردەست نییە؛ ئەم شوێنە لە دەرەوەی مەودای زۆنی هەڵبژێردراوە.");
        else setMessage("شوێنی GPS تۆمار کرا و لە ناو زۆنی گەیاندنە.");
      },
      (error) => {
        setLocating(false);
        setMessage(error.code === error.PERMISSION_DENIED
          ? "مۆڵەتی GPS ڕەتکرایەوە. لە ڕێکخستنەکانی وێبگەڕ مۆڵەتی شوێن چالاک بکە."
          : "نەتوانرا شوێنی GPS وەربگیرێت. دڵنیابە GPS چالاکە و دووبارە هەوڵ بدەرەوە.");
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  }

  async function checkout(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!items.length || !zone || !cartVerified) return;
    if (storeGroups.length > 2) { setMessage("لە یەک Checkout ـدا تەنها دەتوانیت لە دوو فرۆشگا بکڕیت."); return; }
    if (mixedReferrals) { setMessage("کاڵاکانی سەبەتەکەت بە چەند لینکی شێر و خەڵات زیاد کراون؛ تکایە تەنها یەک لینکی شێر و خەڵات بەکاربهێنە."); return; }
    if (deliveryAddress.trim().length < 8) { setMessage("ناونیشانی تەواوی گەیاندن بنووسە."); return; }
    if (deliveryPhone.replace(/\D/g, "").length < 7) { setMessage("ژمارەی تەلەفۆنی دروست بنووسە."); return; }
    const selectedZone=zones.find((item)=>item.id===zone);
    if(!deliveryCoordinates){setMessage("پێویستە سەرەتا بە دوکمەی «گەیاندنی شوێنی کڕیار بە GPS» شوێنی خۆت دیاری بکەیت.");return;}
    if(!selectedZone){setMessage("زۆنی گەیاندن هەڵنەبژێردراوە.");return;}
    if(!zoneContainsPoint(selectedZone,deliveryCoordinates.latitude,deliveryCoordinates.longitude)){setMessage("گەیاندن بۆ ئەم شوێنە بەردەست نییە؛ شوێنی GPS لە دەرەوەی مەودای زۆنی هەڵبژێردراوە.");return;}

    setBusy(true);
    setMessage("");
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        window.location.assign("/login?next=%2Fcart&intent=checkout");
        return;
      }

      const key = idempotencyKey || localStorage.getItem("shakh-checkout-key") || crypto.randomUUID();
      setIdempotencyKey(key);
      localStorage.setItem("shakh-checkout-key", key);

      const groups = storeGroups.map((group) => ({
        merchant_id: group.merchantId,
        items: group.items.map((item) => ({
          product_id: item.product_id,
          ...(item.variant_id ? { variant_id: item.variant_id } : {}),
          quantity: item.quantity,
        })),
      }));
      const { data, error } = await supabase.rpc("create_multi_store_orders_with_location_v1", {
        p_service_zone_id: zone,
        p_groups: groups,
        p_delivery_address: deliveryAddress.trim(),
        p_delivery_phone: deliveryPhone.trim(),
        p_delivery_notes: deliveryNotes.trim(),
        p_reward_campaign_id: referralCampaignId || undefined,
        p_idempotency_key: key,
        p_delivery_latitude: deliveryCoordinates?.latitude ?? null,
        p_delivery_longitude: deliveryCoordinates?.longitude ?? null,
      });
      if (error) throw error;
      const orderIds = (data || []) as string[];
      if (orderIds.length !== storeGroups.length) throw new Error("ژمارەی ئۆردەرەکان لە وەڵامی سیستەمدا ناتەواوە.");

      localStorage.removeItem("shakh-cart");
      window.dispatchEvent(new Event("shakh:cart-updated"));
      localStorage.removeItem("shakh-checkout-key");
      setIdempotencyKey("");
      setItems([]);
      setMessage("هەموو داواکارییەکان بە سەرکەوتوویی تۆمار کران: " +
        orderIds.map((orderId, index) => storeGroups[index]?.storeName + ": " + orderId).join(" · "));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "نەتوانرا داواکاری تۆمار بکرێت.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen px-4 py-8">
      <div className="mx-auto max-w-3xl">
        <div className="mb-5"><ShakhBrand size="sm" /></div>
        <Link href="/shop" className="font-bold text-shakh-blue">← گەڕانەوە بۆ بازاڕ</Link>
        <h1 className="mt-6 text-3xl font-black">سەبەتە و تەواوکردنی داواکاری</h1>
        {items.length === 0 ? (
          <div className="mt-6 rounded-2xl bg-white p-10 text-center">
            <p className="font-bold">سەبەتەکەت بەتاڵە</p>
            <Link href="/shop" className="mt-4 inline-block rounded-xl bg-shakh-orange px-5 py-3 font-bold text-white">بینینی کاڵاکان</Link>
          </div>
        ) : (
          <>
            <section className="mt-6 space-y-4">
              {storeGroups.map((group) => (
                <div key={group.storeId} className="rounded-2xl bg-white p-5 shadow-soft">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-3">
                    <h2 className="font-black text-shakh-blue">{group.storeName}</h2>
                    <span className="rounded-full bg-orange-50 px-3 py-1 text-xs font-bold text-shakh-orange">ئۆردەری سەربەخۆ</span>
                  </div>
                  {group.items.map((item) => (
                    <div key={`${item.product_id}:${item.variant_id || "base"}`} className="flex items-center justify-between gap-3 border-b py-3">
                      <div className="flex min-w-0 items-center gap-3">
                        {item.variant_image_path ? <img src={createClient().storage.from("product-images").getPublicUrl(item.variant_image_path).data.publicUrl} alt={item.variant_label || item.title} className="h-14 w-14 shrink-0 rounded-xl border bg-white object-contain p-1"/> : null}
                        <div className="min-w-0">
                        <b>{item.title}</b>
                        {item.variant_label && <p className="mt-1 text-xs font-bold text-shakh-blue">{item.variant_label}</p>}
                        <p className="text-sm text-shakh-orange">{item.price_iqd.toLocaleString("en-US")} د.ع / {unitLabels[item.unit || "piece"] || item.unit}</p>
                        {item.stock_quantity !== null && item.stock_quantity !== undefined && <p className="mt-1 text-xs text-slate-500">کۆگا: {item.stock_quantity.toLocaleString("en-US")}</p>}
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <button type="button" aria-label="کەمکردنەوەی بڕ" onClick={() => changeQuantity(item, -1)} className="h-9 w-9 rounded-lg bg-slate-100">−</button>
                        <b className="min-w-16 text-center">{item.quantity.toLocaleString("en-US", { maximumFractionDigits: 3 })} {unitLabels[item.unit || "piece"] || item.unit}</b>
                        <button type="button" aria-label="زیادکردنی بڕ" disabled={item.stock_quantity !== null && item.stock_quantity !== undefined && item.quantity + (item.unit === "kg" ? 0.5 : 1) > item.stock_quantity} onClick={() => changeQuantity(item, 1)} className="h-9 w-9 rounded-lg bg-slate-100 disabled:opacity-40">+</button>
                      </div>
                    </div>
                  ))}
                  <div className="mt-3 flex justify-between text-sm"><span>کۆی کاڵاکانی {group.storeName}</span><b>{group.subtotal.toLocaleString("en-US")} د.ع</b></div>
                  <div className="mt-2 flex justify-between text-sm"><span>کرێی گەیاندنی ئەم فرۆشگایە</span><b>{deliveryFeePerStore.toLocaleString("en-US")} د.ع</b></div>
                </div>
              ))}
              <div className="rounded-2xl bg-white p-5 shadow-soft">
                <div className="flex justify-between text-lg font-black"><span>کۆی کاڵاکان</span><span>{subtotal.toLocaleString("en-US")} د.ع</span></div>
                <p className="mt-2 text-xs text-slate-400">نرخ و کۆگا پێش Checkout نوێ و پشتڕاست دەکرێنەوە. بۆ هەر فرۆشگا ئۆردەر و کرێی گەیاندنی جیاواز هەژمار دەکرێت.</p>
              </div>
            </section>

            {isAuthenticated === false && (
              <section className="mt-5 rounded-2xl border border-blue-100 bg-blue-50 p-4">
                <p className="text-sm font-bold text-blue-900">بینین و زیادکردنی کاڵا بۆ سەبەتە بەبێ هەژمارە.</p>
                <p className="mt-1 text-sm leading-6 text-blue-800">بۆ ناردن و تۆمارکردنی داواکاری، پێویستە بچیتە ژوورەوە یان هەژماری نوێ دروست بکەیت. کاڵاکانی سەبەتەکەت دەمێننەوە.</p>
                <Link href="/login?next=%2Fcart&intent=checkout" className="mt-3 inline-flex min-h-11 items-center justify-center rounded-xl bg-shakh-blue px-4 py-2 text-sm font-bold text-white">چوونەژوورەوە / دروستکردنی هەژمار</Link>
              </section>
            )}
            <form onSubmit={checkout} className="mt-5 space-y-5">
              <section className="rounded-2xl bg-white p-5 shadow-soft">
                <h2 className="font-black">زانیاری گەیاندن</h2>
                <label className="mt-4 block text-sm font-bold">ناونیشانی تەواوی گەیاندن
                  <textarea required minLength={8} maxLength={500} rows={3} value={deliveryAddress} onChange={(event) => setDeliveryAddress(event.target.value)} placeholder="شار، گەڕەک، شەقام، کوڵان و ژمارەی خانوو..." className="mt-2 w-full rounded-xl border border-slate-200 p-3"/>
                </label>
                <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 rounded-lg bg-orange-100 p-2 text-shakh-orange"><MapPin size={18}/></span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold">شوێنی وردی گەیاندن لەسەر نەخشە</p>
                      <p className="mt-1 text-xs leading-6 text-slate-500">لە شوێنی گەیاندن بوەستە و GPS چالاک بکە؛ ئەم خاڵە بۆ ڕێگای کاپتن و Waze بەکاردێت.</p>
                      {deliveryCoordinates && <p className="mt-2 flex items-center gap-1 text-xs font-bold text-emerald-700"><CheckCircle2 size={14}/> GPS ±{Math.round(deliveryCoordinates.accuracy)} مەتر · {deliveryCoordinates.latitude.toFixed(5)}, {deliveryCoordinates.longitude.toFixed(5)}</p>}
                    </div>
                  </div>
                  {deliveryCoordinates && <iframe title="شوێنی کڕیار لەسەر نەخشە" className="mt-3 h-56 w-full rounded-xl border-0" loading="lazy" src={`https://www.openstreetmap.org/export/embed.html?bbox=${deliveryCoordinates.longitude-0.006},${deliveryCoordinates.latitude-0.004},${deliveryCoordinates.longitude+0.006},${deliveryCoordinates.latitude+0.004}&layer=mapnik&marker=${deliveryCoordinates.latitude},${deliveryCoordinates.longitude}`} />}
                  <button type="button" onClick={captureDeliveryLocation} disabled={locating} className="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-shakh-blue px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">
                    <LocateFixed size={17}/>{locating ? "وەرگرتنی شوێن..." : deliveryCoordinates ? "نوێکردنەوەی شوێنی گەیاندن بە GPS" : "گەیاندنی شوێنی کڕیار بە GPS"}
                  </button>
                </div>
                <label className="mt-4 block text-sm font-bold">ژمارەی تەلەفۆن بۆ پەیوەندی
                  <input required type="tel" minLength={7} maxLength={24} value={deliveryPhone} onChange={(event) => setDeliveryPhone(event.target.value)} placeholder="07xxxxxxxxx" className="mt-2 w-full rounded-xl border border-slate-200 p-3"/>
                </label>
                <label className="mt-4 block text-sm font-bold">تێبینی بۆ کاپتن (ئارەزوومەندانە)
                  <textarea maxLength={500} rows={2} value={deliveryNotes} onChange={(event) => setDeliveryNotes(event.target.value)} placeholder="نزیکترین نیشانە، کاتی گونجاو یان زانیاری زیادە..." className="mt-2 w-full rounded-xl border border-slate-200 p-3"/>
                </label>
              </section>

              <section className="rounded-2xl bg-white p-5 shadow-soft">
                <h2 className="font-black">زۆنی گەیاندن</h2>
                <select required value={zone} onChange={(event) => {
                  const nextZoneId=event.target.value;setZone(nextZoneId);const nextZone=zones.find((item)=>item.id===nextZoneId);
                  if(deliveryCoordinates){if(!nextZone)setMessage("زۆنی گەیاندن هەڵنەبژێردراوە.");else if(!zoneContainsPoint(nextZone,deliveryCoordinates.latitude,deliveryCoordinates.longitude))setMessage("گەیاندن بۆ ئەم شوێنە بەردەست نییە؛ لە دەرەوەی مەودای ئەم زۆنەیە.");else setMessage("شوێنی GPS لە ناو مەودای زۆنی هەڵبژێردراوە.");}
                }} className="mt-3 w-full rounded-xl border p-3">
                  <option value="">زۆن هەڵبژێرە</option>
                  {zones.map((item) => <option key={item.id} value={item.id}>{item.name}{item.zone_type==="circle"?` · ${(item.circle_inner_radius_m/1000).toFixed(2)}–${((item.circle_outer_radius_m||0)/1000).toFixed(2)} کم`:""} · {item.delivery_fee_iqd.toLocaleString("en-US")} د.ع</option>)}
                </select>
                {(() => {
                  const selected=zones.find((item)=>item.id===zone);
                  if(!selected)return null;
                  const configured=selected.zone_type==="circle"
                    ? selected.circle_center_latitude!==null&&selected.circle_center_longitude!==null&&selected.circle_outer_radius_m!==null
                    : selected.boundary_geojson!==null;
                  const inside=!!deliveryCoordinates&&zoneContainsPoint(selected,deliveryCoordinates.latitude,deliveryCoordinates.longitude);
                  return <p className={`mt-3 rounded-xl p-3 text-xs font-bold ${!configured?"bg-amber-50 text-amber-800":deliveryCoordinates&&inside?"bg-emerald-50 text-emerald-800":"bg-rose-50 text-rose-800"}`}>
                    {!configured?"سنووری ئەم زۆنە هێشتا لەلایەن سوپەر ئەدمینەوە دیاری نەکراوە.":!deliveryCoordinates?"شوێنی GPS دیاری بکە تا مەودای زۆنەکە بپشکنرێت.":inside?"شوێنی GPS لە ناو مەودای ئەم زۆنەیە.":"شوێنی GPS لە دەرەوەی مەودای ئەم زۆنەیە."}
                  </p>;
                })()}
                <div className="mt-4 rounded-xl bg-shakh-mist p-4">
                  <div className="flex justify-between text-sm"><span>کۆی کاڵاکان</span><b>{subtotal.toLocaleString("en-US")} د.ع</b></div>
                  <div className="mt-2 flex justify-between text-sm"><span>کۆی کرێی گەیاندن ({storeGroups.length} فرۆشگا)</span><b>{deliveryFee.toLocaleString("en-US")} د.ع</b></div>
                  <div className="mt-3 flex justify-between border-t pt-3 font-black"><span>کۆی گشتی</span><span>{total.toLocaleString("en-US")} د.ع</span></div>
                </div>
                <button type="submit" disabled={busy || !zone || storeGroups.length > 2 || mixedReferrals || !cartVerified} className="mt-4 w-full rounded-xl bg-shakh-orange px-4 py-3 font-bold text-white disabled:opacity-50">
                  {busy ? "تکایە چاوەڕێ بکە..." : !cartVerified ? "پشکنینی نرخ و کۆگا..." : isAuthenticated === false ? "چوونەژوورەوە بۆ ناردنی داواکاری" : "پشتڕاستکردنەوە و ناردنی داواکاری"}
                </button>
              </section>
            </form>
          </>
        )}
        {message && <p role="status" className="mt-4 rounded-xl bg-blue-50 p-4 text-sm text-blue-800">{message}</p>}
      </div>
    </main>
  );
}
