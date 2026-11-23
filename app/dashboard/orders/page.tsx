"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import OrderLiveMap from "@/components/order-live-map";
import { createClient } from "@/lib/supabase/client";
import { MapPin, Phone, Package, Clock3, CheckCircle2, XCircle, Truck, RefreshCw, ChevronDown, ChevronUp, MessageCircle } from "lucide-react";

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
  delivery_latitude: number | null;
  delivery_longitude: number | null;
  settled_at: string | null;
  merchant_receipt_whatsapp_opened_at: string | null;
  merchant_receipt_whatsapp_sent_at: string | null;
};

type OrderItem = {
  id: string;
  order_id: string;
  product_title_snapshot: string;
  quantity: number;
  unit_price_iqd: number;
  line_total_iqd: number;
  merchant_commission_per_unit_snapshot_iqd: number;
  merchant_commission_line_snapshot_iqd: number;
};

type LiveLocation = { order_id: string; latitude: number; longitude: number; accuracy_m: number | null; updated_at: string };
type MerchantInfo = { business_name: string; address: string | null; phone: string | null };

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
  ready_for_pickup: "ئامادەی وەرگرتنی کاپتنە",
  assigned: "کاپتن دیاریکرا",
  picked_up: "کاپتن داواکارییەکەی وەرگرت",
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
  const [liveLocations, setLiveLocations] = useState<Record<string, LiveLocation>>({});
  const [merchantInfo, setMerchantInfo] = useState<Record<string, MerchantInfo>>({});
  const [customerNames, setCustomerNames] = useState<Record<string, string>>({});
  const [zoneNames, setZoneNames] = useState<Record<string, string>>({});
  const [receiptBusyId, setReceiptBusyId] = useState("");
  const [role, setRole] = useState("");
  const [busyId, setBusyId] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [showOrders, setShowOrders] = useState(false);

  const load = useCallback(async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { window.location.href = "/login"; return; }

    const [profileResult, merchantProfileResult] = await Promise.all([
      supabase.from("profiles").select("role").eq("id", user.id).single(),
      supabase.from("merchant_profiles")
        .select("id,merchant_type,approval_status")
        .eq("user_id", user.id).maybeSingle(),
    ]);
    if (profileResult.error) throw profileResult.error;
    if (merchantProfileResult.error) throw merchantProfileResult.error;
    // The profile row is the source of truth for the role; prefer an approved
    // merchant profile when an older account still carries the customer role.
    const resolvedRole = profileResult.data?.role || "";
    const merchant = merchantProfileResult.data;
    const currentRole = merchant?.approval_status === "approved"
      && ["supermarket", "restaurant", "butcher_poultry", "grocery"].includes(merchant.merchant_type)
      && !["super_admin", "captain"].includes(resolvedRole)
        ? merchant.merchant_type
        : resolvedRole;
    setRole(currentRole);

    let query = supabase.from("orders").select(
      "id,customer_id,merchant_id,captain_user_id,service_zone_id,status,subtotal_iqd,delivery_fee_iqd,platform_delivery_share_iqd,captain_delivery_share_iqd,total_iqd,reward_amount_iqd,placed_at,delivery_address,delivery_phone,delivery_notes,delivery_latitude,delivery_longitude,settled_at,merchant_receipt_whatsapp_opened_at,merchant_receipt_whatsapp_sent_at"
    ).order("placed_at", { ascending: false }).limit(100);

    if (currentRole === "customer") {
      query = query.eq("customer_id", user.id);
    } else if (currentRole === "captain") {
      query = query.eq("captain_user_id", user.id);
    } else if (["supermarket", "restaurant", "butcher_poultry", "grocery"].includes(currentRole)) {
      if (!merchant || merchant.approval_status !== "approved") {
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
      setItems([]); setHistory([]); setLiveLocations({}); setMerchantInfo({}); setZoneNames({}); setLoading(false); return;
    }

    const [itemResult, historyResult, merchantResult, zoneResult, locationResult] = await Promise.all([
      supabase.from("order_items").select("id,order_id,product_title_snapshot,quantity,unit_price_iqd,line_total_iqd,merchant_commission_per_unit_snapshot_iqd,merchant_commission_line_snapshot_iqd").in("order_id", orderIds),
      supabase.from("order_status_history").select("id,order_id,from_status,to_status,actor_role,note,created_at").in("order_id", orderIds).order("created_at"),
      merchantIds.length ? supabase.from("merchant_profiles").select("id,user_id,business_name,address").in("id", merchantIds) : Promise.resolve({ data: [], error: null }),
      zoneIds.length ? supabase.from("service_zones").select("id,name").in("id", zoneIds) : Promise.resolve({ data: [], error: null }),
      supabase.from("order_live_locations").select("order_id,latitude,longitude,accuracy_m,updated_at").in("order_id", orderIds),
    ]);
    if (itemResult.error) throw itemResult.error;
    if (historyResult.error) throw historyResult.error;
    if (merchantResult.error) throw merchantResult.error;
    if (zoneResult.error) throw zoneResult.error;
    if (locationResult.error) throw locationResult.error;

    const merchantRows = merchantResult.data || [];
    const merchantUserIds = [...new Set(merchantRows.map((merchant) => merchant.user_id).filter((id): id is string => !!id))];
    const customerIds = currentRole === "super_admin" ? rows.map((order) => order.customer_id) : [];
    const profileIds = [...new Set([...merchantUserIds, ...customerIds])];
    const contactProfilesResult = profileIds.length
      ? await supabase.from("profiles").select("id,phone,full_name").in("id", profileIds)
      : { data: [], error: null };
    if (contactProfilesResult.error) throw contactProfilesResult.error;
    const phoneByUser = Object.fromEntries((contactProfilesResult.data || []).map((profile) => [profile.id, profile.phone]));
    const nameByUser = Object.fromEntries((contactProfilesResult.data || []).map((profile) => [profile.id, profile.full_name || ""]));
    setItems(itemResult.data || []);
    setHistory(historyResult.data || []);
    setCustomerNames(nameByUser);
    setLiveLocations(Object.fromEntries((locationResult.data || []).map((location) => [location.order_id, { ...location, order_id: location.order_id }])));
    setMerchantInfo(Object.fromEntries(merchantRows.map((merchant) => [merchant.id, {
      business_name: merchant.business_name,
      address: merchant.address,
      phone: phoneByUser[merchant.user_id] || null,
    }])));
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
      .on("postgres_changes", { event: "*", schema: "public", table: "order_live_locations" }, (payload) => {
        if (!active) return;
        if (payload.eventType === "DELETE") {
          const oldLocation = payload.old as Partial<LiveLocation>;
          if (oldLocation.order_id) {
            setLiveLocations((current) => {
              const next = { ...current };
              delete next[oldLocation.order_id!];
              return next;
            });
          }
          return;
        }
        const nextLocation = payload.new as LiveLocation;
        if (!nextLocation.order_id ||
            typeof nextLocation.latitude !== "number" ||
            typeof nextLocation.longitude !== "number") return;
        setLiveLocations((current) => ({
          ...current,
          [nextLocation.order_id]: nextLocation,
        }));
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

  function normalizeWhatsAppRecipient(phone: string | null | undefined): string | null {
    const digits = (phone || "").replace(/\D/g, "");
    if (!digits) return null;
    if (digits.startsWith("00")) return digits.slice(2);
    if (digits.startsWith("964")) return digits;
    if (digits.startsWith("0")) return "964" + digits.slice(1);
    if (digits.startsWith("7") && digits.length === 10) return "964" + digits;
    return digits.length >= 8 && digits.length <= 15 ? digits : null;
  }

  function merchantReceipt(order: Order, orderItems: OrderItem[]) {
    if (!order.merchant_id) return null;
    const merchant = merchantInfo[order.merchant_id];
    if (!merchant) return null;
    const recipient = normalizeWhatsAppRecipient(merchant.phone);
    const total = Number(order.total_iqd ?? order.subtotal_iqd + order.delivery_fee_iqd);
    const itemLines = orderItems.map((item) =>
      `• ${item.product_title_snapshot} × ${Number(item.quantity).toLocaleString("en-US", { maximumFractionDigits: 3 })} | یەکە: ${formatIQD(item.unit_price_iqd)} | کۆ: ${formatIQD(item.line_total_iqd)}`
    );
    const receipt = [
      "SHAKH | وەسڵی ئۆردەری نوێ",
      `ژمارەی ئۆردەر: #${order.id.toUpperCase()}`,
      `ناوی کڕیار: ${customerNames[order.customer_id] || "ناوی کڕیار تۆمار نەکراوە"}`,
      `دوکان: ${merchant.business_name}`,
      merchant.phone ? `ژمارەی دوکان: ${merchant.phone}` : "",
      merchant.address ? `شوێنی دوکان: ${merchant.address}` : "",
      `کاتی تۆمارکردن: ${new Date(order.placed_at).toLocaleString("ckb-IQ")}`,
      "",
      "لیستی کاڵاکان:",
      ...(itemLines.length ? itemLines : ["هیچ کاڵایەک نییە."]),
      "",
      `کۆی کاڵاکان: ${formatIQD(order.subtotal_iqd)}`,
      `کرێی گەیاندن: ${formatIQD(order.delivery_fee_iqd)}`,
      `کۆی پارەی ئۆردەر: ${formatIQD(total)}`,
      "",
      `ژمارەی کڕیار: ${order.delivery_phone}`,
      `شوێنی گەیاندن: ${order.delivery_address}`,
      order.delivery_notes ? `تێبینی کڕیار: ${order.delivery_notes}` : "",
      "",
      "تکایە ئۆردەرەکە پشکنین بکە و ئامادەکارییەکانی دەست پێ بکە.",
      "سوپاس – Shakh",
    ].filter(Boolean).join("\n");
    return { recipient, message: receipt, url: recipient ? `https://wa.me/${recipient}?text=${encodeURIComponent(receipt)}` : null };
  }

  async function recordReceiptActivity(orderId: string, status: "opened" | "sent_confirmed") {
    setReceiptBusyId(orderId);
    const { error } = await createClient().rpc("admin_record_order_receipt_share", { p_order_id: orderId, p_status: status });
    setReceiptBusyId("");
    if (error) {
      setMessage(error.message || "تۆمارکردنی دۆخی وەسڵ سەرکەوتوو نەبوو.");
      return;
    }
    const timestamp = new Date().toISOString();
    setOrders((current) => current.map((order) => order.id !== orderId ? order : {
      ...order,
      ...(status === "opened" ? { merchant_receipt_whatsapp_opened_at: timestamp } : { merchant_receipt_whatsapp_sent_at: timestamp }),
    }));
    setMessage(status === "opened" ? "کردنەوەی WhatsApp تۆمار کرا؛ ئەمە نیشانەی ناردنی پەیام نییە." : "پشتڕاستکردنەوەی ناردنی وەسڵ تۆمار کرا.");
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

        {!loading && ["captain","supermarket","restaurant","butcher_poultry","grocery"].includes(role) && <section className="mt-5 rounded-2xl bg-white p-5 shadow-soft"><h2 className="font-black">پوختەی حسابی ڕۆژانەی کۆمسیۆنی پۆست</h2><p className="mt-1 text-xs text-slate-500">تەنها ئۆردەرە تەواوبوو و داخراوەکان هەژمار دەکرێن.</p><div className="mt-3 space-y-2">{Object.entries(orders.filter(o=>!!o.settled_at).reduce((acc,o)=>{const day=new Date(o.settled_at!).toLocaleDateString("en-CA",{timeZone:"Asia/Baghdad"});const amount=items.filter(i=>i.order_id===o.id).reduce((n,i)=>n+Number(i.merchant_commission_line_snapshot_iqd||0),0);acc[day]=(acc[day]||0)+amount;return acc;},{} as Record<string,number>)).sort((a,b)=>b[0].localeCompare(a[0])).map(([day,total])=><div key={day} className="flex items-center justify-between rounded-lg bg-slate-50 p-3 text-sm"><span>{new Date(day+"T12:00:00").toLocaleDateString("ckb-IQ")}</span><b className="text-orange-700">{total.toLocaleString("en-US")} د.ع</b></div>)}</div></section>}
        {loading ? <p className="mt-6 text-slate-500">بارکردنی داواکارییەکان...</p> : orders.length === 0 ? (
          <div className="mt-6 rounded-2xl bg-white p-10 text-center text-slate-500">هێشتا هیچ داواکارییەک نییە.</div>
        ) : (
          <div className="mt-6">
            <button type="button" onClick={() => setShowOrders((shown) => !shown)} aria-expanded={showOrders}
              className="flex w-full items-center justify-between rounded-2xl border border-slate-200 bg-white px-5 py-4 text-right shadow-soft transition hover:border-shakh-blue">
              <span><span className="block font-black">{showOrders ? "شاردنەوەی داواکارییەکان" : "پیشاندانی هەموو داواکارییەکان"}</span><span className="mt-1 block text-xs text-slate-500">{orders.length.toLocaleString("ckb-IQ")} داواکاری تۆمارکراوە</span></span>
              {showOrders ? <ChevronUp size={20} className="shrink-0 text-shakh-blue"/> : <ChevronDown size={20} className="shrink-0 text-shakh-blue"/>}
            </button>
            {showOrders && <div className="mt-4 space-y-5">
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
                        <span>{order.merchant_id ? merchantInfo[order.merchant_id]?.business_name || "دوکانی هاوبەش" : "شاخ ستۆر"}</span>
                        {order.merchant_id && merchantInfo[order.merchant_id]?.address && <span className="flex items-center gap-1"><MapPin size={12}/> شوێنی دوکان: {merchantInfo[order.merchant_id].address}</span>}
                        {order.service_zone_id && <span>زۆن: {zoneNames[order.service_zone_id] || "—"}</span>}
                      </div>
                      <h2 className="mt-4 font-black">کاڵاکان</h2>
                      <div className="mt-2 divide-y divide-slate-100 rounded-xl border border-slate-100">
                        {orderItems.map((item) => (
                          <div key={item.id} className="flex justify-between gap-3 p-3 text-sm">
                            <span>{item.product_title_snapshot} × {item.quantity}</span>
                            <div className="text-right"><b>{formatIQD(item.line_total_iqd)}</b>{role !== "customer" && item.merchant_commission_line_snapshot_iqd > 0 && <p className="mt-1 text-xs text-orange-700">کۆمسیۆن: {formatIQD(item.merchant_commission_line_snapshot_iqd)}</p>}</div>
                          </div>
                        ))}
                      </div>

                      <div className="mt-4 grid gap-2 rounded-xl bg-slate-50 p-4 text-sm">
                        <div className="flex items-start gap-2"><MapPin size={17} className="mt-0.5 shrink-0 text-shakh-orange"/><span>{order.delivery_address || "ناونیشانی گەیاندن تۆمار نەکراوە"}</span></div>
                        {order.delivery_phone && <div className="flex items-center gap-2"><Phone size={16} className="text-shakh-blue"/><a href={`tel:${order.delivery_phone}`} dir="ltr">{order.delivery_phone}</a></div>}
                        {order.delivery_notes && <p className="text-slate-600">تێبینی: {order.delivery_notes}</p>}
                      </div>
                      {["assigned", "picked_up"].includes(order.status) && (
                        <div className="mt-4">
                          {liveLocations[order.id] ? (
                            <OrderLiveMap latitude={liveLocations[order.id].latitude} longitude={liveLocations[order.id].longitude} accuracyM={liveLocations[order.id].accuracy_m} updatedAt={liveLocations[order.id].updated_at} deliveryAddress={order.delivery_address} deliveryLatitude={order.delivery_latitude} deliveryLongitude={order.delivery_longitude}/>
                          ) : (
                            <p className="rounded-xl border border-dashed border-slate-300 p-3 text-sm text-slate-500">کاپتن هێشتا شوێنکەوتنی GPS چالاک نەکردووە.</p>
                          )}
                        </div>
                      )}

                      <h3 className="mt-5 flex items-center gap-2 font-black"><Clock3 size={17}/> مێژووی داواکاری</h3>
                      <div className="mt-3 overflow-hidden rounded-xl border border-slate-100 divide-y divide-slate-100">
                        {[...events].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).map((event, index) => (
                          <div key={event.id} className="flex items-start gap-3 p-3">
                            <span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${index === 0 ? "bg-shakh-orange" : "bg-slate-300"}`}/>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-bold">{statusLabels[event.to_status] || event.to_status}</p>
                              <p className="mt-1 text-xs text-slate-400">{new Date(event.created_at).toLocaleString("ckb-IQ")}</p>
                            </div>
                            {index === 0 && <span className="rounded-full bg-orange-50 px-2 py-1 text-[10px] font-bold text-orange-700">نوێترین</span>}
                          </div>
                        ))}
                      </div>
                    </div>

                    <aside className="rounded-xl bg-shakh-mist p-4">
                      <h3 className="font-black">کورتەی پارە</h3>
                      <div className="mt-3 space-y-2 text-sm">
                        <div className="flex justify-between"><span>کۆی کاڵاکان</span><b>{formatIQD(order.subtotal_iqd)}</b></div>
                        <div className="flex justify-between"><span>گەیاندن</span><b>{formatIQD(order.delivery_fee_iqd)}</b></div>
                        <div className="flex justify-between border-t border-slate-200 pt-3 font-black"><span>کۆی گشتی</span><span>{formatIQD(order.total_iqd || order.subtotal_iqd + order.delivery_fee_iqd)}</span></div>
                      </div>
                      {role === "super_admin" && order.merchant_id && (() => {
                        const receipt = merchantReceipt(order, orderItems);
                        return (
                          <div className="mt-4 space-y-3 rounded-xl border border-green-100 bg-white p-3">
                            <details className="rounded-lg bg-slate-50 p-3">
                              <summary className="cursor-pointer text-sm font-bold text-slate-800">پێشبینینی وەسڵی تەواوی کڕین</summary>
                              <pre dir="rtl" className="mt-3 whitespace-pre-wrap break-words text-xs leading-6 text-slate-700">{receipt?.message || "زانیاری وەسڵ بەردەست نییە."}</pre>
                            </details>
                            {receipt?.url ? (
                              <a href={receipt.url} target="_blank" rel="noreferrer" onClick={() => void recordReceiptActivity(order.id, "opened")} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-green-600 px-3 text-center text-sm font-bold text-white"><MessageCircle size={18}/> کردنەوەی WhatsApp و ئامادەکردنی وەسڵ</a>
                            ) : (
                              <p role="alert" className="rounded-lg bg-amber-50 p-3 text-xs leading-6 text-amber-800">ژمارەی مۆبایلی دروستی دوکان لە پڕۆفایل نییە. ژمارەکە لە پڕۆفایلی خاوەن دوکان زیاد یان چاک بکەرەوە؛ هیچ لینکێکی بێ ژمارە دروست ناکرێت.</p>
                            )}
                            {order.merchant_receipt_whatsapp_opened_at && <p className="text-xs text-slate-500">WhatsApp کراوەتەوە: {new Date(order.merchant_receipt_whatsapp_opened_at).toLocaleString("ckb-IQ")}</p>}
                            {order.merchant_receipt_whatsapp_sent_at ? (
                              <p className="text-xs font-bold text-green-700">ناردن لەلایەن سوپەر ئەدمینەوە پشتڕاست کرا: {new Date(order.merchant_receipt_whatsapp_sent_at).toLocaleString("ckb-IQ")}</p>
                            ) : order.merchant_receipt_whatsapp_opened_at ? (
                              <button type="button" disabled={receiptBusyId === order.id} onClick={() => { if (window.confirm("دڵنیایت کە پەیامەکە لە WhatsApp بەڕاستی نێردراوە؟")) void recordReceiptActivity(order.id, "sent_confirmed"); }} className="min-h-11 w-full rounded-xl border border-green-200 px-3 py-2 text-sm font-bold text-green-800 disabled:opacity-50">پشتڕاستکردنەوەی ناردنی پەیام</button>
                            ) : null}
                            <p className="text-[11px] leading-5 text-slate-500">کردنەوەی WhatsApp بە تەنها ناردن پشتڕاست ناکاتەوە؛ تەنها دوای ناردنی دەستی پەیام، پشتڕاستکردنەوە بکە.</p>
                          </div>
                        );
                      })()}
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
                      {role === "super_admin" && order.status === "ready_for_pickup" && <Link href="/dashboard/admin/captains" className="mt-4 block rounded-xl bg-shakh-orange px-3 py-2.5 text-center text-sm font-bold text-white"><Truck size={15} className="mr-1 inline"/> دیاریکردنی کاپتن</Link>}
                    </aside>
                  </div>
                </article>
              );
            })}
            </div>}
          </div>
        )}
      </div>
    </main>
  );
}
