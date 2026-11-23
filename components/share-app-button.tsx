"use client";

import { useState } from "react";
import { Share2, Check, Copy } from "lucide-react";

function getPublicShareUrl() {
  const current = new URL(window.location.href);
  const canonicalOrigin = "https://www.daim-post.online";
  const privatePrefixes = ["/dashboard", "/cart", "/login", "/forgot-password", "/reset-password", "/auth"];
  const isPrivate = privatePrefixes.some((prefix) =>
    current.pathname === prefix || current.pathname.startsWith(prefix + "/")
  );
  if (isPrivate) return canonicalOrigin + "/";
  return canonicalOrigin + current.pathname + current.search;
}

async function copyText(value: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }
  const field = document.createElement("textarea");
  field.value = value;
  field.setAttribute("readonly", "");
  field.style.position = "fixed";
  field.style.opacity = "0";
  document.body.appendChild(field);
  field.select();
  const copied = document.execCommand("copy");
  field.remove();
  if (!copied) throw new Error("Copy was not available");
}

export default function ShareAppButton() {
  const [status, setStatus] = useState<"idle" | "shared" | "copied" | "error">("idle");

  async function share() {
    const url = getPublicShareUrl();
    const payload = {
      title: "SHAKH STORE | شاخ ستۆر",
      text: "شاخ ستۆر – بازاڕی ئۆنلاین و گەیاندنی چێشتخانە، سوپەرمارکێت، گۆشت و سپیاتی و بەقالی.",
      url,
    };
    setStatus("idle");
    try {
      if (typeof navigator.share === "function") {
        await navigator.share(payload);
        setStatus("shared");
        return;
      }
      await copyText(url);
      setStatus("copied");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      try { await copyText(url); setStatus("copied"); }
      catch { setStatus("error"); }
    }
  }

  const label = status === "shared" ? "بەستەرەکە شێر کرا"
    : status === "copied" ? "بەستەر کۆپی کرا"
    : status === "error" ? "شێرکردن بەردەست نییە" : "شێرکردن";

  return (
    <div className="shakh-share-control" dir="rtl">
      <button type="button" onClick={() => void share()}
        aria-label="شێرکردنی بەستەری شاخ ستۆر" title="شێرکردنی شاخ ستۆر"
        className="inline-flex items-center gap-2 rounded-full border border-orange-300/70 bg-gradient-to-l from-[#ff9d13] via-[#ff7115] to-[#ef4b12] px-4 py-3 text-xs font-black text-white shadow-lg shadow-orange-300/40 transition hover:-translate-y-0.5 hover:brightness-105 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f47721]">
        {status === "copied" || status === "shared" ? <Check size={17}/> : <Share2 size={17}/>}
        <span>{label}</span>
      </button>
      <span className="sr-only" role="status" aria-live="polite">{label}</span>
    </div>
  );
}
