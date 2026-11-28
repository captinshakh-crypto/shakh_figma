"use client";

import { useEffect, useId, useRef, useState } from "react";

type CircleCenter = { latitude: number; longitude: number };
type Layer = { addTo(map: MapApi): Layer; remove(): void };
type MapApi = {
  setView(center: [number, number], zoom: number): MapApi;
  on(event: "click", handler: (event: { latlng: { lat: number; lng: number } }) => void): MapApi;
  fitBounds(bounds: unknown, options?: Record<string, unknown>): MapApi;
  remove(): void;
};
type LeafletApi = {
  map(element: string, options?: Record<string, unknown>): MapApi;
  tileLayer(url: string, options: Record<string, unknown>): Layer;
  circle(center: [number, number], options: Record<string, unknown>): Layer;
  marker(point: [number, number]): Layer;
  latLngBounds(points: [number, number][]): unknown;
};
type WindowWithLeaflet = Window & { L?: LeafletApi };
function getLeaflet(): LeafletApi | undefined {
  return (window as WindowWithLeaflet).L;
}

function loadLeaflet(): Promise<LeafletApi> {
  if (getLeaflet()) return Promise.resolve(getLeaflet() as LeafletApi);
  if (!document.getElementById("shakh-leaflet-css")) {
    const link = document.createElement("link");
    link.id = "shakh-leaflet-css";
    link.rel = "stylesheet";
    link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
    document.head.appendChild(link);
  }
  return new Promise((resolve, reject) => {
    const existing = document.getElementById("shakh-leaflet-js") as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener("load", () => getLeaflet() ? resolve(getLeaflet()) : reject(new Error("Leaflet failed")), { once: true });
      existing.addEventListener("error", () => reject(new Error("Leaflet failed")), { once: true });
      return;
    }
    const script = document.createElement("script");
    script.id = "shakh-leaflet-js";
    script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
    script.async = true;
    script.onload = () => getLeaflet() ? resolve(getLeaflet() as LeafletApi) : reject(new Error("Leaflet failed"));
    script.onerror = () => reject(new Error("Leaflet failed"));
    document.body.appendChild(script);
  });
}

export function ZoneCircleEditor({
  center,
  onChange,
  innerRadiusM,
  outerRadiusM,
  allowCenterChange,
}: {
  center: CircleCenter | null;
  onChange: (value: CircleCenter | null) => void;
  innerRadiusM: number;
  outerRadiusM: number;
  allowCenterChange: boolean;
}) {
  const mapId = useId().replace(/:/g, "");
  const mapRef = useRef<MapApi | null>(null);
  const centerRef = useRef(center);
  const onChangeRef = useRef(onChange);
  const innerRadiusRef = useRef(innerRadiusM);
  const outerRadiusRef = useRef(outerRadiusM);
  const circleLayersRef = useRef<Layer[]>([]);
  const centerMarkerRef = useRef<Layer | null>(null);
  const [mapError, setMapError] = useState("");

  useEffect(() => { centerRef.current = center; }, [center]);
  useEffect(() => { onChangeRef.current = onChange; }, [onChange]);
  useEffect(() => { innerRadiusRef.current = innerRadiusM; outerRadiusRef.current = outerRadiusM; }, [innerRadiusM, outerRadiusM]);

  useEffect(() => {
    let disposed = false;
    let map: MapApi | null = null;
    void loadLeaflet().then((L) => {
      if (disposed) return;
      const start: [number, number] = centerRef.current
        ? [centerRef.current.latitude, centerRef.current.longitude]
        : [36.1911, 44.0092];
      map = L.map(mapId, { scrollWheelZoom: true }).setView(start, centerRef.current ? 13 : 10);
      mapRef.current = map;
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(map);
      if (allowCenterChange) {
        map.on("click", (event) => {
          const next = { latitude: event.latlng.lat, longitude: event.latlng.lng };
          centerRef.current = next;
          onChangeRef.current(next);
          redraw(L, next, innerRadiusRef.current, outerRadiusRef.current);
        });
      }
      redraw(L, centerRef.current, innerRadiusRef.current, outerRadiusRef.current);
    }).catch(() => {
      if (!disposed) setMapError("نەخشە بارنەبوو؛ تکایە ئینتەرنێت بپشکنە و پەڕەکە نوێ بکەرەوە.");
    });
    return () => {
      disposed = true;
      map?.remove();
      mapRef.current = null;
    };
  }, [mapId]);

  useEffect(() => {
    const L = getLeaflet();
    if (!L || !mapRef.current) return;
    redraw(L, center, innerRadiusM, outerRadiusM);
  }, [center, innerRadiusM, outerRadiusM]);

  function redraw(L: LeafletApi, current: CircleCenter | null, inner: number, outer: number) {
    circleLayersRef.current.forEach((layer) => layer.remove());
    circleLayersRef.current = [];
    centerMarkerRef.current?.remove();
    centerMarkerRef.current = null;
    if (!current || !mapRef.current) return;
    const point: [number, number] = [current.latitude, current.longitude];
    circleLayersRef.current.push(L.circle(point, {
      radius: Math.max(1, outer),
      color: "#f97316",
      weight: 3,
      fillColor: "#f97316",
      fillOpacity: 0.10,
    }).addTo(mapRef.current));
    if (inner > 0) {
      circleLayersRef.current.push(L.circle(point, {
        radius: inner,
        color: "#2563eb",
        weight: 2,
        dashArray: "7 6",
        fill: false,
      }).addTo(mapRef.current));
    }
    centerMarkerRef.current = L.marker(point).addTo(mapRef.current);
  }

  return (
    <section className="rounded-2xl border border-orange-200 bg-orange-50/50 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="font-black">ناوەندی بازنە و مەودای زۆن</h3>
          <p className="mt-1 text-xs leading-6 text-slate-600">
            {allowCenterChange
              ? "یەک جار لە شوێنی دوکان لەسەر نەخشە کلیک بکە بۆ دیاریکردنی ناوەندی هەموو بازنەکان."
              : "ناوەندی هەموو بازنەکان لە یەک شوێنە؛ بۆشایی نێوان زۆنەکان نییە."}
          </p>
        </div>
        <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-shakh-blue">
          مەودای ناوەوە: {(innerRadiusM / 1000).toFixed(2)} کم
        </span>
      </div>
      <div id={mapId} className="mt-3 h-[340px] w-full overflow-hidden rounded-xl border border-slate-200 bg-slate-100" />
      {mapError && <p role="alert" className="mt-2 text-sm text-rose-700">{mapError}</p>}
      <div className="mt-3 grid gap-2 text-xs text-slate-600 sm:grid-cols-2">
        <p className="rounded-lg bg-white p-3">ناوەند: {center ? `${center.latitude.toFixed(6)}, ${center.longitude.toFixed(6)}` : "هێشتا دیاری نەکراوە"}</p>
        <p className="rounded-lg bg-white p-3">بازنەی دەرەوە: {(outerRadiusM / 1000).toFixed(2)} کم</p>
      </div>
    </section>
  );
}
