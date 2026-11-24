type Props = { size?: number; className?: string };

export function ShakhDeliveryArt({ size = 512, className = "" }: Props) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 512 512"
      className={className}
      role="img"
      aria-label="شاخ ستۆر، شاخ و کاپتنی گەیاندن بە ماتۆرسیکل"
    >
      <defs>
        <linearGradient id="shakhDeliveryBg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffb31a"/>
          <stop offset=".48" stopColor="#ff7910"/>
          <stop offset="1" stopColor="#ed3c08"/>
        </linearGradient>
        <linearGradient id="shakhDeliveryGloss" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity=".34"/>
          <stop offset=".42" stopColor="#fff" stopOpacity="0"/>
          <stop offset="1" stopColor="#941e08" stopOpacity=".16"/>
        </linearGradient>
        <linearGradient id="shakhDeliveryRoad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fff"/>
          <stop offset="1" stopColor="#dcecff"/>
        </linearGradient>
        <filter id="shakhDeliveryShadow" x="-30%" y="-30%" width="160%" height="170%">
          <feDropShadow dx="0" dy="13" stdDeviation="12" floodColor="#6c250b" floodOpacity=".28"/>
        </filter>
      </defs>

      <rect x="12" y="12" width="488" height="488" rx="92" fill="url(#shakhDeliveryBg)"/>
      <rect x="13" y="13" width="486" height="486" rx="91" fill="url(#shakhDeliveryGloss)"/>
      <path d="M45 83Q58 34 123 29H390Q457 29 477 94" fill="none" stroke="#fff" strokeOpacity=".32" strokeWidth="8" strokeLinecap="round"/>

      <g filter="url(#shakhDeliveryShadow)">
        <path d="M72 290 183 151 237 207 333 86 455 291" fill="none" stroke="#fff" strokeWidth="30" strokeLinejoin="round" strokeLinecap="round"/>
        <path d="m183 151 50 53 13-15m87-103-43 91 47-30 45 62" fill="none" stroke="#ffe9c8" strokeWidth="12" strokeLinejoin="round" strokeLinecap="round"/>
        <path d="M71 310 167 292 216 304 267 291" fill="none" stroke="#fff" strokeWidth="8" strokeLinecap="round" opacity=".88"/>
      </g>

      <g fill="none" stroke="#fff" strokeLinecap="round" opacity=".94">
        <path d="M38 322 147 315" strokeWidth="10"/>
        <path d="M48 350 131 344" strokeWidth="7"/>
        <path d="M66 376 145 368" strokeWidth="5"/>
      </g>

      <path d="M420 257c-28 0-49 21-49 48 0 37 49 91 49 91s49-54 49-91c0-27-21-48-49-48Z" fill="#fff"/>
      <circle cx="420" cy="305" r="19" fill="#f47721"/>
      <circle cx="420" cy="305" r="9" fill="#fff"/>

      <g filter="url(#shakhDeliveryShadow)">
        <path d="M149 282h84q13 0 13 13v54q0 13-13 13h-84q-13 0-13-13v-54q0-13 13-13Z" fill="#f47721" stroke="#fff" strokeWidth="7"/>
        <path d="m153 331 22-28 14 14 22-24 22 38-26-16-14 13-14-12-13 14Z" fill="none" stroke="#fff" strokeWidth="7" strokeLinejoin="round" strokeLinecap="round"/>
      </g>

      <g stroke="#fff" strokeWidth="10" strokeLinecap="round" strokeLinejoin="round">
        <path d="M173 390h225" fill="none" opacity=".7"/>
        <path d="M195 390c19-31 41-47 75-49l71 2c23 1 41 12 56 32l18 15" fill="none"/>
      </g>
      <path d="M160 396c67-32 141-37 221-8 30 11 61 12 92-1-30 33-88 49-149 39-64-10-111-11-164 10-34 13-69 8-98-11 31-3 67-14 98-29Z" fill="#0d315a" stroke="#fff" strokeWidth="8" strokeLinejoin="round"/>

      <g filter="url(#shakhDeliveryShadow)">
        <circle cx="194" cy="391" r="38" fill="#0a2f5b" stroke="#fff" strokeWidth="9"/>
        <circle cx="194" cy="391" r="16" fill="#dceeff"/>
        <circle cx="371" cy="391" r="38" fill="#0a2f5b" stroke="#fff" strokeWidth="9"/>
        <circle cx="371" cy="391" r="16" fill="#dceeff"/>
      </g>

      <path d="M181 362 216 338 257 339 278 359 340 367 355 383H225Z" fill="#092f5c" stroke="#fff" strokeWidth="8" strokeLinejoin="round"/>
      <path d="M215 355 240 324 296 321 324 342 352 351" fill="none" stroke="#092f5c" strokeWidth="19" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M248 324 267 284 308 267 329 287 308 322 278 345" fill="#0b3564" stroke="#fff" strokeWidth="8" strokeLinejoin="round"/>
      <path d="M267 286 239 275 218 290 197 289" fill="none" stroke="#0b3564" strokeWidth="15" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M304 279 345 294 364 281" fill="none" stroke="#0b3564" strokeWidth="13" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M353 275 373 278" fill="none" stroke="#fff" strokeWidth="8" strokeLinecap="round"/>

      <path d="M276 238c0-26 18-46 43-46 25 0 43 19 43 43 0 8-2 16-7 22l-60 1c-12-4-19-10-19-20Z" fill="#0b3564" stroke="#fff" strokeWidth="9"/>
      <path d="M322 202q27 0 35 24l-20 2-18-13Z" fill="#fff"/>
      <path d="M313 254 292 276" fill="none" stroke="#0b3564" strokeWidth="12" strokeLinecap="round"/>
      <path d="M288 281 312 300" fill="none" stroke="#fff" strokeWidth="8" strokeLinecap="round"/>

      <path d="M222 425Q258 411 300 421" fill="none" stroke="#fff" strokeWidth="7" strokeLinecap="round" opacity=".92"/>
      <circle cx="108" cy="116" r="8" fill="#fff" opacity=".6"/>
      <circle cx="404" cy="144" r="6" fill="#ffe7ba" opacity=".85"/>
    </svg>
  );
}
