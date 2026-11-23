"use client";

import { useEffect, useMemo, useState } from "react";
import { MapPin, Navigation, Clock3, Crosshair, ExternalLink } from "lucide-react";

type Props = {
  latitude: number;
  longitude: number;
  accuracyM?: number | null;
  updatedAt: string;
  deliveryAddress?: string | null;
  deliveryLatitude?: number | null;
  deliveryLongitude?: number | null;
};

export default function OrderLiveMap({ latitude, longitude, accuracyM, updatedAt, deliveryAddress, deliveryLatitude, deliveryLongitude }: Props) {
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

  const hasDestination = Number.isFinite(deliveryLatitude) && Number.isFinite(deliveryLongitude)
    && deliveryLatitude! >= -90 && deliveryLatitude! <= 90
    && deliveryLongitude! >= -180 && deliveryLongitude! <= 180;
  const openUrl = hasDestination
    ? `https://www.openstreetmap.org/directions?engine=fossgis_osrm_car&route=${latitude},${longitude};${deliveryLatitude},${deliveryLongitude}`
    : `https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}#map=16/${latitude}/${longitude}`;
  const wazeUrl = hasDestination
    ? `https://waze.com/ul?ll=${deliveryLatitude},${deliveryLongitude}&navigate=yes`
    : deliveryAddress?.trim()
      ? `https://waze.com/ul?q=${encodeURIComponent(deliveryAddress.trim())}&navigate=yes`
      : null;
  const routeMapDocument = hasDestination ? `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<style>html,body,#map{height:100%;width:100%;margin:0} .leaflet-container{font:12px system-ui,sans-serif}</style>
</head>
<body>
<div id="map"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
(function(){
  const start=[${latitude},${longitude}], end=[${deliveryLatitude},${deliveryLongitude}];
  const map=L.map('map',{scrollWheelZoom:false}).fitBounds([start,end],{padding:[28,28]});
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; OpenStreetMap contributors'}).addTo(map);
  L.circleMarker(start,{radius:8,color:'#ffffff',weight:3,fillColor:'#2563eb',fillOpacity:1}).addTo(map).bindPopup('کاپتن');
  L.circleMarker(end,{radius:8,color:'#ffffff',weight:3,fillColor:'#f97316',fillOpacity:1}).addTo(map).bindPopup('Delivery destination');
  const routeUrl='https://router.project-osrm.org/route/v1/driving/'+start[1]+','+start[0]+';'+end[1]+','+end[0]+'?overview=full&geometries=geojson';
  fetch(routeUrl).then(r=>{if(!r.ok)throw new Error('route');return r.json()}).then(data=>{
    if(!data.routes||!data.routes[0])throw new Error('route');
    const line=L.geoJSON(data.routes[0].geometry,{style:{color:'#f97316',weight:6,opacity:.9}}).addTo(map);
    map.fitBounds(line.getBounds(),{padding:[28,28]});
  }).catch(()=>{
    const status=document.createElement('div');
    status.textContent='Road route is temporarily unavailable';
    status.style.cssText='position:absolute;z-index:1000;bottom:12px;left:12px;background:#fff;padding:8px 10px;border-radius:8px;box-shadow:0 1px 5px #0003;font:12px system-ui';
    document.body.appendChild(status);
  });
})();
</script>
</body>
</html>` : null;

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-slate-50/80 p-4">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-shakh-blue">
            <MapPin size={19}/>
          </span>
          <div>
            <h3 className="text-sm font-black text-slate-900">شوێنی زیندووی کاپتن</h3>
            <p className="mt-0.5 text-[11px] text-slate-500">{hasDestination ? "ڕێگای کاپتن بۆ شوێنی کڕیار · OpenStreetMap" : "شوێنی زیندووی کاپتن · OpenStreetMap"}</p>
          </div>
        </div>
        <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold ${stale ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700"}`}>
          <span className={`h-2 w-2 rounded-full ${stale ? "bg-amber-500" : "bg-emerald-500"}`}/>
          {stale ? "شوێنەکە کۆنە" : "شوێنەکە نوێیە"}
        </span>
      </div>

      <div className="relative bg-slate-100">
        {routeMapDocument ? (
          <iframe
            title="نەخشەی ڕێگای کاپتن بۆ شوێنی کڕیار"
            srcDoc={routeMapDocument}
            sandbox="allow-scripts allow-same-origin"
            loading="lazy"
            referrerPolicy="strict-origin-when-cross-origin"
            className="h-72 w-full border-0 sm:h-80"
          />
        ) : (
          <iframe
            title="نەخشەی شوێنی زیندووی کاپتن"
            src={mapUrl}
            loading="lazy"
            referrerPolicy="strict-origin-when-cross-origin"
            className="h-72 w-full border-0 sm:h-80"
          />
        )}
        <div className="pointer-events-none absolute bottom-3 left-3 rounded-lg border border-slate-200 bg-white/95 px-3 py-2 text-[11px] font-bold text-slate-700 shadow-sm">
          <span className="inline-flex items-center gap-1.5"><Crosshair size={13} className="text-shakh-orange"/> شوێنی دوا نوێکردنەوە</span>
        </div>
      </div>

      <div className="grid gap-3 p-4 sm:grid-cols-[1fr_auto] sm:items-center">
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-slate-50 p-3">
            <p className="flex items-center gap-1 text-[11px] text-slate-500"><Clock3 size={12}/> دوا نوێکردنەوە</p>
            <p className="mt-1 text-xs font-bold text-slate-800">{new Date(updatedAt).toLocaleString("ckb-IQ")}</p>
          </div>
          <div className="rounded-xl bg-slate-50 p-3">
            <p className="flex items-center gap-1 text-[11px] text-slate-500"><Crosshair size={12}/> وردی GPS</p>
            <p className="mt-1 text-xs font-bold text-slate-800">
              {accuracyM !== null && accuracyM !== undefined ? `نزیکەی ${Math.round(accuracyM)} مەتر` : "بەردەست نییە"}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {wazeUrl && <a href={wazeUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-shakh-orange px-4 py-2.5 text-sm font-bold text-white transition hover:opacity-90">
            <Navigation size={16}/> ڕێگای گەیاندن لە Waze <ExternalLink size={13}/>
          </a>}
          <a href={openUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-shakh-blue px-4 py-2.5 text-sm font-bold text-white transition hover:opacity-90">
            <MapPin size={16}/> کردنەوەی شوێن لە نەخشە <ExternalLink size={13}/>
          </a>
        </div>
      </div>
      <p className="border-t border-slate-100 px-4 py-2 text-[10px] text-slate-400">نەخشە: © OpenStreetMap contributors</p>
    </section>
  );
}
