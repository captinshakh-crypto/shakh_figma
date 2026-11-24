import Link from "next/link";

type Props = { size?: "sm" | "md" | "lg"; className?: string };

function MountainMark() {
  return (
    <svg viewBox="0 0 390 260" className="h-[78%] w-[84%]" aria-hidden="true">
      <path d="M18 238 110 107 155 151 224 26 372 238 275 167 245 200 192 146 151 187 111 151Z" fill="none" stroke="#ffffff" strokeWidth="23" strokeLinejoin="round" strokeLinecap="round"/>
      <path d="m110 107 38 37 8-10m68-108-31 70 38-24 34 50" fill="none" stroke="#ffe9c8" strokeWidth="12" strokeLinejoin="round" strokeLinecap="round"/>
      <circle cx="322" cy="46" r="13" fill="#ffe6a9"/>
    </svg>
  );
}

export default function ShakhBrand({ size = "md", className = "" }: Props) {
  // The compact and standard variants intentionally share the same dimensions
  // so public headers render identically on mobile, tablet, and desktop.
  const dimensions = size === "lg"
    ? { mark: "h-12 w-12", title: "text-xl", latin: "text-[11px]" }
    : { mark: "h-10 w-10", title: "text-lg", latin: "text-[10px]" };

  return (
    <Link href="/" aria-label="شاخ ستۆر – SHAKH STORE"
      className={"inline-flex min-w-0 items-center justify-center gap-2 " + className} dir="rtl">
      <span aria-hidden="true"
        className={"grid shrink-0 place-items-center overflow-hidden rounded-full bg-gradient-to-br from-[#ffad18] via-[#ff7810] to-[#ed3d08] shadow-sm ring-1 ring-orange-200 " + dimensions.mark}>
        <MountainMark />
      </span>
      <span className="min-w-0 text-center leading-none">
        <span lang="ckb-IQ" dir="rtl" className={"block whitespace-nowrap font-black tracking-tight text-[#102f49] " + dimensions.title}>شاخ ستۆر</span>
        <span lang="en" dir="ltr" className={"mt-1 block whitespace-nowrap font-extrabold tracking-[0.18em] text-[#f47721] " + dimensions.latin}>SHAKH STORE</span>
      </span>
    </Link>
  );
}
