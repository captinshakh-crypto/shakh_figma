import Link from "next/link";

type Props = { size?: "sm" | "md" | "lg"; className?: string };

export default function ShakhBrand({ size = "md", className = "" }: Props) {
  const dimensions = size === "lg"
    ? { mark: "h-12 w-12", title: "text-xl", latin: "text-[11px]" }
    : size === "sm"
      ? { mark: "h-7 w-7", title: "text-base", latin: "text-[9px]" }
      : { mark: "h-9 w-9", title: "text-lg", latin: "text-[10px]" };

  return (
    <Link
      href="/"
      aria-label="SHAKH STORE - شاخ ستۆر"
      className={"inline-flex min-w-0 items-center justify-center gap-2 " + className}
      dir="rtl"
    >
      <span
        aria-hidden="true"
        className={"grid shrink-0 place-items-center overflow-hidden rounded-full bg-gradient-to-br from-[#ffad18] via-[#ff7810] to-[#ed3d08] shadow-sm ring-1 ring-orange-200 " + dimensions.mark}
      >
        <svg viewBox="0 0 54 48" className="h-[82%] w-[82%]" aria-hidden="true">
          <path
            d="M3 43 20 17 28 26 40 5 51 43 43 32 36 38 27 28 20 36 15 29Z"
            fill="none"
            stroke="#ffffff"
            strokeWidth="3.2"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          <path d="m20 17 6 7 2-2m12-17-5 11 6-4 5 8" fill="none"
            stroke="#ffe9c8" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </span>
      <span className="min-w-0 text-center leading-none">
        <span className={"block whitespace-nowrap font-black tracking-tight text-[#102f49] " + dimensions.title}>شاخ ستۆر</span>
        <span className={"mt-1 block whitespace-nowrap font-extrabold tracking-[0.18em] text-[#f47721] " + dimensions.latin}>SHAKH STORE</span>
      </span>
    </Link>
  );
}
