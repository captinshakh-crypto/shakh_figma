"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { MapPin, Phone, Package, Clock3, Wallet, CheckCircle2, RefreshCw } from "lucide-react";

type Order = {
  id: string;
  status: string;
  delivery_fee_iqd: number;
  platform_delivery_share_iqd: number;
  captain_delivery_share_iqd: number;
  placed_at: string;
  delivery_address: string | null;
  delivery_phone: string | null;
  delivery_notes: string | null;
  total_iqd: number | null;
  settled_at: string | null;
};

type Item = { id: string; order_id: string; product_title_snapshot: string; quantity: number; line_total_iqd: number };
type Event = { id: string; order_id: string; to_status: string; created_at: string };

const labels: Record<string, string> = {
  assigned: "داواکاری بۆ تۆ دیاریکرا",
  picked_up: "داواکاری وەرگیرا",
  delivered: "داواکاری گەیەنرا",
  accepted: "پەسەندکرا",
  preparing: "ئامادە دەکرێت",
  ready_for_pickup: "ئامادەی وەرگرتنە",
  cancelled: "هەڵوەشێنرایەوە",
};

export default function DeliveriesPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [message, setMessage] = useState("");
  const [busyId, setBusyId] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { window.location.href = "/login"; return; }
    const { data: profile, error: profileError } = await supabase.from("profiles").select("role").eq("id", user.id).single();
    if (profileError) throw profileError;
    if (profile?.role !== "captain") { window.location.href = "/dashboard"; return; }

    const { data, error } = await supabase.from("orders")
      .select("id,status,delivery_fee_iqd,platform_delivery_share_iqd,captain_delivery_share_iqd,placed_at,delivery_address,delivery_phone,delivery_notes,total_iqd,settled_at")
      .eq("captain_user_id", user.id)
      .order("placed_at", { ascending: false }).limit(100);
    if (error) throw error;
    const rows = (data || []) as Order[];
    setOrders(rows);
    const ids = rows.map((row) => row.id);
    if (!ids.length) { setItems([]); setEvents([]); setLoading(false); return; }

    const [itemResult, eventResult] = await Promise.all([
      supabase.from("order_items").select("id,order_id,product_title_snapshot,quantity,line_total_iqd").in("order_id", ids),
      supabase.from("order_status_history").select("id,order_id,to_status,created_at").in("order_id", ids).order("created_at"),
    ]);
    if (itemResult.error) throw itemResult.error;
    if (eventResult.error) throw eventResult.error;
    setItems(itemResult.data || []);
    setEvents(eventResult.data || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    let active = true;
    const supabase = createClient();
    void load().catch(() => { if (active) { setMessage("نەتوانرا گەیاندنەکان باربکرێن."); setLoading(false); } });
    const channel = supabase.channel("shakh-captain-deliveries")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => {
        if (active) void load().catch(() => setMessage("نوێکردنەوەی گەیاندن سەرکەوتوو نەبوو."));
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "order_status_history" }, () => {
        if (active) void load().catch(() => setMessage("نوێکردنەوەی مێژوو سەرکەوتوو نەبوو."));
      }).subscribe();
    return () => { active = false; void supabase.removeChannel(channel); };
  }, [load]);

  async function updateStatus(id: string, status: string) {
    setBusyId(id);
    const { error } = await createClient().rpc("update_order_status", { p_order_id: id, p_status: status });
    setMessage(error?.message || "دۆخی گەیاندن نوێ کرایەوە.");
    setBusyId("");
    await load();
  }

  async function settle(id: string) {
    setBusyId(id);
    const { error } = await createClient().rpc("settle_delivered_order", { p_order_id: id });
    setMessage(error?.message || "حسابی گەیاندن داخرا و بڕی کپتن بۆ جزدان زیاد کرا.");
    setBusyId("");
    await load();
  }

  return (
    <main className="min-h-screen px-4 py-8">
      <div className="mx-auto max-w-4xl">
        <Link href="/dashboard" className="font-bold text-shakh-blue">← داشبۆرد</Link>
        <div className="mt-6 flex flex-wrap items-end justify-between gap-3">
          <div><h1 className="text-3xl font-black">گەیاندنەکانم</h1><p className="mt-2 text-sm text-slate-500">ناونیشان، پەیوەندی کڕیار، کاڵاکان و دۆخی گەیاندن.</p></div>
          <button onClick={() => void load()} className="inline-flex items-center gap-2 rounded-xl border bg-white px-4 py-2 text-sm font-bold"><RefreshCw size={15}/> نوێکردنەوە</button>
        </div>
        {message && <p role="status" className="mt-4 rounded-xl bg-blue-50 p-3 text-sm text-blue-800">{message}</p>}
        {loading ? <p className="mt-6 text-slate-500">بارکردن...</p> : orders.length === 0 ? (
          <div className="mt-6 rounded-2xl bg-white p-9 text-center text-slate-500">هێشتا هیچ گەیاندنێکت بۆ دیاری نەکراوە.</div>
        ) : (
          <div className="mt-6 space-y-4">
            {orders.map((order) => {
              const orderItems = items.filter((item) => item.order_id === order.id);
              const orderEvents = events.filter((event) => event.order_id === order.id);
              return (
                <article key={order.id} className="overflow-hidden rounded-2xl bg-white shadow-soft">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b p-5">
                    <div><p className="text-xs text-slate-400">داواکاری</p><b className="font-mono">{order.id.slice(0, 8).toUpperCase()}</b></div>
                    <span className="rounded-full bg-orange-50 px-3 py-1.5 text-sm font-bold text-shakh-orange">{labels[order.status] || order.status}</span>
                  </div>
                  <div className="grid gap-4 p-5 md:grid-cols-[1fr_220px]">
                    <div>
                      <div className="rounded-xl bg-slate-50 p-4">
                        <p className="flex items-start gap-2 text-sm"><MapPin size={17} className="mt-0.5 shrink-0 text-shakh-orange"/>{order.delivery_address || "ناونیشان تۆمار نەکراوە"}</p>
                        {order.delivery_phone && <p className="mt-3 flex items-center gap-2 text-sm"><Phone size={16} className="text-shakh-blue"/><a href={`tel:${order.delivery_phone}`} dir="ltr" className="font-bold">{order.delivery_phone}</a></p>}
                        {order.delivery_notes && <p className="mt-3 text-sm text-slate-600">تێبینی کڕیار: {order.delivery_notes}</p>}
                      </div>
                      <h2 className="mt-4 flex items-center gap-2 font-black"><Package size={17}/> کاڵاکان</h2>
                      <div className="mt-2 divide-y rounded-xl border">
                        {orderItems.map((item) => <div key={item.id} className="flex justify-between gap-3 p-3 text-sm"><span>{item.product_title_snapshot} × {item.quantity}</span><b>{item.line_total_iqd.toLocaleString("en-US")} د.ع</b></div>)}
                      </div>
                      <div className="mt-4">
                        <h3 className="flex items-center gap-2 text-sm font-black"><Clock3 size={16}/> مێژووی گەیاندن</h3>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {orderEvents.map((event) => <span key={event.id} className="rounded-lg bg-slate-50 px-2 py-1 text-xs text-slate-600">{labels[event.to_status] || event.to_status} · {new Date(event.created_at).toLocaleTimeString("ckb-IQ")}</span>)}
                        </div>
                      </div>
                    </div>
                    <aside className="h-fit rounded-xl bg-shakh-mist p-4">
                      <p className="text-xs text-slate-500">کرێی گەیاندن</p><b className="mt-1 block text-xl">{order.delivery_fee_iqd.toLocaleString("en-US")} د.ع</b>
                      <p className="mt-3 text-xs text-slate-500">بەشی کپتن</p><b className="mt-1 block text-lg text-shakh-blue">{order.captain_delivery_share_iqd.toLocaleString("en-US")} د.ع</b>
                      <p className="mt-3 text-xs text-slate-500">بەشی شاخ</p><b className="mt-1 block text-lg text-shakh-orange">{order.platform_delivery_share_iqd.toLocaleString("en-US")} د.ع</b>
                      {order.status === "assigned" && <button disabled={busyId === order.id} onClick={() => void updateStatus(order.id, "picked_up")} className="mt-5 w-full rounded-xl bg-shakh-blue p-3 text-sm font-bold text-white disabled:opacity-50">{busyId === order.id ? "تکایە چاوەڕێ بکە..." : "وەرگرتنی داواکاری"}</button>}
                      {order.status === "picked_up" && <button disabled={busyId === order.id} onClick={() => void updateStatus(order.id, "delivered")} className="mt-5 w-full rounded-xl bg-green-600 p-3 text-sm font-bold text-white disabled:opacity-50">{busyId === order.id ? "تکایە چاوەڕێ بکە..." : "گەیاندن تەواو بوو"}</button>}
                      {order.status === "delivered" && !order.settled_at && <button disabled={busyId === order.id} onClick={() => void settle(order.id)} className="mt-5 w-full rounded-xl bg-shakh-orange p-3 text-sm font-bold text-white disabled:opacity-50"><Wallet size={16} className="mr-1 inline"/>{busyId === order.id ? "تکایە چاوەڕێ بکە..." : "داخستنی حساب"}</button>}
                      {order.settled_at && <p className="mt-4 flex items-center gap-2 text-xs font-bold text-green-700"><CheckCircle2 size={15}/> حساب داخراوەتەوە</p>}
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
