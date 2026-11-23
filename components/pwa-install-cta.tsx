"use client";

import { useEffect, useState } from "react";
import { Download, Share, PlusSquare, X } from "lucide-react";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

export default function PwaInstallCta({ compact = false }: { compact?: boolean }) {
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
  const [isIOS, setIsIOS] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [showIOSHelp, setShowIOSHelp] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const ua = window.navigator.userAgent;
    const ios = /iPhone|iPad|iPod/i.test(ua) ||
      (window.navigator.platform === "MacIntel" && window.navigator.maxTouchPoints > 1);
    const standalone = window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
    const safari = /Safari/i.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS/i.test(ua);
    setIsIOS(ios && safari);
    setInstalled(standalone);

    const onBeforeInstall = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setInstallPrompt(null);
      setShowIOSHelp(false);
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  async function install() {
    if (isIOS && !installPrompt) {
      setShowIOSHelp((current) => !current);
      return;
    }
    if (!installPrompt || busy) return;
    setBusy(true);
    try {
      await installPrompt.prompt();
      const choice = await installPrompt.userChoice;
      if (choice.outcome === "accepted") setInstalled(true);
      setInstallPrompt(null);
    } finally {
      setBusy(false);
    }
  }

  if (installed || (!installPrompt && !isIOS)) return null;

  return (
    <div className="relative">
      <button type="button" onClick={() => void install()} disabled={busy}
        className={compact
          ? "inline-flex items-center gap-1.5 rounded-xl border border-orange-200 bg-orange-50 px-3 py-2.5 text-xs font-black text-[#bf570f] transition hover:bg-orange-100 disabled:opacity-50"
          : "inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-sm font-bold text-white transition hover:bg-white/15 disabled:opacity-50"}>
        <Download size={16}/>
        {busy ? "..." : isIOS && !installPrompt ? "زیادکردن بۆ مۆبایل" : "دامەزراندنی ئەپ"}
      </button>
      {showIOSHelp && isIOS && (
        <div role="dialog" aria-label="ڕێنمایی دامەزراندنی شاخ" dir="rtl"
          className="absolute left-0 top-full z-50 mt-2 w-[min(88vw,310px)] rounded-2xl border border-slate-200 bg-white p-4 text-right text-slate-800 shadow-2xl">
          <div className="flex items-center justify-between gap-3">
            <b className="text-sm">زیادکردنی شاخ بۆ شاشەی سەرەکی</b>
            <button type="button" onClick={() => setShowIOSHelp(false)} aria-label="داخستن" className="rounded-lg bg-slate-100 p-1.5"><X size={15}/></button>
          </div>
          <p className="mt-2 text-xs leading-6 text-slate-600">لە Safari ـدا، دوگمەی هاوبەشکردن هەڵبژێرە و پاشان «Add to Home Screen» زیاد بکە.</p>
          <div className="mt-3 flex items-center gap-3 rounded-xl bg-blue-50 p-3 text-xs font-bold text-[#1769aa]">
            <Share size={19}/> دوگمەی Share
            <span className="text-slate-400">←</span>
            <PlusSquare size={19}/> Add to Home Screen
          </div>
        </div>
      )}
    </div>
  );
}
