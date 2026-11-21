"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Bell, Volume2, VolumeX, CheckCheck, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Notice = { id: string; title: string; body: string; kind: string; created_at: string; read_at: string | null };

function urlBase64ToUint8Array(value: string): Uint8Array {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i);
  return output;
}

function arrayBufferToBase64(value: ArrayBuffer): string {
  const bytes = new Uint8Array(value);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return window.btoa(binary);
}

export default function NotificationsCenter() {
  const [userId, setUserId] = useState<string | null>(null);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [open, setOpen] = useState(false);
  const [soundOn, setSoundOn] = useState(false);
  const [ready, setReady] = useState(false);
  const [pushState, setPushState] = useState<"unsupported" | "off" | "on" | "denied">("off");
  const [pushBusy, setPushBusy] = useState(false);
  const [pushMessage, setPushMessage] = useState("");
  const audioRef = useRef<AudioContext | null>(null);
  const knownIds = useRef<Set<string>>(new Set());

  const playSound = useCallback(async (force = false) => {
    if (!soundOn && !force) return;
    try {
      const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextClass) return;
      const context = audioRef.current || new AudioContextClass();
      audioRef.current = context;
      if (context.state === "suspended") await context.resume();
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(880, context.currentTime);
      oscillator.frequency.setValueAtTime(660, context.currentTime + 0.12);
      gain.gain.setValueAtTime(0.0001, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.16, context.currentTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.32);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start();
      oscillator.stop(context.currentTime + 0.34);
    } catch { /* Browser audio permissions may block playback until the next user gesture. */ }
  }, [soundOn]);

  const load = useCallback(async (uid: string) => {
    const supabase = createClient();
    const { data, error } = await supabase.from("notifications")
      .select("id,title,body,kind,created_at,read_at")
      .eq("user_id", uid).order("created_at", { ascending: false }).limit(30);
    if (error) return;
    const rows = (data || []) as Notice[];
    rows.forEach((row) => knownIds.current.add(row.id));
    setNotices(rows);
    setReady(true);
  }, []);

  useEffect(() => {
    let active = true;
    const supabase = createClient();
    void supabase.auth.getUser().then(({ data }) => {
      if (!active || !data.user) return;
      setUserId(data.user.id);
      void load(data.user.id);
    });
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      const uid = session?.user.id || null;
      setUserId(uid);
      setNotices([]);
      knownIds.current.clear();
      setReady(false);
      if (uid) void load(uid);
    });
    return () => { active = false; authListener.subscription.unsubscribe(); };
  }, [load]);

  useEffect(() => {
    if (!userId) return;
    const supabase = createClient();
    const channel = supabase.channel("shakh-notifications-" + userId)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications", filter: "user_id=eq." + userId }, (payload) => {
        const row = payload.new as Notice;
        if (!row?.id || knownIds.current.has(row.id)) return;
        knownIds.current.add(row.id);
        setNotices((current) => [row, ...current].slice(0, 30));
        void playSound();
      })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [userId, playSound]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
      setPushState("unsupported");
      return;
    }
    if (Notification.permission === "denied") setPushState("denied");
    else if (Notification.permission === "granted") {
      void navigator.serviceWorker.ready.then((registration) =>
        registration.pushManager.getSubscription().then((subscription) => setPushState(subscription ? "on" : "off"))
      );
    } else setPushState("off");
  }, []);

  async function enablePush() {
    if (!userId || pushBusy) return;
    setPushBusy(true);
    setPushMessage("");
    try {
      const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!publicKey) throw new Error("کلیلی گشتی Push لە Vercel دانەنراوە.");
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
        setPushState("unsupported");
        throw new Error("ئەم وێبگەڕە Push Notification پشتگیری ناکات.");
      }
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setPushState(permission === "denied" ? "denied" : "off");
        throw new Error("مۆڵەتی ئاگادارکردنەوەت ڕەتکردەوە یان هێشتا ڕێگەی پێ نەداوە.");
      }
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription() || await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
      });
      const p256dh = subscription.getKey("p256dh");
      const auth = subscription.getKey("auth");
      if (!p256dh || !auth) throw new Error("زانیاری پاراستنی Push لە وێبگەڕەکە نەدۆزرایەوە.");
      const { error } = await createClient().from("push_subscriptions").upsert({
        user_id: userId,
        endpoint: subscription.endpoint,
        p256dh: arrayBufferToBase64(p256dh),
        auth: arrayBufferToBase64(auth),
        user_agent: navigator.userAgent,
        updated_at: new Date().toISOString(),
      }, { onConflict: "endpoint" });
      if (error) throw error;
      setPushState("on");
      setPushMessage("ئاگادارکردنەوەی Push چالاک کرا.");
    } catch (error) {
      setPushMessage(error instanceof Error ? error.message : "چالاککردنی Push سەرکەوتوو نەبوو.");
    } finally {
      setPushBusy(false);
    }
  }

  async function disablePush() {
    if (!pushBusy) {
      setPushBusy(true);
      setPushMessage("");
      try {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();
        if (subscription) {
          await createClient().from("push_subscriptions").delete().eq("endpoint", subscription.endpoint).eq("user_id", userId);
          await subscription.unsubscribe();
        }
        setPushState("off");
        setPushMessage("ئاگادارکردنەوەی Push ناچالاک کرا.");
      } catch (error) {
        setPushMessage(error instanceof Error ? error.message : "ناچالاککردنی Push سەرکەوتوو نەبوو.");
      } finally {
        setPushBusy(false);
      }
    }
  }

  async function markRead(id: string) {
    const now = new Date().toISOString();
    setNotices((current) => current.map((item) => item.id === id ? { ...item, read_at: now } : item));
    await createClient().from("notifications").update({ read_at: now }).eq("id", id);
  }

  async function markAllRead() {
    const now = new Date().toISOString();
    setNotices((current) => current.map((item) => ({ ...item, read_at: item.read_at || now })));
    await createClient().from("notifications").update({ read_at: now }).eq("user_id", userId!).is("read_at", null);
  }

  async function toggleSound() {
    if (!soundOn) {
      setSoundOn(true);
      try {
        const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (AudioContextClass) {
          const context = audioRef.current || new AudioContextClass();
          audioRef.current = context;
          await context.resume();
        }
      } catch { /* The user can retry enabling sound. */ }
      await playSound(true);
    } else {
      setSoundOn(false);
    }
  }

  if (!userId || !ready) return null;
  const unread = notices.filter((item) => !item.read_at).length;

  return (
    <div className="fixed left-4 top-4 z-[100]">
      <div className="relative">
        <button onClick={() => setOpen((value) => !value)} aria-label="ئاگادارییەکان" className="relative flex h-12 w-12 items-center justify-center rounded-full border border-slate-200 bg-white text-shakh-blue shadow-lg">
          <Bell size={21}/>
          {unread > 0 && <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-red-600 px-1.5 py-0.5 text-center text-[11px] font-black leading-4 text-white">{unread > 99 ? "99+" : unread}</span>}
        </button>
        {open && (
          <section className="absolute left-0 top-14 w-[min(92vw,360px)] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl" dir="rtl">
            <header className="flex items-center justify-between border-b p-4">
              <div><b>ئاگادارییەکان</b><p className="text-xs text-slate-500">{unread.toLocaleString("en-US")} ئاگاداری نەخوێندراوە</p></div>
              <div className="flex items-center gap-2">
                <button onClick={() => void toggleSound()} title={soundOn ? "کوژاندنەوەی دەنگ" : "چالاککردنی دەنگ"} className="rounded-lg bg-slate-100 p-2 text-shakh-blue">{soundOn ? <Volume2 size={17}/> : <VolumeX size={17}/>}</button>
                <button onClick={() => setOpen(false)} className="rounded-lg bg-slate-100 p-2"><X size={17}/></button>
              </div>
            </header>
            <div className="flex items-center justify-between px-4 py-2">
              <span className="text-xs text-slate-500">{soundOn ? "دەنگ چالاکە" : "بۆ دەنگ، دوگمەی دەنگ چالاک بکە"}</span>
              <button onClick={() => void markAllRead()} disabled={!unread} className="flex items-center gap-1 text-xs font-bold text-shakh-blue disabled:opacity-40"><CheckCheck size={14}/> خوێندنەوەی هەموو</button>
            </div>
            <div className="border-t bg-slate-50 px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <b className="text-xs">ئاگادارکردنەوە لە کاتی داخستنی ئەپ</b>
                  <p className="mt-1 text-[11px] text-slate-500">{pushState === "on" ? "Push چالاکە" : pushState === "denied" ? "مۆڵەتی وێبگەڕ ڕەتکراوەتەوە" : pushState === "unsupported" ? "ئەم وێبگەڕە پشتگیری ناکات" : "بۆ وەرگرتنی ئاگاداری، چالاکی بکە"}</p>
                </div>
                {pushState === "on" ? (
                  <button onClick={() => void disablePush()} disabled={pushBusy} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-bold disabled:opacity-50">{pushBusy ? "..." : "ناچالاککردن"}</button>
                ) : (
                  <button onClick={() => void enablePush()} disabled={pushBusy || pushState === "unsupported" || pushState === "denied"} className="rounded-lg bg-shakh-blue px-3 py-2 text-xs font-bold text-white disabled:opacity-50">{pushBusy ? "..." : "چالاککردن"}</button>
                )}
              </div>
              {pushMessage && <p role="status" className="mt-2 text-xs text-slate-600">{pushMessage}</p>}
            </div>
            <div className="max-h-[60vh] overflow-y-auto">
              {notices.length === 0 ? <p className="p-8 text-center text-sm text-slate-500">هیچ ئاگادارییەک نییە.</p> : notices.map((item) => (
                <button key={item.id} onClick={() => { if (!item.read_at) void markRead(item.id); }} className={"block w-full border-t px-4 py-3 text-right hover:bg-slate-50 " + (item.read_at ? "bg-white" : "bg-orange-50/70")}>
                  <div className="flex items-start justify-between gap-3"><b className="text-sm">{item.title}</b>{!item.read_at && <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-shakh-orange"/>}</div>
                  <p className="mt-1 text-sm text-slate-600">{item.body}</p>
                  <time className="mt-2 block text-[11px] text-slate-400">{new Date(item.created_at).toLocaleString("ckb-IQ")}</time>
                </button>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
