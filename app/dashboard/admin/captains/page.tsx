"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Enums } from "@/lib/supabase/database.types";
import { MapPin, Phone, Package, RefreshCw } from "lucide-react";

type Order = {
  id: string;
  status: string;
  merchant_id: string | null;
  placed_at: string;
  delivery_address: string | null;
  delivery_phone: string | null;
  delivery_notes: string | null;
  subtotal_iqd: number;
  delivery_fee_iqd: number;
};

type Captain = {
  user_id: string;
  captain_type: Enums<"captain_type">;
  merchant_id: string | null;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  is_available: boolean;
};

type Item = { id: string; order_id: string; product_title_snapshot: string; quantity: number };

const captainTypeLabel = (captain: Captain) =>
  captain.captain_type === "shakh" ? "کاپتنی شاخ" : "کاپتنی تایبەت بە دوکان";

export default function CaptainsPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [captains, setCaptains] = useState<Captain[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [merchantNames, setMerchantNames] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const [busyId, setBusyId] = useState("");

  const load = useCallback(async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { window.location.href = "/login"; return; }
    const { data: admin, error: adminError } = await supabase.from("profiles").select("role").eq("id", user.id).single();
    if (adminError) throw adminError;
    if (admin?.role !== "super_admin") { window.location.href = "/dashboard"; return; }

    const [orderResult, captainResult] = await Promise.all([
      supabase.from("orders")
        .select("id,status,merchant_id,placed_at,delivery_address,delivery_phone,delivery_notes,subtotal_iqd,delivery_fee_iqd")
        .eq("status", "ready_for_pickup").order("placed_at"),
      supabase.from("captain_profiles")
        .select("user_id,captain_type,merchant_id,is_available").eq("is_active", true),
    ]);
    if (orderResult.error) throw orderResult.error;
    if (captainResult.error) throw captainResult.error;

    const userIds = [...new Set((captainResult.data || []).map((captain) => captain.user_id))];
    const profileResult = userIds.length
      ? await supabase.from("profiles").select("id,full_name,email,phone").in("id", userIds).eq("role", "captain").eq("is_active", true)
      : { data: [], error: null };
    if (profileResult.error) throw profileResult.error;
    const profileMap = Object.fromEntries((profileResult.data || []).map((profile) => [profile.id, profile]));
    setCaptains((captainResult.data || []).filter((captain) => !!profileMap[captain.user_id])
      .map((captain) => ({ ...captain, ...profileMap[captain.user_id] })));
    
    const rows = orderResult.data || [];
    setOrders(rows);
    const ids = rows.map((order) => order.id);
    const merchantIds = [...new Set(rows.map((order) => order.merchant_id).filter((id): id is string => !!id))];
    const [itemResult, merchantResult] = await Promise.all([
      ids.length
        ? supabase.from("order_items").select("id,order_id,product_title_snapshot,quantity").in("order_id", ids)
        : Promise.resolve({ data: [], error: null }),
      merchantIds.length
        ? supabase.from("merchant_profiles").select("id,business_name").in("id", merchantIds)
        : Promise.resolve({ data: [], error: null }),
    ]);
    if (itemResult.error) throw itemResult.error;
    if (merchantResult.error) throw merchantResult.error;
    setItems(itemResult.data || []);
    setMerchantNames(Object.fromEntries((merchantResult.data || []).map((merchant) => [merchant.id, merchant.business_name])));
  }, []);

  useEffect(() => {
    let active = true;
    const supabase = createClient();
    void load().catch(() => { if (active) setMessage("نەتوانرا زانیاری باربکرێت."); });
    const channel = supabase.channel("shakh-admin-dispatch")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => {
        if (active) void load().catch(() => setMessage("نوێکردنەوەی داواکاری سەرکەوتوو نەبوو."));
      })
      .subscribe();
    return () => { active = false; void supabase.removeChannel(channel); };
  }, [load]);

  async function assign(orderId: string, captainId: string) {
    if (!captainId) return;
    setBusyId(orderId);
    const { error } = await createClient().rpc("admin_assign_captain", {
      p_order_id: orderId,
      p_captain_user_id: captainId,
    });
    setBusyId("");
    setMessage(error?.message || "کاپتن بۆ ئەم داواکارییە دیاریکرا و ئاگادار کرا.");
    if (!error) await load();
  }

  return (
    <main className="min-h-screen px-4 py-8">
      <div className="mx-auto max-w-5xl">
        <Link href="/dashboard/admin" className="font-bold text-shakh-blue">← سوپەر ئەدمین</Link>
        <div className="mt-6 flex flex-wrap items-end justify-between gap-3">
          <div><h1 className="text-3xl font-black">دیاریکردنی کاپتن</h1><p className="mt-2 text-sm text-slate-500">کاپتنی شاخ بۆ هەموو دوکانەکانە؛ کاپتنی تایبەت تەنها بۆ دوکانی خۆیەتی.</p></div>
          <button onClick={() => void load()} className="inline-flex items-center gap-2 rounded-xl border bg-white px-4 py-2 text-sm font-bold"><RefreshCw size={15}/> نوێکردنەوە</button>
        </div>
        {message && <p role="status" className="mt-4 rounded-xl bg-blue-50 p-3 text-sm text-blue-800">{message}</p>}

        <section className="mt-6 rounded-2xl bg-white p-5 shadow-soft">
          <h2 className="text-lg font-black">کاپتنەکان و زانیاری ناسنامە</h2>
          {captains.length === 0 ? <p className="mt-3 text-sm text-slate-500">هیچ کاپتنێکی چالاک نییە.</p> : (
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {captains.map((captain) => (
                <div key={captain.user_id} className="rounded-xl border border-slate-100 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <b>{captain.full_name || "بێ ناو"}</b>
                    <span className={`rounded-full px-2 py-1 text-xs font-bold ${captain.is_available ? "bg-green-50 text-green-700" : "bg-slate-100 text-slate-600"}`}>{captain.is_available ? "بەردەست" : "ناچالاک"}</span>
                  </div>
                  <p className="mt-2 text-xs text-slate-500">Captain ID: <span dir="ltr" className="font-mono">{captain.user_id.slice(0, 8).toUpperCase()}</span></p>
                  {captain.phone && <p className="mt-1 text-sm" dir="ltr">{captain.phone}</p>}
                  <p className="mt-1 text-xs text-slate-500">{captain.email || "—"} · {captainTypeLabel(captain)}</p>
                </div>
              ))}
            </div>
          )}
        </section>

        {orders.map((order) => {
          const eligible = captains.filter((captain) =>
            captain.captain_type === "shakh" ||
            (captain.captain_type === "merchant" && captain.merchant_id === order.merchant_id)
          );
          const orderItems = items.filter((item) => item.order_id === order.id);
          return (
            <article key={order.id} className="mt-5 overflow-hidden rounded-2xl bg-white shadow-soft">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b p-5">
                <div><p className="text-xs text-slate-400">داواکاری</p><b className="font-mono">{order.id.slice(0, 8).toUpperCase()}</b></div>
                <span className="rounded-full bg-orange-50 px-3 py-1 text-sm font-bold text-orange-700">ئامادەی وەرگرتنی کاپتنە</span>
              </div>
              <div className="grid gap-4 p-5 md:grid-cols-[1fr_280px]">
                <div>
                  <p className="text-sm font-bold">{order.merchant_id ? merchantNames[order.merchant_id] || "دوکانی هاوبەش" : "شاخ ستۆر"}</p>
                  <p className="mt-1 text-xs text-slate-400">{new Date(order.placed_at).toLocaleString("ckb-IQ")}</p>
                  <div className="mt-3 rounded-xl bg-slate-50 p-4">
                    <p className="flex items-start gap-2 text-sm"><MapPin size={16} className="mt-0.5 shrink-0 text-shakh-orange"/>{order.delivery_address || "ناونیشانی گەیاندن تۆمار نەکراوە"}</p>
                    {order.delivery_phone && <p className="mt-2 flex items-center gap-2 text-sm"><Phone size={15} className="text-shakh-blue"/><a href={`tel:${order.delivery_phone}`} dir="ltr">{order.delivery_phone}</a></p>}
                    {order.delivery_notes && <p className="mt-2 text-sm text-slate-600">تێبینی: {order.delivery_notes}</p>}
                  </div>
                  <p className="mt-4 flex items-center gap-2 text-sm font-black"><Package size={16}/> کاڵاکان</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {orderItems.map((item) => <span key={item.id} className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs">{item.product_title_snapshot} × {item.quantity}</span>)}
                  </div>
                  <p className="mt-4 text-sm text-slate-500">کۆی کاڵا: {order.subtotal_iqd.toLocaleString("en-US")} د.ع · گەیاندن: {order.delivery_fee_iqd.toLocaleString("en-US")} د.ع</p>
                </div>
                <aside className="rounded-xl bg-shakh-mist p-4">
                  <p className="font-black">کاپتنی شیاو هەڵبژێرە</p>
                  <select disabled={busyId === order.id || eligible.length === 0} defaultValue="" onChange={(event) => void assign(order.id, event.target.value)} className="mt-3 w-full rounded-xl border bg-white p-3 text-sm">
                    <option value="">کاپتن هەڵبژێرە</option>
                    {eligible.map((captain) => (
                      <option key={captain.user_id} value={captain.user_id}>
                        {captain.full_name || captain.email || captain.user_id} — {captainTypeLabel(captain)}
                      </option>
                    ))}
                  </select>
                  {busyId === order.id && <p className="mt-2 text-xs text-slate-500">دیاریکردن...</p>}
                  {eligible.length === 0 && <p className="mt-2 text-sm text-amber-700">کاپتنێکی چالاک و شیاو بۆ ئەم دوکانە نییە.</p>}
                </aside>
              </div>
            </article>
          );
        })}
        {orders.length === 0 && <p className="mt-6 rounded-2xl bg-white p-9 text-center text-slate-500">داواکاری ئامادەی گەیاندن نییە.</p>}
      </div>
    </main>
  );
}
