import Link from "next/link";

type Props = { size?: "sm" | "md" | "lg"; className?: string; onDark?: boolean };

function MountainMark() {
  return (
    <svg viewBox="0 0 390 260" className="h-[82%] w-[86%]" aria-hidden="true">
      <path d="M18 170 110 38 155 82 224 8 372 171" fill="none" stroke="#fff" strokeWidth="21" strokeLinejoin="round" strokeLinecap="round"/>
      <path d="m110 38 38 38 8-10m68-58-31 70 38-24 34 50" fill="none" stroke="#ffe9c8" strokeWidth="10" strokeLinejoin="round" strokeLinecap="round"/>
      <path d="M73 220 133 192 184 198 225 218 310 217 346 232H91Z" fill="#0b315a"/>
      <circle cx="157" cy="219" r="18" fill="#fff" stroke="#0b315a" strokeWidth="7"/>
      <circle cx="302" cy="219" r="18" fill="#fff" stroke="#0b315a" strokeWidth="7"/>
      <path d="m185 193 18-42 43-12 27 21-20 38-41 12" fill="#0b315a" stroke="#0b315a" strokeWidth="8" strokeLinejoin="round"/>
      <circle cx="246" cy="119" r="23" fill="#0b315a" stroke="#fff" strokeWidth="7"/>
      <path d="m229 147 29 5 22 42m-37-46-23 32 28 18m19-44 36 12 21-16" fill="none" stroke="#0b315a" strokeWidth="14" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M59 194 136 190" fill="none" stroke="#fff" strokeWidth="7" strokeLinecap="round"/>
    </svg>
  );
}

export default function ShakhBrand({ size = "md", className = "", onDark = false }: Props) {
  const dimensions = size === "lg"
    ? { mark: "h-12 w-12", title: "text-xl", latin: "text-[11px]" }
    : { mark: "h-10 w-10", title: "text-lg", latin: "text-[10px]" };
  const primaryText = onDark ? "text-white" : "text-[#102f49]";
  const latinText = onDark ? "text-[#ffb36f]" : "text-[#f47721]";

  return (
    <Link href="/" aria-label="شاخ ستۆر – SHAKH STORE"
      className={"inline-flex min-w-0 items-center justify-center gap-2 " + className} dir="rtl">
      <span aria-hidden="true"
        className={"grid shrink-0 place-items-center overflow-hidden rounded-full bg-gradient-to-br from-[#ffad18] via-[#ff7810] to-[#ed3d08] shadow-sm ring-1 ring-orange-200 " + dimensions.mark}>
        <MountainMark />
      </span>
      <span className="min-w-0 text-center leading-none">
        <span lang="ckb-IQ" dir="rtl" className={"block whitespace-nowrap font-black tracking-tight " + primaryText + " " + dimensions.title}>شاخ ستۆر</span>
        <span lang="en" dir="ltr" className={"mt-1 block whitespace-nowrap font-extrabold tracking-[0.18em] " + latinText + " " + dimensions.latin}>SHAKH STORE</span>
      </span>
    </Link>
  );
}
