"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type CartItem = {
  product_id: string;
  title: string;
  price_iqd: number;
  merchant_id: string | null;
  quantity: number;
  unit?: string;
  stock_quantity?: number | null;
  is_shakh_store?: boolean;
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

type Zone = { id: string; name: string; delivery_fee_iqd: number };
type Campaign = { id: string; title: string; reward_amount_iqd: number };

const unitLabels: Record<string, string> = {
  piece: "دانە", kg: "کیلۆگرام", g: "گرام", liter: "لیتر", pack: "پاکەت", box: "کارتۆن",
};

export default function CartPage() {
  const [items, setItems] = useState<CartItem[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [zone, setZone] = useState("");
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [campaign, setCampaign] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [deliveryPhone, setDeliveryPhone] = useState("");
  const [deliveryNotes, setDeliveryNotes] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [cartVerified, setCartVerified] = useState(false);
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

        if (!active) return;
        if (error) {
          setItems(saved);
          setMessage("نەتوانرا نرخ و کۆگای نوێ پشتڕاست بکرێتەوە؛ تکایە پەیوەندی ئینتەرنێت بپشکنە.");
          setCartVerified(false);
        } else {
          const productMap: Record<string, ProductSnapshot> = Object.fromEntries(
            (data || []).map((product) => [product.id, product as ProductSnapshot])
          );
          let removed = 0;
          let adjusted = false;
          const refreshed = saved.flatMap((item) => {
            const product = productMap[item.product_id];
            if (!product || !product.is_available || product.stock_quantity === 0) {
              removed += 1;
              return [];
            }
            const quantity = product.stock_quantity === null
              ? item.quantity
              : Math.min(item.quantity, product.stock_quantity);
            if (quantity !== item.quantity) adjusted = true;
            return [{
              ...item,
              title: product.title,
              price_iqd: product.price_iqd,
              merchant_id: product.merchant_id,
              unit: product.unit,
              stock_quantity: product.stock_quantity,
              is_shakh_store: product.is_shakh_store,
              quantity,
            }];
          });
          setItems(refreshed);
          localStorage.setItem("shakh-cart", JSON.stringify(refreshed));
          if (removed > 0 || adjusted) setMessage("هەندێک کاڵا یان بڕی کۆگا نوێکرایەوە؛ سەبەتەکەت نوێ کراوەتەوە.");
          setCartVerified(true);
        }
      } else {
        setCartVerified(true);
      }

      const [{ data: { user } }, zoneResult, campaignResult] = await Promise.all([
        supabase.auth.getUser(),
        supabase.from("service_zones").select("id,name,delivery_fee_iqd").eq("is_active", true).order("name"),
        supabase.from("reward_campaigns").select("id,title,reward_amount_iqd").eq("is_active", true),
      ]);
      if (!active) return;
      setZones(zoneResult.data || []);
      if (zoneResult.data?.[0]) setZone(zoneResult.data[0].id);
      setCampaigns(campaignResult.data || []);
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
  const merchantId = items[0]?.is_shakh_store || items[0]?.merchant_id === null
    ? null
    : items[0]?.merchant_id || null;
  const mixed = storeIds.length > 1;
  const subtotal = items.reduce((total, item) => total + item.price_iqd * item.quantity, 0);
  const selectedCampaign = campaigns.find((item) => item.id === campaign);
  const deliveryFee = zones.find((item) => item.id === zone)?.delivery_fee_iqd || 0;
  const total = subtotal + deliveryFee + (selectedCampaign?.reward_amount_iqd || 0);

  function persist(next: CartItem[]) {
    setItems(next);
    localStorage.setItem("shakh-cart", JSON.stringify(next));
  }

  function update(id: string, quantity: number) {
    const item = items.find((value) => value.product_id === id);
    if (!item) return;
    if (quantity > 0 && item.stock_quantity !== null && item.stock_quantity !== undefined && quantity > item.stock_quantity) {
      setMessage("ئەو بڕەی داوات کردووە لە کۆگا زیاترە.");
      return;
    }
    const next = items.map((value) => value.product_id === id ? { ...value, quantity } : value).filter((value) => value.quantity > 0);
    persist(next);
  }

  async function checkout(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!items.length || !zone || !cartVerified) return;
    if (mixed) { setMessage("سەبەتەکەت کاڵای زیاتر لە یەک فرۆشیاری تێدایە. تکایە هەر جار لە یەک فرۆشگا داوا بکە."); return; }
    if (storeIds.length !== 1) { setMessage("تکایە لە یەک فرۆشگا داواکاری بکە."); return; }
    if (deliveryAddress.trim().length < 8) { setMessage("ناونیشانی تەواوی گەیاندن بنووسە."); return; }
    if (deliveryPhone.replace(/\D/g, "").length < 7) { setMessage("ژمارەی تەلەفۆنی دروست بنووسە."); return; }

    setBusy(true);
    setMessage("");
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { window.location.href = "/login"; return; }

      const key = idempotencyKey || localStorage.getItem("shakh-checkout-key") || crypto.randomUUID();
      setIdempotencyKey(key);
      localStorage.setItem("shakh-checkout-key", key);

      const orderItems = items.map((item) => ({ product_id: item.product_id, quantity: item.quantity }));
      const commonArgs = {
        p_service_zone_id: zone,
        p_items: orderItems,
        p_delivery_address: deliveryAddress.trim(),
        p_delivery_phone: deliveryPhone.trim(),
        p_delivery_notes: deliveryNotes.trim(),
        p_reward_campaign_id: campaign || undefined,
        p_reward_amount_iqd: selectedCampaign?.reward_amount_iqd || 0,
        p_idempotency_key: key,
      };

      let orderId: string;
      if (storeIds[0] === "shakh_store") {
        const { data, error } = await supabase.rpc("create_shakh_store_order_v2", commonArgs);
        if (error) throw error;
        orderId = data;
      } else {
        if (!merchantId) throw new Error("فرۆشگا دیاری نەکراوە.");
        const { data, error } = await supabase.rpc("create_order_v2", {
          ...commonArgs,
          p_merchant_id: merchantId,
        });
        if (error) throw error;
        orderId = data;
      }

      localStorage.removeItem("shakh-cart");
      localStorage.removeItem("shakh-checkout-key");
      setIdempotencyKey("");
      setItems([]);
      setMessage("داواکارییەکەت بە سەرکەوتوویی تۆمار کرا. ژمارەی داواکاری: " + orderId);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "نەتوانرا داواکاری تۆمار بکرێت.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen px-4 py-8">
      <div className="mx-auto max-w-3xl">
        <Link href="/shop" className="font-bold text-shakh-blue">← گەڕانەوە بۆ بازاڕ</Link>
        <h1 className="mt-6 text-3xl font-black">سەبەتە و تەواوکردنی داواکاری</h1>
        {items.length === 0 ? (
          <div className="mt-6 rounded-2xl bg-white p-10 text-center">
            <p className="font-bold">سەبەتەکەت بەتاڵە</p>
            <Link href="/shop" className="mt-4 inline-block rounded-xl bg-shakh-orange px-5 py-3 font-bold text-white">بینینی کاڵاکان</Link>
          </div>
        ) : (
          <>
            <section className="mt-6 rounded-2xl bg-white p-5 shadow-soft">
              {items.map((item) => (
                <div key={item.product_id} className="flex items-center justify-between gap-3 border-b py-3">
                  <div className="min-w-0">
                    <b>{item.title}</b>
                    <p className="text-sm text-shakh-orange">{item.price_iqd.toLocaleString("en-US")} د.ع / {unitLabels[item.unit || "piece"] || item.unit}</p>
                    {item.stock_quantity !== null && item.stock_quantity !== undefined && <p className="mt-1 text-xs text-slate-500">کۆگا: {item.stock_quantity.toLocaleString("en-US")}</p>}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <button onClick={() => update(item.product_id, item.quantity - 1)} className="h-9 w-9 rounded-lg bg-slate-100">−</button>
                    <b>{item.quantity}</b>
                    <button disabled={item.stock_quantity !== null && item.stock_quantity !== undefined && item.quantity >= item.stock_quantity} onClick={() => update(item.product_id, item.quantity + 1)} className="h-9 w-9 rounded-lg bg-slate-100 disabled:opacity-40">+</button>
                  </div>
                </div>
              ))}
              <div className="flex justify-between pt-4 text-lg font-black"><span>کۆی کاڵاکان</span><span>{subtotal.toLocaleString("en-US")} د.ع</span></div>
              <p className="mt-2 text-xs text-slate-400">نرخ و کۆگا پێش Checkout نوێ و پشتڕاست دەکرێنەوە.</p>
            </section>

            <form onSubmit={checkout} className="mt-5 space-y-5">
              <section className="rounded-2xl bg-white p-5 shadow-soft">
                <h2 className="font-black">زانیاری گەیاندن</h2>
                <label className="mt-4 block text-sm font-bold">ناونیشانی تەواوی گەیاندن
                  <textarea required minLength={8} maxLength={500} rows={3} value={deliveryAddress} onChange={(event) => setDeliveryAddress(event.target.value)} placeholder="شار، گەڕەک، شەقام، کوڵان و ژمارەی خانوو..." className="mt-2 w-full rounded-xl border border-slate-200 p-3"/>
                </label>
                <label className="mt-4 block text-sm font-bold">ژمارەی تەلەفۆن بۆ پەیوەندی
                  <input required type="tel" minLength={7} maxLength={24} value={deliveryPhone} onChange={(event) => setDeliveryPhone(event.target.value)} placeholder="07xxxxxxxxx" className="mt-2 w-full rounded-xl border border-slate-200 p-3"/>
                </label>
                <label className="mt-4 block text-sm font-bold">تێبینی بۆ کپتن (ئارەزوومەندانە)
                  <textarea maxLength={500} rows={2} value={deliveryNotes} onChange={(event) => setDeliveryNotes(event.target.value)} placeholder="نزیکترین نیشانە، کاتی گونجاو یان زانیاری زیادە..." className="mt-2 w-full rounded-xl border border-slate-200 p-3"/>
                </label>
              </section>

              <section className="rounded-2xl bg-white p-5 shadow-soft">
                <h2 className="font-black">زۆنی گەیاندن</h2>
                <select required value={zone} onChange={(event) => setZone(event.target.value)} className="mt-3 w-full rounded-xl border p-3">
                  <option value="">زۆن هەڵبژێرە</option>
                  {zones.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.delivery_fee_iqd.toLocaleString("en-US")} د.ع</option>)}
                </select>
                <label className="mt-4 block text-sm font-bold">شێرو خەلات (ئارەزوومەندانە)
                  <select value={campaign} onChange={(event) => setCampaign(event.target.value)} className="mt-2 w-full rounded-xl border p-3">
                    <option value="">بێ شێرو خەلات</option>
                    {campaigns.map((item) => <option key={item.id} value={item.id}>{item.title} · {item.reward_amount_iqd.toLocaleString("en-US")} د.ع</option>)}
                  </select>
                </label>
                <div className="mt-4 rounded-xl bg-shakh-mist p-4">
                  <div className="flex justify-between text-sm"><span>کۆی کاڵاکان</span><b>{subtotal.toLocaleString("en-US")} د.ع</b></div>
                  <div className="mt-2 flex justify-between text-sm"><span>گەیاندن</span><b>{deliveryFee.toLocaleString("en-US")} د.ع</b></div>
                  {selectedCampaign && <div className="mt-2 flex justify-between text-sm"><span>شێرو خەلات: {selectedCampaign.title}</span><b>{selectedCampaign.reward_amount_iqd.toLocaleString("en-US")} د.ع</b></div>}
                  <div className="mt-3 flex justify-between border-t pt-3 font-black"><span>کۆی گشتی</span><span>{total.toLocaleString("en-US")} د.ع</span></div>
                </div>
                <button type="submit" disabled={busy || !zone || mixed || !cartVerified} className="mt-4 w-full rounded-xl bg-shakh-orange px-4 py-3 font-bold text-white disabled:opacity-50">
                  {busy ? "تکایە چاوەڕێ بکە..." : !cartVerified ? "پشکنینی نرخ و کۆگا..." : "پشتڕاستکردنەوە و ناردنی داواکاری"}
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
