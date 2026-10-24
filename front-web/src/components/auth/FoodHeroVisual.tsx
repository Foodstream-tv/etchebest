import { ChefHat } from "lucide-react";

// "Makes you hungry" illustration for the public landing page.
// Drawn in the same soft, glossy cartoon style as the Foodstream mascot
// (gradients + highlights, no hard outlines) and with the same friendly faces.
// Pure SVG, no image file: crisp at any size, themed and animated through CSS
// (.fi-float / .fi-steam in globals.css). Decorative only (aria-hidden).

function Sparkle({
  x,
  y,
  size = 12,
  className = "",
}: Readonly<{ x: number; y: number; size?: number; className?: string }>) {
  const s = size;
  return (
    <path
      className={className}
      transform={`translate(${x} ${y})`}
      d={`M0 ${-s} Q${s * 0.18} ${-s * 0.18} ${s} 0 Q${s * 0.18} ${s * 0.18} 0 ${s} Q${-s * 0.18} ${s * 0.18} ${-s} 0 Q${-s * 0.18} ${-s * 0.18} 0 ${-s}Z`}
      fill="#fbbf24"
    />
  );
}

export default function FoodHeroVisual() {
  return (
    <div
      aria-hidden="true"
      className="food-hero relative mt-8 w-full max-w-[640px] select-none"
    >
      {/* warm light behind the dishes */}
      <div className="absolute left-1/2 top-[46%] h-[340px] w-[440px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(251,146,60,0.5),rgba(244,63,94,0.16)_62%,transparent)] blur-2xl" />

      <svg
        viewBox="0 0 640 470"
        role="presentation"
        focusable="false"
        className="relative block h-auto w-full overflow-visible"
      >
        <defs>
          <linearGradient id="fi-bowl" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#fb7185" />
            <stop offset="0.55" stopColor="#ef4444" />
            <stop offset="1" stopColor="#b91c1c" />
          </linearGradient>
          <linearGradient id="fi-broth" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#fcd34d" />
            <stop offset="1" stopColor="#f59e0b" />
          </linearGradient>
          <linearGradient id="fi-noodle" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#fff1b8" />
            <stop offset="1" stopColor="#fbbf24" />
          </linearGradient>
          <radialGradient id="fi-bun-grad" cx="0.38" cy="0.3" r="0.8">
            <stop offset="0" stopColor="#ffffff" />
            <stop offset="0.7" stopColor="#fff1de" />
            <stop offset="1" stopColor="#f7d9b6" />
          </radialGradient>
          <linearGradient id="fi-steamer" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#f6c987" />
            <stop offset="1" stopColor="#c98a43" />
          </linearGradient>
          <linearGradient id="fi-salmon" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#fdba74" />
            <stop offset="1" stopColor="#f97316" />
          </linearGradient>
          <linearGradient id="fi-rice" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#ffffff" />
            <stop offset="1" stopColor="#e8eef5" />
          </linearGradient>
          <radialGradient id="fi-yolk" cx="0.35" cy="0.3" r="0.8">
            <stop offset="0" stopColor="#fdba74" />
            <stop offset="1" stopColor="#f97316" />
          </radialGradient>
          <radialGradient id="fi-tomato" cx="0.35" cy="0.3" r="0.85">
            <stop offset="0" stopColor="#fca5a5" />
            <stop offset="0.5" stopColor="#ef4444" />
            <stop offset="1" stopColor="#b91c1c" />
          </radialGradient>

          {/* A friendly bao bun (reused twice) */}
          <g id="fi-bun">
            <path
              d="M0 52 Q-4 6 46 0 Q96 6 92 52 Q92 80 46 82 Q0 80 0 52Z"
              fill="url(#fi-bun-grad)"
            />
            <path
              d="M46 2 Q40 14 30 22 M46 2 Q44 16 40 26 M46 2 Q52 16 54 26 M46 2 Q52 14 62 22"
              fill="none"
              stroke="#e8c79f"
              strokeWidth="2.4"
              strokeLinecap="round"
            />
            <path
              d="M14 40 Q18 22 32 14"
              fill="none"
              stroke="#fff"
              strokeWidth="5"
              strokeLinecap="round"
              opacity="0.7"
            />
            <ellipse cx="30" cy="52" rx="4.4" ry="5.2" fill="#3b2a1a" />
            <ellipse cx="62" cy="52" rx="4.4" ry="5.2" fill="#3b2a1a" />
            <circle cx="31.6" cy="50" r="1.6" fill="#fff" />
            <circle cx="63.6" cy="50" r="1.6" fill="#fff" />
            <path
              d="M38 60 Q46 70 54 60"
              fill="none"
              stroke="#3b2a1a"
              strokeWidth="2.6"
              strokeLinecap="round"
            />
            <ellipse cx="19" cy="62" rx="7" ry="4.5" fill="#fb7185" opacity="0.4" />
            <ellipse cx="73" cy="62" rx="7" ry="4.5" fill="#fb7185" opacity="0.4" />
          </g>
        </defs>

        {/* ---------- floating ingredients ---------- */}
        <g className="fi-float fi-float-3">
          <g transform="translate(58 110)">
            <circle r="26" fill="url(#fi-tomato)" />
            <path
              d="M-10 -22 L0 -14 L10 -22 L6 -10 L16 -6 L4 -2 L0 8 L-4 -2 L-16 -6 L-6 -10Z"
              fill="#22c55e"
              transform="translate(0 -6) scale(0.8)"
            />
            <ellipse cx="-9" cy="-8" rx="6" ry="9" fill="#fff" opacity="0.4" transform="rotate(25 -9 -8)" />
          </g>
        </g>

        <g className="fi-float fi-float-2">
          <g transform="translate(578 150) rotate(24)">
            <path
              d="M-26 8 Q-6 -22 22 -14 Q30 -10 24 -4 Q4 -6 -16 18 Q-30 20 -26 8Z"
              fill="#ef4444"
            />
            <path d="M-6 -4 Q8 -16 20 -12" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" opacity="0.5" />
            <path d="M22 -14 Q32 -22 36 -14" fill="none" stroke="#22c55e" strokeWidth="5" strokeLinecap="round" />
          </g>
        </g>

        <g className="fi-float">
          <Sparkle x={104} y={40} size={13} />
          <Sparkle x={540} y={64} size={10} />
          <Sparkle x={596} y={286} size={9} />
          <Sparkle x={36} y={300} size={9} />
        </g>

        {/* ---------- ramen bowl (hero) ---------- */}
        <g transform="translate(170 56)">
        <g className="fi-float">
          <ellipse cx="150" cy="238" rx="124" ry="15" fill="#7c2d12" opacity="0.16" />

          {/* chopsticks, resting on the rim */}
          <g stroke="#d9a566" strokeWidth="6" strokeLinecap="round">
            <path d="M214 74 L282 2" />
            <path d="M232 82 L300 14" />
          </g>
          <g stroke="#f3cf9a" strokeWidth="2" strokeLinecap="round" opacity="0.8">
            <path d="M217 70 L278 6" />
            <path d="M235 78 L296 18" />
          </g>

          {/* bowl */}
          <path d="M26 110 Q28 224 150 232 Q272 224 274 110 Z" fill="url(#fi-bowl)" />
          <path d="M104 230 Q150 246 196 230 L190 242 Q150 256 110 242 Z" fill="#991b1b" />
          <path
            d="M40 196 Q150 226 260 196"
            fill="none"
            stroke="#fff7ed"
            strokeWidth="8"
            strokeLinecap="round"
          />
          <path
            d="M48 210 Q150 238 252 210"
            fill="none"
            stroke="#fecaca"
            strokeWidth="3"
            strokeDasharray="1 10"
            strokeLinecap="round"
          />
          <path
            d="M50 126 Q54 190 94 214"
            fill="none"
            stroke="#fff"
            strokeWidth="9"
            strokeLinecap="round"
            opacity="0.32"
          />

          {/* happy face on the bowl */}
          <ellipse cx="108" cy="160" rx="9" ry="11" fill="#3b1d12" />
          <ellipse cx="192" cy="160" rx="9" ry="11" fill="#3b1d12" />
          <circle cx="111" cy="156" r="3.4" fill="#fff" />
          <circle cx="195" cy="156" r="3.4" fill="#fff" />
          <path
            d="M134 170 Q150 190 166 170"
            fill="#7f1d1d"
            stroke="#3b1d12"
            strokeWidth="3"
            strokeLinejoin="round"
          />
          <path d="M141 178 Q150 186 159 178 Q150 174 141 178Z" fill="#fb7185" />
          <ellipse cx="82" cy="176" rx="12" ry="7" fill="#fda4af" opacity="0.7" />
          <ellipse cx="218" cy="176" rx="12" ry="7" fill="#fda4af" opacity="0.7" />

          {/* rim + broth */}
          <ellipse cx="150" cy="110" rx="124" ry="28" fill="#fff7ed" stroke="#fed7aa" strokeWidth="3" />
          <ellipse cx="150" cy="113" rx="110" ry="21" fill="url(#fi-broth)" />
          <ellipse cx="116" cy="118" rx="38" ry="5" fill="#fff" opacity="0.28" />

          {/* noodles lifted above the rim */}
          <g fill="none" strokeLinecap="round">
            <g stroke="url(#fi-noodle)" strokeWidth="9">
              <path d="M62 112 C58 70 104 60 112 98" />
              <path d="M92 108 C96 52 154 44 160 92" />
              <path d="M138 106 C148 46 206 54 200 98" />
              <path d="M178 112 C190 66 236 70 238 110" />
            </g>
            <g stroke="#fffbe0" strokeWidth="2.5" opacity="0.75">
              <path d="M68 100 C70 76 94 68 104 84" />
              <path d="M100 90 C106 62 140 56 148 76" />
              <path d="M148 90 C158 62 188 62 190 82" />
            </g>
          </g>

          {/* toppings */}
          <g>
            {/* chashu */}
            <ellipse cx="108" cy="102" rx="36" ry="17" fill="#f8a5a5" />
            <ellipse cx="108" cy="102" rx="27" ry="11" fill="#fcc8bc" />
            <path d="M88 100 Q108 90 128 100" fill="none" stroke="#f08a8a" strokeWidth="3" strokeLinecap="round" />
            {/* egg */}
            <ellipse cx="196" cy="104" rx="26" ry="17" fill="#fff" stroke="#fde68a" strokeWidth="2" />
            <circle cx="196" cy="104" r="11" fill="url(#fi-yolk)" />
            <circle cx="192" cy="100" r="3.5" fill="#fff" opacity="0.75" />
            {/* naruto */}
            <circle cx="152" cy="86" r="15" fill="#fff" stroke="#f9a8d4" strokeWidth="2.5" />
            <path
              d="M152 86 m-6 0 a6 6 0 1 1 6 6 a10 10 0 1 1 -10 -10"
              fill="none"
              stroke="#f472b6"
              strokeWidth="2.4"
              strokeLinecap="round"
            />
            {/* nori */}
            <g transform="rotate(12 244 78)">
              <rect x="228" y="48" width="32" height="50" rx="3" fill="#1f3a2d" />
              <path d="M234 54 L234 92 M242 54 L242 92 M250 54 L250 92" stroke="#2f5a46" strokeWidth="1.6" />
            </g>
            {/* scallions */}
            <g fill="#4ade80" stroke="#16a34a" strokeWidth="1.5">
              <circle cx="76" cy="104" r="4.5" />
              <circle cx="134" cy="116" r="4" />
              <circle cx="168" cy="110" r="4.5" />
              <circle cx="226" cy="116" r="4" />
              <circle cx="92" cy="86" r="4" />
              <circle cx="174" cy="74" r="3.6" />
            </g>
          </g>

          {/* steam */}
          <g fill="none" stroke="#fb923c" strokeWidth="6" strokeLinecap="round" className="fi-steam-ink">
            <path className="fi-steam fi-steam-1" d="M104 40 C92 26 118 14 106 -2" />
            <path className="fi-steam fi-steam-2" d="M150 34 C138 18 164 6 152 -12" />
            <path className="fi-steam fi-steam-3" d="M196 40 C184 26 210 14 198 -2" />
          </g>
        </g>
        </g>

        {/* ---------- bao in a bamboo steamer ---------- */}
        <g transform="translate(10 270)">
        <g className="fi-float fi-float-2">
          <ellipse cx="116" cy="176" rx="104" ry="11" fill="#7c2d12" opacity="0.14" />
          {/* back rim */}
          <ellipse cx="116" cy="106" rx="104" ry="18" fill="#a5662a" />
          {/* buns */}
          <use href="#fi-bun" transform="translate(74 24) scale(0.84)" />
          <use href="#fi-bun" transform="translate(16 40)" />
          {/* front wall */}
          <path d="M12 106 Q116 134 220 106 L208 160 Q116 182 24 160 Z" fill="url(#fi-steamer)" />
          <g stroke="#a76a2a" strokeWidth="3" strokeLinecap="round" opacity="0.55">
            <path d="M54 122 L50 166" />
            <path d="M96 128 L94 172" />
            <path d="M138 128 L140 172" />
            <path d="M180 122 L184 166" />
          </g>
          <path d="M16 134 Q116 160 216 134" fill="none" stroke="#9c5f26" strokeWidth="6" strokeLinecap="round" />
          <path d="M12 106 Q116 134 220 106" fill="none" stroke="#f9dba6" strokeWidth="4" strokeLinecap="round" />
          <path d="M30 128 Q50 140 74 144" fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round" opacity="0.35" />

          <g fill="none" stroke="#fb923c" strokeWidth="5" strokeLinecap="round" className="fi-steam-ink">
            <path className="fi-steam fi-steam-2" d="M62 20 C52 8 74 -2 64 -16" />
            <path className="fi-steam fi-steam-3" d="M126 12 C116 0 138 -10 128 -24" />
          </g>
        </g>
        </g>

        {/* ---------- sushi ---------- */}
        <g transform="translate(410 290)">
        <g className="fi-float fi-float-3">
          <ellipse cx="108" cy="130" rx="106" ry="12" fill="#7c2d12" opacity="0.14" />

          {/* maki rolls */}
          <g>
            <circle cx="168" cy="64" r="26" fill="#1f3a2d" />
            <circle cx="168" cy="64" r="20" fill="url(#fi-rice)" />
            <circle cx="168" cy="64" r="9" fill="#fb923c" />
            <path d="M160 62 Q168 54 176 62" fill="none" stroke="#fff" strokeWidth="2" opacity="0.7" />
            <circle cx="160" cy="70" r="4" fill="#86efac" />
            <path d="M152 52 Q156 44 164 41" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" opacity="0.4" />
          </g>
          <g>
            <circle cx="196" cy="98" r="24" fill="#1f3a2d" />
            <circle cx="196" cy="98" r="18" fill="url(#fi-rice)" />
            <circle cx="196" cy="98" r="8" fill="#f87171" />
            <circle cx="203" cy="104" r="4" fill="#fde68a" />
            <path d="M182 86 Q186 79 193 77" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" opacity="0.4" />
          </g>

          {/* nigiri */}
          <rect x="6" y="62" width="130" height="50" rx="25" fill="url(#fi-rice)" />
          <g fill="#dbe4ee">
            <ellipse cx="30" cy="100" rx="3" ry="1.6" />
            <ellipse cx="62" cy="106" rx="3" ry="1.6" />
            <ellipse cx="96" cy="104" rx="3" ry="1.6" />
            <ellipse cx="118" cy="98" rx="3" ry="1.6" />
          </g>
          <path
            d="M-2 70 Q64 18 140 66 Q144 90 128 94 Q68 74 6 96 Q-10 86 -2 70Z"
            fill="url(#fi-salmon)"
          />
          <g fill="none" stroke="#fff" strokeLinecap="round" strokeWidth="4" opacity="0.7">
            <path d="M22 66 Q60 42 98 60" />
            <path d="M16 78 Q60 58 112 74" />
          </g>
          <path d="M60 36 L76 38 L78 104 L62 102Z" fill="#1f3a2d" opacity="0.92" />
          <path d="M-2 70 Q30 38 70 32" fill="none" stroke="#fff" strokeWidth="5" strokeLinecap="round" opacity="0.35" />
        </g>
        </g>
      </svg>

      {/* floating tags */}
      <span className="absolute right-[4%] top-[2%] inline-flex items-center gap-2 rounded-full bg-white/90 px-3.5 py-1.5 text-xs font-bold text-gray-900 shadow-lg ring-1 ring-black/5 backdrop-blur dark:bg-white/10 dark:text-white dark:ring-white/10">
        <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
        En direct
      </span>
      <span className="absolute left-[1%] top-[42%] inline-flex items-center gap-2 rounded-full bg-white/90 px-3.5 py-1.5 text-xs font-bold text-gray-900 shadow-lg ring-1 ring-black/5 backdrop-blur dark:bg-white/10 dark:text-white dark:ring-white/10">
        <ChefHat className="h-3.5 w-3.5 text-orange-500" aria-hidden="true" />
        Pas à pas
      </span>
    </div>
  );
}
