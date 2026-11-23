"use client";

import { useEffect } from "react";

export function PwaRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    let active = true;
    let registration: ServiceWorkerRegistration | null = null;

    const checkForUpdates = () => {
      if (active && navigator.onLine && registration) {
        void registration.update().catch(() => undefined);
      }
    };

    void navigator.serviceWorker.register("/sw.js", {
      scope: "/",
      updateViaCache: "none",
    }).then((value) => {
      if (!active) return;
      registration = value;
      if (navigator.onLine) void registration.update().catch(() => undefined);
    }).catch(() => {
      // A failed registration must not prevent the website from working normally.
    });

    window.addEventListener("online", checkForUpdates);
    window.addEventListener("focus", checkForUpdates);
    document.addEventListener("visibilitychange", checkForUpdates);

    return () => {
      active = false;
      window.removeEventListener("online", checkForUpdates);
      window.removeEventListener("focus", checkForUpdates);
      document.removeEventListener("visibilitychange", checkForUpdates);
    };
  }, []);

  return null;
}
