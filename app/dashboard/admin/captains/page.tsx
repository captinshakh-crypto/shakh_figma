"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Enums } from "@/lib/supabase/database.types";

type Order = { id: string; status: string; merchant_id: string | null; placed_at: string };
type Captain = {
  user_id: string;
  captain_type: Enums<"captain_type">;
  merchant_id: string | null;
  full_name: string | null;
  email: string | null;
};

const captainTypeLabel = (captain: Captain) =>
  captain.captain_type === "shakh" ? "کپتنی شاخ" : "کپتنی تایبەت بە دوکان";

export default function CaptainsPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [captains, setCaptains] = useState<Captain[]>([]);
  const [message, setMessage] = useState("");

  async function load() {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { window.location.href = "/login"; return; }
    const { data: admin } = await supabase.from("profiles").select("role").eq("id", user.id).single();
    if (admin?.role !== "super_admin") { window.location.href = "/dashboard"; return; }

    const [orderResult, captainResult] = await Promise.all([
      supabase.from("orders").select("id,status,merchant_id,placed_at")
        .eq("status", "ready_for_pickup").order("placed_at"),
      supabase.from("captain_profiles").select("user_id,captain_type,merchant_id")
        .eq("is_active", true),
    ]);
    if (orderResult.error) throw orderResult.error;
    if (captainResult.error) throw captainResult.error;

    const userIds = [...new Set((captainResult.data || []).map((captain) => captain.user_id))];
    const profileResult = userIds.length
      ? await supabase.from("profiles").select("id,full_name,email").in("id", userIds).eq("role", "captain").eq("is_active", true)
      : { data: [], error: null };
    if (profileResult.error) throw profileResult.error;

    const profileMap = Object.fromEntries((profileResult.data || []).map((profile) => [profile.id, profile]));
    setOrders(orderResult.data || []);
    setCaptains((captainResult.data || [])
      .filter((captain) => !!profileMap[captain.user_id])
      .map((captain) => ({ ...captain, ...profileMap[captain.user_id] })));
  }

  useEffect(() => {
    load().catch(() => setMessage("نەتوانرا زانیاری باربکرێت."));
  }, []);

  async function assign(orderId: string, captainId: string) {
    if (!captainId) return;
    const { error } = await createClient().rpc("admin_assign_captain", {
      p_order_id: orderId,
      p_captain_user_id: captainId,
    });
    setMessage(error?.message || "کپتن بۆ ئەم داواکارییە دیاریکرا.");
    if (!error) await load();
  }

  return (
    <main className="min-h-screen px-4 py-8">
      <div className="mx-auto max-w-4xl">
        <Link href="/dashboard/admin" className="font-bold text-shakh-blue">← سوپەر ئەدمین</Link>
        <h1 className="mt-6 text-3xl font-black">دیاریکردنی کپتن</h1>
        <p className="mt-2 text-sm text-slate-500">کپتنی شاخ بۆ هەموو دوکانەکانە؛ کپتنی تایبەت تەنها بۆ دوکانی خۆیەتی.</p>
        {message && <p role="status" className="mt-4 rounded-xl bg-blue-50 p-3 text-sm text-blue-800">{message}</p>}

        {orders.map((order) => {
          const eligible = captains.filter((captain) =>
            captain.captain_type === "shakh" ||
            (captain.captain_type === "merchant" && captain.merchant_id === order.merchant_id)
          );
          return (
            <article key={order.id} className="mt-4 rounded-2xl bg-white p-5 shadow-soft">
              <b>داواکاری {order.id.slice(0, 8)}</b>
              <select defaultValue="" onChange={(event) => void assign(order.id, event.target.value)} className="mt-3 w-full rounded-xl border p-3">
                <option value="">کپتن هەڵبژێرە</option>
                {eligible.map((captain) => (
                  <option key={captain.user_id} value={captain.user_id}>
                    {captain.full_name || captain.email || captain.user_id} — {captainTypeLabel(captain)}
                  </option>
                ))}
              </select>
              {eligible.length === 0 && <p className="mt-2 text-sm text-amber-700">کپتنێکی چالاک و شیاو بۆ ئەم دوکانە نییە.</p>}
            </article>
          );
        })}

        {orders.length === 0 && <p className="mt-6 rounded-2xl bg-white p-8 text-center text-slate-500">داواکاری ئامادەی گەیاندن نییە.</p>}
      </div>
    </main>
  );
}
