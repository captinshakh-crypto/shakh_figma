"use client";
import Link from "next/link";
import {useEffect,useState} from "react";
import {createClient} from "@/lib/supabase/client";
type Order={id:string;status:string;merchant_id:string|null;placed_at:string};
type Captain={id:string;full_name:string|null;email:string|null};
export default function CaptainsPage(){const [orders,setOrders]=useState<Order[]>([]);const [captains,setCaptains]=useState<Captain[]>([]);const [message,setMessage]=useState("");
 async function load(){const s=createClient();const {data:{user}}=await s.auth.getUser();if(!user){location.href="/login";return;}const p=await s.from("profiles").select("role").eq("id",user.id).single();if(p.data?.role!=="super_admin"){location.href="/dashboard";return;}const [o,c]=await Promise.all([s.from("orders").select("id,status,merchant_id,placed_at").eq("status","ready_for_pickup").order("placed_at"),s.from("profiles").select("id,full_name,email").eq("role","captain").eq("is_active",true)]);setOrders(o.data||[]);setCaptains(c.data||[]);}
 useEffect(()=>{load().catch(()=>setMessage("نەتوانرا زانیاری باربکرێت."));},[]);
 async function assign(id:string,captain:string){const s=createClient();const {error}=await s.rpc("admin_assign_captain",{p_order_id:id,p_captain_user_id:captain});setMessage(error?.message||"کپتن دیاریکرا.");await load();}
 return <main className="min-h-screen px-4 py-8"><div className="mx-auto max-w-4xl"><Link href="/dashboard/admin" className="font-bold text-shakh-blue">← سوپەر ئەدمین</Link><h1 className="mt-6 text-3xl font-black">دیاریکردنی کپتن</h1>{orders.map(o=><article key={o.id} className="mt-4 rounded-2xl bg-white p-5 shadow-soft"><b>داواکاری {o.id.slice(0,8)}</b><select defaultValue="" onChange={e=>e.target.value&&assign(o.id,e.target.value)} className="mt-3 w-full rounded-xl border p-3"><option value="">کپتن هەڵبژێرە</option>{captains.map(c=><option key={c.id} value={c.id}>{c.full_name||c.email||c.id}</option>)}</select></article>)}{orders.length===0&&<p className="mt-6 rounded-2xl bg-white p-8 text-center text-slate-500">داواکاری ئامادەی گەیاندن نییە.</p>}{message&&<p className="mt-4 text-sm text-shakh-blue">{message}</p>}</div></main>;
}