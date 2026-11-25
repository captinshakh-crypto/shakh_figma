import Link from "next/link";
import { ArrowUpLeft, Headset, MessageCircle, PhoneCall } from "lucide-react";

const supportNumber = "07504796924";
const telephoneHref = "tel:+9647504796924";
const whatsappHref = "https://wa.me/9647504796924";

export function SupportContactSection() {
  return (
    <section
      aria-labelledby="support-contact-title"
      dir="rtl"
      className="relative overflow-hidden border-y border-blue-100 bg-[linear-gradient(135deg,#f1f7fc_0%,#fff_52%,#fff5e9_100%)] px-4 py-12 sm:px-6 sm:py-16"
    >
      <div aria-hidden="true" className="pointer-events-none absolute -left-20 -top-24 h-72 w-72 rounded-full border-[28px] border-orange-100/70"/>
      <div aria-hidden="true" className="pointer-events-none absolute -bottom-28 -right-20 h-80 w-80 rounded-full border-[34px] border-blue-100/65"/>
      <div className="relative mx-auto max-w-5xl">
        <div className="mx-auto max-w-2xl text-center">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-[#0a3157] text-white shadow-lg shadow-blue-900/15">
            <Headset size={27}/>
          </span>
          <p className="mt-4 text-xs font-black tracking-wider text-[#e96916] sm:text-sm">SHAKH STORE · SUPPORT</p>
          <h2 id="support-contact-title" className="mt-2 text-2xl font-black text-[#0a2d50] sm:text-3xl">پێویستت بە یارمەتییە؟</h2>
          <p className="mt-3 text-sm leading-8 text-slate-600 sm:text-base">
            بۆ پرسیار، ڕاپۆرتکردنی کێشە یان یارمەتی لە داواکارییەکان، لە ڕێگەی تەلەفۆن یان واتسئاپەوە پەیوەندیمان پێوە بکە.
          </p>
        </div>

        <div className="mx-auto mt-8 grid max-w-3xl gap-4 sm:grid-cols-2">
          <a
            href={telephoneHref}
            className="group flex min-h-36 items-center gap-4 rounded-3xl border border-blue-100 bg-white p-5 shadow-[0_12px_34px_rgba(12,44,75,.07)] transition hover:-translate-y-1 hover:border-blue-200 hover:shadow-lg sm:p-6"
            aria-label={`پەیوەندی تەلەفۆنی بە ${supportNumber}`}
          >
            <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-blue-50 text-[#1769aa] transition group-hover:bg-[#1769aa] group-hover:text-white">
              <PhoneCall size={25}/>
            </span>
            <span className="min-w-0">
              <b className="block text-base font-black text-[#0a2d50] sm:text-lg">پەیوەندی تەلەفۆنی</b>
              <span dir="ltr" className="mt-2 block text-lg font-black tracking-wider text-[#1769aa]">{supportNumber}</span>
              <span className="mt-1 block text-xs font-semibold text-slate-500">بۆ پەیوەندی ڕاستەوخۆ کلیک بکە</span>
            </span>
            <ArrowUpLeft size={18} className="mr-auto shrink-0 text-slate-300 transition group-hover:text-[#1769aa]"/>
          </a>

          <a
            href={whatsappHref}
            target="_blank"
            rel="noopener noreferrer"
            className="group flex min-h-36 items-center gap-4 rounded-3xl border border-emerald-100 bg-white p-5 shadow-[0_12px_34px_rgba(12,44,75,.07)] transition hover:-translate-y-1 hover:border-emerald-200 hover:shadow-lg sm:p-6"
            aria-label={`کردنەوەی واتسئاپ بۆ ${supportNumber}`}
          >
            <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-emerald-50 text-emerald-700 transition group-hover:bg-[#20b85a] group-hover:text-white">
              <MessageCircle size={26}/>
            </span>
            <span className="min-w-0">
              <b className="block text-base font-black text-[#0a2d50] sm:text-lg">پەیوەندی لە واتسئاپ</b>
              <span dir="ltr" className="mt-2 block text-lg font-black tracking-wider text-emerald-700">{supportNumber}</span>
              <span className="mt-1 block text-xs font-semibold text-slate-500">چاتی واتسئاپ بکەرەوە</span>
            </span>
            <ArrowUpLeft size={18} className="mr-auto shrink-0 text-slate-300 transition group-hover:text-emerald-600"/>
          </a>
        </div>
        <p className="mt-5 text-center text-xs font-medium text-slate-500">
          ژمارەی فەرمی پشتیوانی شاخ ستۆر
        </p>
      </div>
    </section>
  );
}

export function SupportLink({ className = "" }: { className?: string }) {
  return (
    <Link
      href="/support"
      className={"inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-sm font-bold text-white transition hover:bg-white/20 " + className}
    >
      <Headset size={17}/>
      پشتگیری
    </Link>
  );
}
