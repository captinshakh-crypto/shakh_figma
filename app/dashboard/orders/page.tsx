"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { MapPin, Phone, Package, Clock3, CheckCircle2, XCircle, Truck, RefreshCw } from "lucide-react";

type Order = {
  id: string;
  customer_id: string;
  merchant_id: string | null;
  captain_user_id: string | null;
  service_zone_id: string | null;
  status: string;
  subtotal_iqd: number;
  delivery_fee_iqd: number;
  platform_delivery_share_iqd: number;
  captain_delivery_share_iqd: number;
  total_iqd: number | null;
  reward_amount_iqd: number;
  placed_at: string;
  delivery_address: string | null;
  delivery_phone: string | null;
  delivery_notes: string | null;
  settled_at: string | null;
};

type OrderItem = {
  id: string;
  order_id: string;
  product_title_snapshot: string;
  quantity: number;
  unit_price_iqd: number;
  line_total_iqd: number;
};

type History = {
  id: string;
  order_id: string;
  from_status: string | null;
  to_status: string;
  actor_role: string;
  note: string | null;
  created_at: string;
};

const statusLabels: Record<string, string> = {
  placed: "نێردرا و چاوەڕوانی دوکانە",
  accepted: "لە لایەن دوکانەوە پەسەند کرا",
  rejected: "داواکاری ڕەتکرایەوە",
  preparing: "دوکان ئامادەی دەکات",
  ready_for_pickup: "ئامادەی وەرگرتنی کپتنە",
  assigned: "کپتن دیاریکرا",
  picked_up: "کپتن داواکارییەکەی وەرگرت",
  delivered: "گەیەنرا",
  cancelled: "هەڵوەشێنرایەوە",
};

const actionLabels: Record<string, string> = {
  accepted: "پەسەندکردن",
  rejected: "ڕەتکردنەوە",
  preparing: "دەستکردن بە ئامادەکردن",
  ready_for_pickup: "ئامادەی وەرگرتنە",
  picked_up: "وەرگرتنی داواکاری",
  delivered: "گەیاندن تەواو بوو",
  cancelled: "هەڵوەشاندنەوە",
};

const allStatuses = ["placed", "accepted", "preparing", "ready_for_pickup", "assigned", "picked_up", "delivered"];
const formatIQD = (value: number) => value.toLocaleString("en-US") + " د.ع";

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [items, setItems] = useState<OrderItem[]>([]);
  const [history, setHistory] = useState<History[]>([]);
  const [merchantNames, setMerchantNames] = useState<Record<string, string>>({});
  const [zoneNames, setZoneNames] = useState<Record<string, string>>({});
  const [role, setRole] = useState("");
  const [busyId, setBusyId] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { window.location.href = "/login"; return; }

    const { data: profile, error: profileError } = await supabase.from("profiles")
      .select("role").eq("id", user.id).single();
    if (profileError) throw profileError;
    const currentRole = profile.role || "";
    setRole(currentRole);

    let query = supabase.from("orders").select(
      "id,customer_id,merchant_id,captain_user_id,service_zone_id,status,subtotal_iqd,delivery_fee_iqd,platform_delivery_share_iqd,captain_delivery_share_iqd,total_iqd,reward_amount_iqd,placed_at,delivery_address,delivery_phone,delivery_notes,settled_at"
    ).order("placed_at", { ascending: false }).limit(100);

    if (currentRole === "customer") {
      query = query.eq("customer_id", user.id);
    } else if (currentRole === "captain") {
      query = query.eq("captain_user_id", user.id);
    } else if (["supermarket", "restaurant", "butcher_poultry", "grocery"].includes(currentRole)) {
      const { data: merchant, error: merchantError } = await supabase.from("merchant_profiles")
        .select("id").eq("user_id", user.id).maybeSingle();
      if (merchantError) throw merchantError;
      if (!merchant) {
        setOrders([]); setItems([]); setHistory([]); setLoading(false); return;
      }
      query = query.eq("merchant_id", merchant.id);
    } else if (currentRole !== "super_admin") {
      setOrders([]); setItems([]); setHistory([]); setLoading(false); return;
    }

    const { data: orderData, error: orderError } = await query;
    if (orderError) throw orderError;
    const rows = (orderData || []) as Order[];
    setOrders(rows);

    const orderIds = rows.map((order) => order.id);
    const merchantIds = [...new Set(rows.map((order) => order.merchant_id).filter((id): id is string => !!id))];
    const zoneIds = [...new Set(rows.map((order) => order.service_zone_id).filter((id): id is string => !!id))];

    if (orderIds.length === 0) {
      setItems([]); setHistory([]); setMerchantNames({}); setZoneNames({}); setLoading(false); return;
    }

    const [itemResult, historyResult, merchantResult, zoneResult] = await Promise.all([
      supabase.from("order_items").select("id,order_id,product_title_snapshot,quantity,unit_price_iqd,line_total_iqd").in("order_id", orderIds),
      supabase.from("order_status_history").select("id,order_id,from_status,to_status,actor_role,note,created_at").in("order_id", orderIds).order("created_at"),
      merchantIds.length ? supabase.from("merchant_profiles").select("id,business_name").in("id", merchantIds) : Promise.resolve({ data: [], error: null }),
      zoneIds.length ? supabase.from("service_zones").select("id,name").in("id", zoneIds) : Promise.resolve({ data: [], error: null }),
    ]);
    if (itemResult.error) throw itemResult.error;
    if (historyResult.error) throw historyResult.error;
    if (merchantResult.error) throw merchantResult.error;
    if (zoneResult.error) throw zoneResult.error;

    setItems(itemResult.data || []);
    setHistory(historyResult.data || []);
    setMerchantNames(Object.fromEntries((merchantResult.data || []).map((merchant) => [merchant.id, merchant.business_name])));
    setZoneNames(Object.fromEntries((zoneResult.data || []).map((zone) => [zone.id, zone.name])));
    setLoading(false);
  }, []);

  useEffect(() => {
    let active = true;
    const supabase = createClient();
    void load().catch(() => { if (active) { setMessage("نەتوانرا داواکارییەکان باربکرێن."); setLoading(false); } });
    const channel = supabase.channel("shakh-order-tracking")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => {
        if (active) void load().catch(() => setMessage("نوێکردنەوەی داواکاری سەرکەوتوو نەبوو."));
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "order_status_history" }, () => {
        if (active) void load().catch(() => setMessage("نوێکردنەوەی مێژووی داواکاری سەرکەوتوو نەبوو."));
      })
      .subscribe();
    return () => {
      active = false;
      void supabase.removeChannel(channel);
    };
  }, [load]);

  async function changeStatus(orderId: string, status: string) {
    setBusyId(orderId);
    setMessage("");
    const { error } = await createClient().rpc("update_order_status", {
      p_order_id: orderId,
      p_status: status,
    });
    setBusyId("");
    if (error) setMessage(error.message);
    else setMessage("دۆخی داواکاری نوێ کرایەوە.");
    await load();
  }

  function allowedActions(order: Order) {
    if (role === "customer" && order.status === "placed") return ["cancelled"];
    if (["supermarket", "restaurant", "butcher_poultry", "grocery"].includes(role)) {
      if (order.status === "placed") return ["accepted", "rejected"];
      if (order.status === "accepted") return ["preparing"];
      if (order.status === "preparing") return ["ready_for_pickup"];
    }
    if (role === "captain" && order.status === "assigned") return ["picked_up"];
    if (role === "captain" && order.status === "picked_up") return ["delivered"];
    if (role === "super_admin") {
      if (order.status === "placed") return ["accepted", "rejected", "cancelled"];
      if (order.status === "accepted") return ["preparing", "cancelled"];
      if (order.status === "preparing" || order.status === "ready_for_pickup") return ["cancelled", ...(order.status === "preparing" ? ["ready_for_pickup"] : [])];
    }
    return [];
  }

  const pageTitle = role === "customer" ? "داواکارییەکانم"
    : role === "captain" ? "داواکارییەکانی گەیاندن"
    : role === "super_admin" ? "هەموو داواکارییەکان"
    : "داواکارییەکانی دوکان";

  return (
    <main className="min-h-screen px-4 py-8">
      <div className="mx-auto max-w-5xl">
        <Link href={role === "super_admin" ? "/dashboard/admin" : "/dashboard"} className="font-bold text-shakh-blue">← داشبۆرد</Link>
        <div className="mt-6 flex flex-wrap items-end justify-between gap-3">
          <div><h1 className="text-3xl font-black">{pageTitle}</h1><p className="mt-2 text-sm text-slate-500">دۆخ و مێژووی داواکارییەکان بە شێوەی نوێکراوە.</p></div>
          <button onClick={() => void load()} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold"><RefreshCw size={15}/> نوێکردنەوە</button>
        </div>

        {message && <p role="status" className="mt-4 rounded-xl bg-blue-50 p-3 text-sm text-blue-800">{message}</p>}

        {loading ? <p className="mt-6 text-slate-500">بارکردنی داواکارییەکان...</p> : orders.length === 0 ? (
          <div className="mt-6 rounded-2xl bg-white p-10 text-center text-slate-500">هێشتا هیچ داواکارییەک نییە.</div>
        ) : (
          <div className="mt-6 space-y-5">
            {orders.map((order) => {
              const orderItems = items.filter((item) => item.order_id === order.id);
              const events = history.filter((entry) => entry.order_id === order.id);
              const actions = allowedActions(order);
              return (
                <article key={order.id} className="overflow-hidden rounded-2xl bg-white shadow-soft">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-5">
                    <div><p className="text-xs text-slate-400">ژمارەی داواکاری</p><b className="font-mono text-sm">{order.id.slice(0, 8).toUpperCase()}</b></div>
                    <span className={`rounded-full px-3 py-1.5 text-sm font-bold ${["delivered","accepted"].includes(order.status) ? "bg-green-50 text-green-700" : ["rejected","cancelled"].includes(order.status) ? "bg-red-50 text-red-700" : "bg-orange-50 text-orange-700"}`}>{statusLabels[order.status] || order.status}</span>
                  </div>

                  <div className="grid gap-4 p-5 md:grid-cols-[1fr_260px]">
                    <div className="min-w-0">
                      <div className="flex flex-wrap gap-3 text-xs text-slate-500">
                        <span>{new Date(order.placed_at).toLocaleString("ckb-IQ")}</span>
                        <span>{order.merchant_id ? merchantNames[order.merchant_id] || "دوکانی هاوبەش" : "شاخ ستۆر"}</span>
                        {order.service_zone_id && <span>زۆن: {zoneNames[order.service_zone_id] || "—"}</span>}
                      </div>
                      <h2 className="mt-4 font-black">کاڵاکان</h2>
                      <div className="mt-2 divide-y divide-slate-100 rounded-xl border border-slate-100">
                        {orderItems.map((item) => (
                          <div key={item.id} className="flex justify-between gap-3 p-3 text-sm">
                            <span>{item.product_title_snapshot} × {item.quantity}</span>
                            <b>{formatIQD(item.line_total_iqd)}</b>
                          </div>
                        ))}
                      </div>

                      <div className="mt-4 grid gap-2 rounded-xl bg-slate-50 p-4 text-sm">
                        <div className="flex items-start gap-2"><MapPin size={17} className="mt-0.5 shrink-0 text-shakh-orange"/><span>{order.delivery_address || "ناونیشانی گەیاندن تۆمار نەکراوە"}</span></div>
                        {order.delivery_phone && <div className="flex items-center gap-2"><Phone size={16} className="text-shakh-blue"/><a href={`tel:${order.delivery_phone}`} dir="ltr">{order.delivery_phone}</a></div>}
                        {order.delivery_notes && <p className="text-slate-600">تێبینی: {order.delivery_notes}</p>}
                      </div>

                      <h3 className="mt-5 flex items-center gap-2 font-black"><Clock3 size={17}/> مێژووی داواکاری</h3>
                      <ol className="mt-3 space-y-3 border-r-2 border-slate-200 pr-4">
                        {events.map((event) => (
                          <li key={event.id} className="relative">
                            <span className="absolute -right-[21px] top-1 h-3 w-3 rounded-full bg-shakh-orange ring-4 ring-white"/>
                            <p className="text-sm font-bold">{statusLabels[event.to_status] || event.to_status}</p>
                            <p className="mt-0.5 text-xs text-slate-400">{new Date(event.created_at).toLocaleString("ckb-IQ")}</p>
                          </li>
                        ))}
                      </ol>
                    </div>

                    <aside className="rounded-xl bg-shakh-mist p-4">
                      <h3 className="font-black">کورتەی پارە</h3>
                      <div className="mt-3 space-y-2 text-sm">
                        <div className="flex justify-between"><span>کۆی کاڵاکان</span><b>{formatIQD(order.subtotal_iqd)}</b></div>
                        <div className="flex justify-between"><span>گەیاندن</span><b>{formatIQD(order.delivery_fee_iqd)}</b></div>
                        {order.reward_amount_iqd > 0 && <div className="flex justify-between"><span>شێرو خەلات</span><b>{formatIQD(order.reward_amount_iqd)}</b></div>}
                        <div className="flex justify-between border-t border-slate-200 pt-3 font-black"><span>کۆی گشتی</span><span>{formatIQD(order.total_iqd || order.subtotal_iqd + order.delivery_fee_iqd)}</span></div>
                      </div>
                      {order.settled_at && <p className="mt-3 flex items-center gap-2 text-xs font-bold text-green-700"><CheckCircle2 size={15}/> حساب داخراوەتەوە</p>}
                      {actions.length > 0 && (
                        <div className="mt-5 space-y-2">
                          {actions.map((action) => (
                            <button key={action} disabled={busyId === order.id} onClick={() => void changeStatus(order.id, action)}
                              className={`w-full rounded-xl px-3 py-2.5 text-sm font-bold disabled:opacity-50 ${["rejected","cancelled"].includes(action) ? "bg-red-50 text-red-700" : action === "delivered" ? "bg-green-600 text-white" : "bg-shakh-blue text-white"}`}>
                              {busyId === order.id ? "تکایە چاوەڕێ بکە..." : actionLabels[action]}
                            </button>
                          ))}
                        </div>
                      )}
                      {role === "captain" && order.status === "delivered" && !order.settled_at && <p className="mt-3 text-xs text-amber-700">بۆ داخستنی حساب، بەشی گەیاندن بکەرەوە.</p>}
                      {role === "super_admin" && order.status === "ready_for_pickup" && <Link href="/dashboard/admin/captains" className="mt-4 block rounded-xl bg-shakh-orange px-3 py-2.5 text-center text-sm font-bold text-white"><Truck size={15} className="mr-1 inline"/> دیاریکردنی کپتن</Link>}
                    </aside>
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
