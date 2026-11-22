"use client";
import { useEffect, useId, useRef, useState } from "react";
type Position=[number,number];
export type ZoneBoundary={type:"Polygon";coordinates:Position[][]};
type Layer={addTo(map:MapApi):Layer;remove():void};
type MapApi={setView(center:Position,zoom:number):MapApi;on(event:"click",handler:(event:{latlng:{lat:number;lng:number}})=>void):MapApi;fitBounds(bounds:unknown,options?:Record<string,unknown>):MapApi;remove():void};
type LeafletApi={map(element:string,options?:Record<string,unknown>):MapApi;tileLayer(url:string,options:Record<string,unknown>):Layer;polygon(points:Position[],options:Record<string,unknown>):Layer;marker(point:Position):Layer;latLngBounds(points:Position[]):unknown};
declare global{interface Window{L?:LeafletApi}}
function loadLeaflet():Promise<LeafletApi>{
 if(window.L)return Promise.resolve(window.L);
 if(!document.getElementById("shakh-leaflet-css")){const link=document.createElement("link");link.id="shakh-leaflet-css";link.rel="stylesheet";link.href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";document.head.appendChild(link);}
 return new Promise((resolve,reject)=>{const script=document.createElement("script");script.id="shakh-leaflet-js";script.src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";script.async=true;script.onload=()=>window.L?resolve(window.L):reject(new Error("Leaflet failed"));script.onerror=()=>reject(new Error("Leaflet failed"));document.body.appendChild(script);});
}
export function ZoneBoundaryEditor({initialValue,onChange}:{initialValue:ZoneBoundary|null;onChange:(value:ZoneBoundary|null)=>void}){
 const mapId=useId().replace(/:/g,"");const initialValueRef=useRef(initialValue);const pointsRef=useRef<Position[]>([]);const mapRef=useRef<MapApi|null>(null);const polygonRef=useRef<Layer|null>(null);const markersRef=useRef<Layer[]>([]);const onChangeRef=useRef(onChange);const [pointCount,setPointCount]=useState(0);const [mapError,setMapError]=useState("");
 useEffect(()=>{onChangeRef.current=onChange;},[onChange]);
 useEffect(()=>{
  let disposed=false;let map:MapApi|null=null;const ring=initialValueRef.current?.coordinates?.[0]||[];
  pointsRef.current=ring.length>1?ring.slice(0,-1).map(([lng,lat])=>[lat,lng] as Position):[];setPointCount(pointsRef.current.length);
  const draw=(L:LeafletApi)=>{if(!map)return;polygonRef.current?.remove();markersRef.current.forEach(x=>x.remove());markersRef.current=pointsRef.current.map(p=>L.marker(p).addTo(map as MapApi));polygonRef.current=pointsRef.current.length>=2?L.polygon(pointsRef.current,{color:"#f97316",weight:3,fillColor:"#f97316",fillOpacity:pointsRef.current.length>=3?0.18:0.04}).addTo(map):null;
   if(pointsRef.current.length>=3){const closed=[...pointsRef.current,pointsRef.current[0]];onChangeRef.current({type:"Polygon",coordinates:[closed.map(([lat,lng])=>[lng,lat] as Position)]});}else onChangeRef.current(null);setPointCount(pointsRef.current.length);};
  void loadLeaflet().then(L=>{if(disposed)return;map=L.map(mapId,{scrollWheelZoom:true}).setView([36.45,43.75],9);mapRef.current=map;L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{maxZoom:19,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'}).addTo(map);
   if(pointsRef.current.length>1){map.fitBounds(L.latLngBounds(pointsRef.current),{padding:[24,24]});draw(L);}map.on("click",e=>{pointsRef.current=[...pointsRef.current,[e.latlng.lat,e.latlng.lng]];draw(L);});
  }).catch(()=>{if(!disposed)setMapError("نەخشە بارنەبوو؛ تکایە ئینتەرنێت بپشکنە و پەڕەکە نوێ بکەرەوە.");});
  return()=>{disposed=true;map?.remove();mapRef.current=null;};
 },[mapId]);
 function redraw(){if(!mapRef.current||!window.L)return;const L=window.L;polygonRef.current?.remove();markersRef.current.forEach(x=>x.remove());markersRef.current=pointsRef.current.map(p=>L.marker(p).addTo(mapRef.current as MapApi));polygonRef.current=pointsRef.current.length>=2?L.polygon(pointsRef.current,{color:"#f97316",weight:3,fillColor:"#f97316",fillOpacity:pointsRef.current.length>=3?0.18:0.04}).addTo(mapRef.current):null;
  if(pointsRef.current.length>=3){const closed=[...pointsRef.current,pointsRef.current[0]];onChangeRef.current({type:"Polygon",coordinates:[closed.map(([lat,lng])=>[lng,lat] as Position)]});}else onChangeRef.current(null);setPointCount(pointsRef.current.length);}
 function undoPoint(){pointsRef.current=pointsRef.current.slice(0,-1);redraw();}
 function clearBoundary(){pointsRef.current=[];redraw();}
 return <section className="rounded-2xl border border-orange-200 bg-orange-50/50 p-4"><div className="flex flex-wrap items-center justify-between gap-2"><div><h3 className="font-black">سنووری جوگرافیایی زۆن</h3><p className="mt-1 text-xs leading-6 text-slate-600">لەسەر نەخشە کلیک بکە و لانیکەم ٣ خاڵ دیاری بکە بۆ دروستکردنی سنووری زۆنەکە. خاڵەکان بە ڕیز دابنێ.</p></div><span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-shakh-blue">{pointCount} خاڵ</span></div><div id={mapId} className="mt-3 h-[340px] w-full overflow-hidden rounded-xl border border-slate-200 bg-slate-100"/>{mapError&&<p role="alert" className="mt-2 text-sm text-rose-700">{mapError}</p>}<div className="mt-3 flex flex-wrap gap-2"><button type="button" onClick={undoPoint} disabled={pointCount===0} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-bold disabled:opacity-40">گەڕانەوەی خاڵی دواوە</button><button type="button" onClick={clearBoundary} disabled={pointCount===0} className="rounded-lg border border-rose-200 bg-white px-4 py-2 text-sm font-bold text-rose-700 disabled:opacity-40">پاککردنەوەی سنوور</button></div><p className="mt-2 text-xs text-slate-500">{pointCount>=3?"سنووری زۆن ئامادەیە؛ دوای پاشەکەوتکردن لە Checkout بە GPS پشکنین دەکرێت.":"هێشتا سنووری تەواو نییە؛ تا ٣ خاڵ زیاد نەکەیت سنوور پاشەکەوت ناکرێت."}</p></section>;
}
