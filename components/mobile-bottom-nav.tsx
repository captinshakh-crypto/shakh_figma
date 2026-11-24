"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Bell, Home, ShoppingBag, ShoppingCart, UserRound, ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type CartEntry = { quantity?: number };

function readCartCount() {
  try {
    const value = JSON.parse(window.localStorage.getItem("shakh-cart") || "[]");
    if (!Array.isArray(value)) return 0;
    return value.reduce((sum: number, item: CartEntry) =>
      sum + (typeof item.quantity === "number" && Number.isFinite(item.quantity) && item.quantity > 0 ? item.quantity : 0), 0);
  } catch {
    return 0;
  }
}

export default function MobileBottomNav() {
  const pathname = usePathname();
  const [cartCount, setCartCount] = useState(0);
  const [unreadCount, setUnreadCount] = useState(0);
  const [userId, setUserId] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);

  const refreshUnread = useCallback(async (uid: string) => {
    const { count, error } = await createClient()
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", uid)
      .is("read_at", null);
    if (!error) setUnreadCount(count || 0);
  }, []);

  useEffect(() => {
    const refreshCart = () => setCartCount(readCartCount());
    refreshCart();
    window.addEventListener("storage", refreshCart);
    window.addEventListener("shakh:cart-updated", refreshCart);
    window.addEventListener("focus", refreshCart);
    window.addEventListener("pageshow", refreshCart);
    return () => {
      window.removeEventListener("storage", refreshCart);
      window.removeEventListener("shakh:cart-updated", refreshCart);
      window.removeEventListener("focus", refreshCart);
      window.removeEventListener("pageshow", refreshCart);
    };
  }, [pathname]);

  useEffect(() => {
    let active = true;
    const supabase = createClient();
    const syncUser = (uid: string | null) => {
      if (!active) return;
      setUserId(uid);
      if (!uid) {
        setUnreadCount(0);
        return;
      }
      void refreshUnread(uid);
    };
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      syncUser(session?.user.id || null);
    });
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [refreshUnread]);

  useEffect(() => {
    let active = true;
    if (!userId) {
      setRole(null);
      return () => { active = false; };
    }
    async function loadRole() {
      const { data, error } = await createClient()
        .from("profiles")
        .select("role")
        .eq("id", userId!)
        .maybeSingle();
      if (active) setRole(error ? null : data?.role || null);
    }
    void loadRole();
    return () => { active = false; };
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    const supabase = createClient();
    const channel = supabase.channel("shakh-mobile-nav-notifications-" + userId)
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications", filter: "user_id=eq." + userId }, () => {
        void refreshUnread(userId);
      })
      .subscribe();
    const onFocus = () => { void refreshUnread(userId); };
    window.addEventListener("focus", onFocus);
    return () => {
      window.removeEventListener("focus", onFocus);
      void supabase.removeChannel(channel);
    };
  }, [userId, refreshUnread]);

  const openNotifications = () => {
    if (!userId) {
      window.location.assign("/login");
      return;
    }
    window.dispatchEvent(new Event("shakh:open-notifications"));
  };

  const links = [
    { href: "/", label: "سەرەتا", icon: Home, active: pathname === "/" },
    { href: "/shop", label: "بازاڕ", icon: ShoppingBag, active: pathname.startsWith("/shop") },
    { href: "/cart", label: "سەبەتە", icon: ShoppingCart, active: pathname.startsWith("/cart"), count: cartCount },
    { label: "ئاگاداری", icon: Bell, active: false, count: unreadCount, onClick: openNotifications },
    { href: userId ? "/dashboard" : "/login", label: "هەژمار", icon: UserRound, active: pathname.startsWith("/dashboard") || pathname.startsWith("/login") },
    ...(role === "super_admin" ? [
      { href: "/dashboard/admin", label: "ئەدمین", icon: ShieldCheck, active: pathname.startsWith("/dashboard/admin") },
    ] : []),
  ];

  return (
    <nav aria-label="ناڤیگەیشنی مۆبایل" dir="rtl" className="shakh-mobile-nav md:hidden">
      {links.map((item) => {
        const Icon = item.icon;
        const content = (
          <>
            <span className={"relative grid h-7 w-10 place-items-center rounded-xl transition " + (item.active ? "bg-orange-50 text-[#f47721]" : "text-slate-500")}>
              <Icon size={21} strokeWidth={item.active ? 2.5 : 2}/>
              {item.count ? <span className="absolute -right-1 -top-1 min-w-[17px] rounded-full bg-[#e54848] px-1 text-center text-[9px] font-black leading-[17px] text-white">{item.count > 99 ? "99+" : item.count}</span> : null}
            </span>
            <span className={"mt-1 text-[10px] font-bold " + (item.active ? "text-[#f47721]" : "text-slate-500")}>{item.label}</span>
          </>
        );
        return item.onClick ? (
          <button key={item.label} type="button" onClick={item.onClick} aria-label={item.label} className="flex min-w-0 flex-1 flex-col items-center justify-center py-2">{content}</button>
        ) : (
          <Link key={item.href} href={item.href!} aria-current={item.active ? "page" : undefined} className="flex min-w-0 flex-1 flex-col items-center justify-center py-2">{content}</Link>
        );
      })}
    </nav>
  );
}
