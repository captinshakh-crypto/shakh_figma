"use client";

import { useEffect, useState } from "react";
import { Download, Share, PlusSquare, X } from "lucide-react";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

export default function PwaInstallCta({ compact = false }: { compact?: boolean }) {
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
  const [isIOSDevice, setIsIOSDevice] = useState(false);
  const [isIOSBrowser, setIsIOSBrowser] = useState(false);
  const [isAndroid, setIsAndroid] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const ua = window.navigator.userAgent;
    const ios = /iPhone|iPad|iPod/i.test(ua) ||
      (window.navigator.platform === "MacIntel" && window.navigator.maxTouchPoints > 1);
    const safari = /Safari/i.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS/i.test(ua);
    const standalone = window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true;

    setIsIOSDevice(ios);
    setIsIOSBrowser(ios && safari);
    setIsAndroid(/Android/i.test(ua));
    setInstalled(standalone);

    const onBeforeInstall = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setInstallPrompt(null);
      setShowHelp(false);
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  async function install() {
    if (busy) return;
    if (!installPrompt) {
      setShowHelp((current) => !current);
      return;
    }
    setBusy(true);
    try {
      await installPrompt.prompt();
      const choice = await installPrompt.userChoice;
      if (choice.outcome === "accepted") setInstalled(true);
      setInstallPrompt(null);
      setShowHelp(choice.outcome !== "accepted");
    } catch {
      setShowHelp(true);
    } finally {
      setBusy(false);
    }
  }

  if (installed) return null;

  const buttonClass = compact
    ? "inline-flex items-center gap-1.5 rounded-xl border border-orange-200 bg-orange-50 px-3 py-2.5 text-xs font-black text-[#bf570f] transition hover:bg-orange-100 disabled:opacity-50"
    : "inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-sm font-bold text-white transition hover:bg-white/15 disabled:opacity-50";

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => void install()}
        aria-expanded={showHelp}
        aria-haspopup="dialog"
        disabled={busy}
        className={buttonClass}
      >
        <Download size={16}/>
        {busy ? "..." : "دامەزراندنی ئەپ"}
      </button>
      {showHelp && (
        <div role="dialog" aria-label="ڕێنمایی دامەزراندنی شاخ" dir="rtl"
          className="absolute left-0 top-full z-[120] mt-2 w-[min(88vw,320px)] rounded-2xl border border-slate-200 bg-white p-4 text-right text-slate-800 shadow-2xl">
          <div className="flex items-center justify-between gap-3">
            <b className="text-sm">دامەزراندنی شاخ لەسەر ئامێرەکەت</b>
            <button type="button" onClick={() => setShowHelp(false)} aria-label="داخستن" className="rounded-lg bg-slate-100 p-1.5"><X size={15}/></button>
          </div>
          {isIOSDevice ? (
            <>
              <p className="mt-2 text-xs leading-6 text-slate-600">
                {isIOSBrowser
                  ? "لە Safari ـدا، دوگمەی هاوبەشکردن هەڵبژێرە و پاشان «Add to Home Screen» زیاد بکە."
                  : "بۆ دامەزراندن، بەستەرەکە لە Safari بکەرەوە، دوگمەی Share هەڵبژێرە و «Add to Home Screen» زیاد بکە."}
              </p>
              <div className="mt-3 flex items-center gap-3 rounded-xl bg-blue-50 p-3 text-xs font-bold text-[#1769aa]">
                <Share size={19}/> Share <span className="text-slate-400">←</span> <PlusSquare size={19}/> Add to Home Screen
              </div>
            </>
          ) : isAndroid ? (
            <p className="mt-2 text-xs leading-6 text-slate-600">
              لە Chrome ـدا مینیوی سێ خاڵی (⋮) بکەرەوە و «Install app» یان «Add to Home screen» هەڵبژێرە. ئەگەر دوگمەی دامەزراندنی ڕاستەوخۆ بەردەست بێت، لەم شوێنەوە دەکرێتەوە.
            </p>
          ) : (
            <p className="mt-2 text-xs leading-6 text-slate-600">
              لە Chrome یان Edge ـدا ئایکۆنی دامەزراندن لە کەناری ناونیشانی وێبسایت هەڵبژێرە، یان لە مینیوی وێبگەڕ «Install app» بکەرەوە. ئەگەر ئەم هەڵبژاردەیە نەبوو، ئەو وێبگەڕە لە ئێستادا دامەزراندنی PWA پشتگیری ناکات.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
