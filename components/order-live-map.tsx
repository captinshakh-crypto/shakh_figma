"use client";

import { useEffect, useMemo, useState } from "react";
import { MapPin, Navigation } from "lucide-react";

type Props = {
  latitude: number;
  longitude: number;
  accuracyM?: number | null;
  updatedAt: string;
};

export default function OrderLiveMap({ latitude, longitude, accuracyM, updatedAt }: Props) {
  const [stale, setStale] = useState(false);

  const mapUrl = useMemo(() => {
    const safeLatitude = Math.max(-85, Math.min(85, latitude));
    const safeLongitude = Math.max(-180, Math.min(180, longitude));
    const lonPadding = 0.012 / Math.max(Math.cos((safeLatitude * Math.PI) / 180), 0.25);
    const latPadding = 0.007;
    const bbox = [
      safeLongitude - lonPadding,
      safeLatitude - latPadding,
      safeLongitude + lonPadding,
      safeLatitude + latPadding,
    ].map((value) => value.toFixed(6)).join(",");
    return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${safeLatitude.toFixed(6)},${safeLongitude.toFixed(6)}`;
  }, [latitude, longitude]);

  useEffect(() => {
    const updateStale = () => setStale(Date.now() - new Date(updatedAt).getTime() > 90000);
    updateStale();
    const timer = window.setInterval(updateStale, 15000);
    return () => window.clearInterval(timer);
  }, [updatedAt]);

  const openUrl = `https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}#map=16/${latitude}/${longitude}`;

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-2 p-3">
        <div className="flex items-center gap-2 font-black text-sm">
          <MapPin size={17} className="text-shakh-orange"/>
          شوێنی کپتن
        </div>
        <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${stale ? "bg-amber-50 text-amber-700" : "bg-green-50 text-green-700"}`}>
          {stale ? "شوێنەکە نوێ نییە" : "نوێکراوە"}
        </span>
      </div>
      <iframe
        title="نەخشەی شوێنی کپتن"
        src={mapUrl}
        loading="lazy"
        referrerPolicy="strict-origin-when-cross-origin"
        className="h-64 w-full border-0"
      />
      <div className="flex flex-wrap items-center justify-between gap-2 p-3 text-xs text-slate-500">
        <span>
          {new Date(updatedAt).toLocaleString("ckb-IQ")}
          {accuracyM !== null && accuracyM !== undefined ? ` · وردی GPS نزیکەی ${Math.round(accuracyM)} مەتر` : ""}
        </span>
        <a href={openUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-bold text-shakh-blue">
          <Navigation size={13}/> کردنەوە لە نەخشە
        </a>
      </div>
      <p className="border-t border-slate-100 px-3 py-2 text-[11px] text-slate-400">نەخشە: © OpenStreetMap contributors</p>
    </section>
  );
}
