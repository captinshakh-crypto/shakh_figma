"use client";

import { useEffect, useState } from "react";
import { Download, Share, PlusSquare, X, MoreVertical, MonitorDown } from "lucide-react";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

type InstallPlatform =
  | "ios-safari"
  | "ios-other"
  | "mac-safari"
  | "android"
  | "desktop"
  | "other";

export default function PwaInstallCta({ compact = false }: { compact?: boolean }) {
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
  const [platform, setPlatform] = useState<InstallPlatform>("other");
  const [installed, setInstalled] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const ua = window.navigator.userAgent;
    const navigatorWithStandalone = window.navigator as Navigator & { standalone?: boolean };
    const isIOS =
      /iPhone|iPad|iPod/i.test(ua) ||
      (window.navigator.platform === "MacIntel" && window.navigator.maxTouchPoints > 1);
    const isMac = !isIOS && (/Macintosh|Mac OS X/i.test(ua) || /^Mac/i.test(window.navigator.platform));
    const isSafari =
      /Safari/i.test(ua) &&
      !/Chrome|Chromium|CriOS|Edg|EdgiOS|FxiOS|Firefox|OPR|OPiOS/i.test(ua);
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      navigatorWithStandalone.standalone === true;

    if (isIOS) setPlatform(isSafari ? "ios-safari" : "ios-other");
    else if (isMac && isSafari) setPlatform("mac-safari");
    else if (/Android/i.test(ua)) setPlatform("android");
    else if (!/Android|iPhone|iPad|iPod/i.test(ua)) setPlatform("desktop");
    else setPlatform("other");

    setInstalled(standalone);

    const onBeforeInstall = (event: Event) => {
      // Keep the browser's native install prompt for the user's button click.
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
      setShowHelp(false);
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

    // iOS/iPadOS and Safari on macOS use their own Add to Home Screen / Dock flow.
    if (platform === "ios-safari" || platform === "ios-other" || platform === "mac-safari") {
      setShowHelp(true);
      return;
    }

    // Chromium exposes the native install dialog through beforeinstallprompt.
    if (!installPrompt) {
      setShowHelp(true);
      return;
    }

    setBusy(true);
    try {
      await installPrompt.prompt();
      const choice = await installPrompt.userChoice;
      setInstallPrompt(null);
      if (choice.outcome === "accepted") {
        setInstalled(true);
        setShowHelp(false);
      } else {
        setShowHelp(true);
      }
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
        {busy ? "چاوەڕێ بکە..." : "دامەزراندنی ئەپ"}
      </button>

      {showHelp && (
        <div
          role="dialog"
          aria-label="ڕێنمایی دامەزراندنی شاخ"
          dir="rtl"
          className="absolute left-0 top-full z-[120] mt-2 w-[min(88vw,340px)] max-h-[min(76vh,460px)] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-4 text-right text-slate-800 shadow-2xl"
        >
          <div className="flex items-center justify-between gap-3">
            <b className="text-sm">دامەزراندنی شاخ ستۆر</b>
            <button
              type="button"
              onClick={() => setShowHelp(false)}
              aria-label="داخستن"
              className="rounded-lg bg-slate-100 p-1.5"
            >
              <X size={15}/>
            </button>
          </div>

          {platform === "ios-safari" ? (
            <>
              <p className="mt-2 text-xs leading-6 text-slate-600">
                بۆ زیادکردنی شاخ بۆ شاشەی سەرەکی لە iPhone یان iPad:
              </p>
              <ol className="mt-3 space-y-2 text-xs leading-6 text-slate-700">
                <li className="flex items-start gap-2">
                  <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-blue-50 font-black text-blue-700">١</span>
                  لە Safari ئایکۆنی Share ـەکە دابگرە.
                </li>
                <li className="flex items-start gap-2">
                  <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-blue-50 font-black text-blue-700">٢</span>
                  لە لیستەکەدا <b>Add to Home Screen</b> هەڵبژێرە.
                </li>
                <li className="flex items-start gap-2">
                  <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-blue-50 font-black text-blue-700">٣</span>
                  لە سەرەوە <b>Add</b> دابگرە؛ ئایکۆنی شاخ لە شاشەی سەرەکیت دەردەکەوێت.
                </li>
              </ol>
              <div className="mt-3 flex items-center justify-center gap-3 rounded-xl bg-blue-50 p-3 text-xs font-bold text-[#1769aa]">
                <Share size={19}/> Share <span className="text-slate-400">←</span> <PlusSquare size={19}/> Add to Home Screen
              </div>
            </>
          ) : platform === "ios-other" ? (
            <>
              <p className="mt-2 text-xs leading-6 text-slate-600">
                بۆ دامەزراندن لە iPhone یان iPad، ئەم پەڕەیە لە <b>Safari</b> بکەرەوە. پاشان Share دابگرە، <b>Add to Home Screen</b> هەڵبژێرە و <b>Add</b> دابگرە.
              </p>
              <div className="mt-3 flex items-center justify-center gap-3 rounded-xl bg-blue-50 p-3 text-xs font-bold text-[#1769aa]">
                <Share size={19}/> Share <span className="text-slate-400">←</span> <PlusSquare size={19}/> Add to Home Screen
              </div>
            </>
          ) : platform === "mac-safari" ? (
            <p className="mt-2 text-xs leading-6 text-slate-600">
              لە Safari ـی کۆمپیوتەری Mac، لە پەڕەی شاخ مینیوی <b>File</b> بکەرەوە، <b>Add to Dock</b> هەڵبژێرە و پاشان <b>Add</b> دابگرە. ئەمە شاخ وەک ئەپێک لە Dock زیاد دەکات.
            </p>
          ) : platform === "android" ? (
            <>
              <p className="mt-2 text-xs leading-6 text-slate-600">
                ئەگەر پەنجەرەی دامەزراندنی خۆکار نەهاتەوە، لە Chrome مینیوی سێ خاڵەکە (⋮) بکەرەوە، <b>Install app</b> یان <b>Add to Home screen</b> هەڵبژێرە و دامەزراندن پشتڕاست بکەرەوە.
              </p>
              <div className="mt-3 flex items-center gap-2 rounded-xl bg-green-50 p-3 text-xs font-bold text-green-800">
                <MoreVertical size={18}/> Chrome <span>←</span> Install app
              </div>
            </>
          ) : platform === "desktop" ? (
            <>
              <p className="mt-2 text-xs leading-6 text-slate-600">
                لە Chrome یان Edge ـدا، ئەگەر پەنجەرەی دامەزراندن خۆکار نەهاتەوە، ئایکۆنی Install لە کەناری ناونیشانی وێبسایت هەڵبژێرە. لە Chrome دەتوانیت لە مینیوەکەش <b>Install page as app</b> هەڵبژێریت؛ لە Edge <b>Apps</b> و پاشان <b>Install this site as an app</b> هەڵبژێرە.
              </p>
              <div className="mt-3 flex items-center gap-2 rounded-xl bg-blue-50 p-3 text-xs font-bold text-[#1769aa]">
                <MonitorDown size={18}/> Chrome / Edge <span>←</span> Install app
              </div>
            </>
          ) : (
            <p className="mt-2 text-xs leading-6 text-slate-600">
              تکایە شاخ لە Chrome یان Edge بکەرەوە و لە مینیوەکە <b>Install app</b> هەڵبژێرە، ئەگەر ئەم هەڵبژاردەیە بەردەست بوو.
            </p>
          )}

          <p className="mt-3 text-[11px] leading-5 text-slate-400">
            بە دامەزراندن، شاخ وەک ئەپێکی جیاواز لەسەر ئامێرەکەت دەکرێتەوە.
          </p>
        </div>
      )}
    </div>
  );
}
