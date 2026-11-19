"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import OrderLiveMap from "@/components/order-live-map";
import { createClient } from "@/lib/supabase/client";
import { MapPin, Phone, Package, Clock3, RefreshCw, Truck } from "lucide-react";

type Order = {
  id: string;
  status: string;
  subtotal_iqd: number;
  delivery_fee_iqd: number;
  total_iqd: number | null;
  placed_at: string;
  delivery_address: string | null;
  delivery_phone: string | null;
  delivery_notes: string | null;
  settled_at: string | null;
};

type Item = { id: string; order_id: string; product_title_snapshot: string; quantity: number; line_total_iqd: number };
type Event = { id: string; order_id: string; to_status: string; created_at: string };
type LiveLocation = { order_id: string; latitude: number; longitude: number; accuracy_m: number | null; updated_at: string };

const labels: Record<string, string> = {
  placed: "نێردرا",
  accepted: "پەسەندکرا",
  rejected: "ڕەتکرایەوە",
  preparing: "ئامادە دەکرێت",
  ready_for_pickup: "ئامادەی کاپتنە",
  assigned: "کاپتن دیاریکرا",
  picked_up: "وەرگیرا",
  delivered: "گەیەنرا",
  cancelled: "هەڵوەشێنرایەوە",
};

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [liveLocations, setLiveLocations] = useState<Record<string, LiveLocation>>({});
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");

  const load = useCallback(async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { window.location.href = "/login"; return; }
    const { data: profile, error: profileError } = await supabase.from("profiles").select("role").eq("id", user.id).single();
    if (profileError) throw profileError;
    if (profile?.role !== "super_admin") { window.location.href = "/dashboard"; return; }

    const { data, error } = await supabase.from("orders")
      .select("id,status,subtotal_iqd,delivery_fee_iqd,total_iqd,placed_at,delivery_address,delivery_phone,delivery_notes,settled_at")
      .is("merchant_id", null).order("placed_at", { ascending: false }).limit(100);
    if (error) throw error;
    const rows = (data || []) as Order[];
    setOrders(rows);
    const ids = rows.map((row) => row.id);
    if (!ids.length) { setItems([]); setEvents([]); setLiveLocations({}); setLoading(false); return; }
    const [itemsResult, historyResult, locationResult] = await Promise.all([
      supabase.from("order_items").select("id,order_id,product_title_snapshot,quantity,line_total_iqd").in("order_id", ids),
      supabase.from("order_status_history").select("id,order_id,to_status,created_at").in("order_id", ids).order("created_at"),
      supabase.from("order_live_locations").select("order_id,latitude,longitude,accuracy_m,updated_at").in("order_id", ids),
    ]);
    if (itemsResult.error) throw itemsResult.error;
    if (historyResult.error) throw historyResult.error;
    if (locationResult.error) throw locationResult.error;
    setItems(itemsResult.data || []);
    setEvents(historyResult.data || []);
    setLiveLocations(Object.fromEntries((locationResult.data || []).map((location) => [location.order_id, { ...location, order_id: location.order_id }])));
    setLoading(false);
  }, []);

  useEffect(() => {
    let active = true;
    const supabase = createClient();
    void load().catch(() => { if (active) { setMessage("نەتوانرا داواکارییەکان باربکرێن."); setLoading(false); } });
    const channel = supabase.channel("shakh-store-orders-admin")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => {
        if (active) void load().catch(() => setMessage("نوێکردنەوەی داواکاری سەرکەوتوو نەبوو."));
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "order_status_history" }, () => {
        if (active) void load().catch(() => setMessage("نوێکردنەوەی مێژوو سەرکەوتوو نەبوو."));
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "order_live_locations" }, () => {
        if (active) void load().catch(() => setMessage("نوێکردنەوەی شوێنی کاپتن سەرکەوتوو نەبوو."));
      }).subscribe();
    return () => { active = false; void supabase.removeChannel(channel); };
  }, [load]);

  async function change(orderId: string, status: string) {
    setBusyId(orderId);
    const { error } = await createClient().rpc("update_order_status", { p_order_id: orderId, p_status: status });
    setBusyId("");
    setMessage(error?.message || "دۆخی داواکاری نوێ کرایەوە.");
    await load();
  }

  return (
    <main className="min-h-screen px-4 py-8">
      <div className="mx-auto max-w-5xl">
        <Link href="/dashboard/admin" className="font-bold text-shakh-blue">← سوپەر ئەدمین</Link>
        <div className="mt-6 flex flex-wrap items-end justify-between gap-3">
          <div><h1 className="text-3xl font-black">داواکارییەکانی شاخ ستۆر</h1><p className="mt-2 text-sm text-slate-500">پەسەندکردن، ئامادەکردن و بینینی ناونیشانی گەیاندن.</p></div>
          <button onClick={() => void load()} className="inline-flex items-center gap-2 rounded-xl border bg-white px-4 py-2 text-sm font-bold"><RefreshCw size={15}/> نوێکردنەوە</button>
        </div>
        {message && <p role="status" className="mt-4 rounded-xl bg-blue-50 p-3 text-sm text-blue-800">{message}</p>}
        {loading ? <p className="mt-6 text-slate-500">بارکردن...</p> : orders.length === 0 ? (
          <p className="mt-6 rounded-2xl bg-white p-8 text-center text-slate-500">داواکارییەکی شاخ ستۆر نییە.</p>
        ) : (
          <div className="mt-5 space-y-4">
            {orders.map((order) => {
              const orderItems = items.filter((item) => item.order_id === order.id);
              const orderEvents = events.filter((event) => event.order_id === order.id);
              const actions = order.status === "placed" ? ["accepted", "rejected", "cancelled"]
                : order.status === "accepted" ? ["preparing", "cancelled"]
                : order.status === "preparing" ? ["ready_for_pickup", "cancelled"]
                : order.status === "ready_for_pickup" ? ["cancelled"] : [];
              return (
                <article key={order.id} className="overflow-hidden rounded-2xl bg-white shadow-soft">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b p-5">
                    <b className="font-mono">{order.id.slice(0, 8).toUpperCase()}</b>
                    <span className="rounded-full bg-orange-50 px-3 py-1.5 text-sm font-bold text-orange-700">{labels[order.status] || order.status}</span>
                  </div>
                  <div className="grid gap-4 p-5 md:grid-cols-[1fr_240px]">
                    <div>
                      <p className="text-xs text-slate-400">{new Date(order.placed_at).toLocaleString("ckb-IQ")}</p>
                      <div className="mt-3 rounded-xl bg-slate-50 p-4">
                        <p className="flex items-start gap-2 text-sm"><MapPin size={16} className="mt-0.5 shrink-0 text-shakh-orange"/>{order.delivery_address || "ناونیشان تۆمار نەکراوە"}</p>
                        {order.delivery_phone && <p className="mt-2 flex items-center gap-2 text-sm"><Phone size={15} className="text-shakh-blue"/><a href={`tel:${order.delivery_phone}`} dir="ltr">{order.delivery_phone}</a></p>}
                        {order.delivery_notes && <p className="mt-2 text-sm text-slate-600">تێبینی: {order.delivery_notes}</p>}
                      </div>
                      {liveLocations[order.id] && (
                        <div className="mt-4">
                          <OrderLiveMap latitude={liveLocations[order.id].latitude} longitude={liveLocations[order.id].longitude} accuracyM={liveLocations[order.id].accuracy_m} updatedAt={liveLocations[order.id].updated_at}/>
                        </div>
                      )}
                      <h2 className="mt-4 flex items-center gap-2 font-black"><Package size={17}/> کاڵاکان</h2>
                      <div className="mt-2 divide-y rounded-xl border">
                        {orderItems.map((item) => <div key={item.id} className="flex justify-between gap-3 p-3 text-sm"><span>{item.product_title_snapshot} × {item.quantity}</span><b>{item.line_total_iqd.toLocaleString("en-US")} د.ع</b></div>)}
                      </div>
                      <div className="mt-4">
                        <h3 className="flex items-center gap-2 text-sm font-black"><Clock3 size={16}/> مێژووی دۆخ</h3>
                        <div className="mt-2 overflow-hidden rounded-xl border border-slate-100 divide-y divide-slate-100">
                          {[...orderEvents].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).map((event, index) => (
                            <div key={event.id} className="flex items-center justify-between gap-3 p-3">
                              <div><p className="text-sm font-bold">{labels[event.to_status] || event.to_status}</p><p className="mt-1 text-xs text-slate-400">{new Date(event.created_at).toLocaleString("ckb-IQ")}</p></div>
                              {index === 0 && <span className="rounded-full bg-orange-50 px-2 py-1 text-[10px] font-bold text-orange-700">نوێترین</span>}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                    <aside className="h-fit rounded-xl bg-shakh-mist p-4">
                      <p className="text-xs text-slate-500">کۆی کاڵاکان</p><b className="mt-1 block">{order.subtotal_iqd.toLocaleString("en-US")} د.ع</b>
                      <p className="mt-3 text-xs text-slate-500">گەیاندن</p><b className="mt-1 block">{order.delivery_fee_iqd.toLocaleString("en-US")} د.ع</b>
                      <p className="mt-3 border-t pt-3 text-xs text-slate-500">کۆی گشتی</p><b className="mt-1 block text-xl">{(order.total_iqd || order.subtotal_iqd + order.delivery_fee_iqd).toLocaleString("en-US")} د.ع</b>
                      <div className="mt-4 space-y-2">
                        {actions.map((action) => <button key={action} disabled={busyId === order.id} onClick={() => void change(order.id, action)} className={`w-full rounded-xl px-3 py-2.5 text-sm font-bold disabled:opacity-50 ${["rejected","cancelled"].includes(action) ? "bg-red-50 text-red-700" : "bg-shakh-blue text-white"}`}>{busyId === order.id ? "تکایە چاوەڕێ بکە..." : labels[action]}</button>)}
                      </div>
                      {order.status === "ready_for_pickup" && <Link href="/dashboard/admin/captains" className="mt-3 block rounded-xl bg-shakh-orange px-3 py-2.5 text-center text-sm font-bold text-white"><Truck size={15} className="mr-1 inline"/> دیاریکردنی کاپتن</Link>}
                      {order.settled_at && <p className="mt-3 text-xs font-bold text-green-700">حساب داخراوەتەوە</p>}
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
