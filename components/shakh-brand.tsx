import Link from "next/link";

type Props = { size?: "sm" | "md" | "lg"; className?: string };

export default function ShakhBrand({ size = "md", className = "" }: Props) {
  const dimensions = size === "lg"
    ? { mark: "h-14 w-14", title: "text-xl", latin: "text-[11px]" }
    : size === "sm"
      ? { mark: "h-10 w-10", title: "text-base", latin: "text-[9px]" }
      : { mark: "h-12 w-12", title: "text-lg", latin: "text-[10px]" };

  return (
    <Link href="/" aria-label="SHAKH STORE - شاخ ستۆر"
      className={"inline-flex min-w-0 items-center gap-2.5 " + className} dir="rtl">
      <span className={"grid shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-[#ffb11b] via-[#ff7416] to-[#d9340a] p-1.5 shadow-md shadow-orange-200 " + dimensions.mark}>
        <svg viewBox="0 0 64 48" role="img" aria-label="نیشانی دوو چیای شاخ" className="h-full w-full">
          <path d="M3 43 20 17 28 26 40 5 61 43 43 29 36 37 27 28 20 35 15 29Z" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinejoin="round" strokeLinecap="round"/>
          <path d="m20 17 6 7 2-2m12-17-5 11 6-4 5 8" fill="none" stroke="#ffe9c9" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"/>
          <circle cx="51" cy="8" r="3" fill="#ffe7a8"/>
        </svg>
      </span>
      <span className="min-w-0 leading-none">
        <span className={"block whitespace-nowrap font-black tracking-tight text-[#102f49] " + dimensions.title}>شاخ ستۆر</span>
        <span className={"mt-1 block whitespace-nowrap font-extrabold tracking-[0.18em] text-[#f47721] " + dimensions.latin}>SHAKH STORE</span>
      </span>
    </Link>
  );
}
