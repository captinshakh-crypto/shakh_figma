import Link from "next/link";

type Props = { size?: "sm" | "md" | "lg"; className?: string };

function Mountain({ mirror = false }: { mirror?: boolean }) {
  return (
    <svg
      viewBox="0 0 54 48"
      aria-hidden="true"
      className="h-full w-full"
      style={{ transform: mirror ? "scaleX(-1)" : "none" }}
    >
      <path
        d="M3 43 20 17 28 26 40 5 51 43 43 32 36 38 27 28 20 36 15 29Z"
        fill="#f47721"
        stroke="#e65b10"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
      <path d="m20 17 6 7 2-2m12-17-5 11 6-4 5 8" fill="none"
        stroke="#ffcf65" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

export default function ShakhBrand({ size = "md", className = "" }: Props) {
  const dimensions = size === "lg"
    ? { peak: "h-11 w-10", title: "text-xl", latin: "text-[11px]" }
    : size === "sm"
      ? { peak: "h-7 w-6", title: "text-base", latin: "text-[9px]" }
      : { peak: "h-9 w-8", title: "text-lg", latin: "text-[10px]" };

  return (
    <Link
      href="/"
      aria-label="SHAKH STORE - شاخ ستۆر"
      className={"inline-flex min-w-0 items-center justify-center gap-1.5 " + className}
      dir="rtl"
    >
      <span className={"shrink-0 " + dimensions.peak}><Mountain/></span>
      <span className="min-w-0 text-center leading-none">
        <span className={"block whitespace-nowrap font-black tracking-tight text-[#102f49] " + dimensions.title}>شاخ ستۆر</span>
        <span className={"mt-1 block whitespace-nowrap font-extrabold tracking-[0.18em] text-[#f47721] " + dimensions.latin}>SHAKH STORE</span>
      </span>
      <span className={"shrink-0 " + dimensions.peak}><Mountain mirror/></span>
    </Link>
  );
}
