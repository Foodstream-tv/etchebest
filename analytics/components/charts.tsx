"use client";

import { useId } from "react";

/**
 * Dependency-free SVG chart primitives for the analytics dashboard.
 * Colors follow the data-viz palette validated for the dark panel surface
 * (#111827): single-hue blue/aqua for magnitude series, a 4-hue categorical
 * set for the donut. Grid/axis/text stay in recessive ink tokens so identity
 * is never carried by chart chrome.
 */

export const VIZ = {
  blue: "#3987e5",
  aqua: "#199e70",
  yellow: "#c98500",
  red: "#e66767",
  grid: "#1f2937", // gray-800
  axis: "#374151", // gray-700
  text: "#9ca3af", // gray-400
  muted: "#6b7280", // gray-500
} as const;

export type Pt = { label: string; value: number };

export function formatNum(n: number): string {
  if (!Number.isFinite(n)) return "0";
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}M`;
  if (abs >= 1_000) return `${(n / 1_000).toFixed(n % 1_000 === 0 ? 0 : 1)}K`;
  return `${Math.round(n)}`;
}

function niceCeil(v: number): number {
  if (v <= 0) return 1;
  const pow = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / pow;
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
  return step * pow;
}

function yTicks(max: number, count = 4): number[] {
  const out: number[] = [];
  for (let i = 0; i <= count; i++) out.push((max / count) * i);
  return out;
}

// ---------------------------------------------------------------------------

export function ChartCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-gray-200">{title}</h3>
        {subtitle && <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="h-[220px] grid place-items-center text-sm text-gray-600">
      No data yet.
    </div>
  );
}

// --- Cumulative growth: line + gradient area ------------------------------

export function LineArea({ data, color = VIZ.blue }: { data: Pt[]; color?: string }) {
  const gradId = useId();
  if (data.length === 0) return <EmptyState />;

  const W = 720;
  const H = 260;
  const pad = { l: 44, r: 16, t: 16, b: 28 };
  const iw = W - pad.l - pad.r;
  const ih = H - pad.t - pad.b;

  const max = niceCeil(Math.max(1, ...data.map((d) => d.value)));
  const x = (i: number) =>
    pad.l + (data.length <= 1 ? iw / 2 : (i / (data.length - 1)) * iw);
  const y = (v: number) => pad.t + ih - (v / max) * ih;

  const line = data.map((d, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(d.value)}`).join(" ");
  const area = `${line} L${x(data.length - 1)},${pad.t + ih} L${x(0)},${pad.t + ih} Z`;

  const labelEvery = Math.ceil(data.length / 12);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img">
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>

      {yTicks(max).map((t, i) => (
        <g key={i}>
          <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} stroke={VIZ.grid} strokeWidth="1" />
          <text x={pad.l - 8} y={y(t) + 3} textAnchor="end" fontSize="10" fill={VIZ.muted}>
            {formatNum(t)}
          </text>
        </g>
      ))}

      <path d={area} fill={`url(#${gradId})`} />
      <path d={line} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />

      {data.map((d, i) => (
        <g key={i}>
          <circle cx={x(i)} cy={y(d.value)} r="3" fill={color}>
            <title>{`${d.label}: ${formatNum(d.value)}`}</title>
          </circle>
          {i % labelEvery === 0 && (
            <text x={x(i)} y={H - 8} textAnchor="middle" fontSize="10" fill={VIZ.muted}>
              {d.label}
            </text>
          )}
        </g>
      ))}
    </svg>
  );
}

// --- Vertical bars --------------------------------------------------------

export function VBars({ data, color = VIZ.blue }: { data: Pt[]; color?: string }) {
  if (data.length === 0) return <EmptyState />;

  const W = 720;
  const H = 260;
  const pad = { l: 44, r: 16, t: 16, b: 28 };
  const iw = W - pad.l - pad.r;
  const ih = H - pad.t - pad.b;

  const max = niceCeil(Math.max(1, ...data.map((d) => d.value)));
  const y = (v: number) => pad.t + ih - (v / max) * ih;
  const slot = iw / data.length;
  const bw = Math.min(slot - 6, 42);
  const labelEvery = Math.ceil(data.length / 12);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img">
      {yTicks(max).map((t, i) => (
        <g key={i}>
          <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} stroke={VIZ.grid} strokeWidth="1" />
          <text x={pad.l - 8} y={y(t) + 3} textAnchor="end" fontSize="10" fill={VIZ.muted}>
            {formatNum(t)}
          </text>
        </g>
      ))}

      {data.map((d, i) => {
        const cx = pad.l + slot * i + slot / 2;
        const h = pad.t + ih - y(d.value);
        return (
          <g key={i}>
            <rect
              x={cx - bw / 2}
              y={y(d.value)}
              width={bw}
              height={Math.max(0, h)}
              rx="4"
              fill={color}
              className="transition-opacity hover:opacity-80"
            >
              <title>{`${d.label}: ${formatNum(d.value)}`}</title>
            </rect>
            {i % labelEvery === 0 && (
              <text x={cx} y={H - 8} textAnchor="middle" fontSize="10" fill={VIZ.muted}>
                {d.label}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

// --- Horizontal bars (leaderboard) ----------------------------------------

export function HBars({ data, color = VIZ.blue }: { data: Pt[]; color?: string }) {
  if (data.length === 0) return <EmptyState />;

  const rowH = 30;
  const gap = 8;
  const labelW = 120;
  const valueW = 52;
  const W = 720;
  const H = data.length * (rowH + gap);
  const trackX = labelW + 8;
  const trackW = W - trackX - valueW;
  const max = Math.max(1, ...data.map((d) => d.value));

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img">
      {data.map((d, i) => {
        const y = i * (rowH + gap);
        const w = (d.value / max) * trackW;
        return (
          <g key={i} className="transition-opacity hover:opacity-80">
            <title>{`${d.label}: ${formatNum(d.value)}`}</title>
            <text x={0} y={y + rowH / 2 + 4} fontSize="12" fill={VIZ.text}>
              {d.label.length > 18 ? `${d.label.slice(0, 17)}…` : d.label}
            </text>
            <rect x={trackX} y={y + 4} width={trackW} height={rowH - 8} rx="4" fill={VIZ.grid} />
            <rect x={trackX} y={y + 4} width={Math.max(2, w)} height={rowH - 8} rx="4" fill={color} />
            <text
              x={W}
              y={y + rowH / 2 + 4}
              textAnchor="end"
              fontSize="12"
              fill="#e5e7eb"
              style={{ fontVariantNumeric: "tabular-nums" }}
            >
              {formatNum(d.value)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// --- Donut (categorical composition) --------------------------------------

export type Segment = { label: string; value: number; color: string };

export function Donut({ segments }: { segments: Segment[] }) {
  const total = segments.reduce((s, x) => s + x.value, 0);
  if (total === 0) return <EmptyState />;

  const size = 200;
  const stroke = 26;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const cx = size / 2;
  const cy = size / 2;

  const gap = 2; // px gap between segments, in path units
  // Precompute each segment's start offset (cumulative length of prior
  // segments) so the render map does no variable reassignment.
  const offsets = segments.map(
    (_, i) =>
      (segments.slice(0, i).reduce((sum, s) => sum + s.value, 0) / total) * c
  );

  return (
    <div className="flex flex-col sm:flex-row items-center gap-6">
      <svg viewBox={`0 0 ${size} ${size}`} className="w-[180px] h-[180px] shrink-0" role="img">
        <g transform={`rotate(-90 ${cx} ${cy})`}>
          <circle cx={cx} cy={cy} r={r} fill="none" stroke={VIZ.grid} strokeWidth={stroke} />
          {segments.map((s, i) => {
            if (s.value === 0) return null;
            const len = (s.value / total) * c;
            const dash = Math.max(0, len - gap);
            return (
              <circle
                key={i}
                cx={cx}
                cy={cy}
                r={r}
                fill="none"
                stroke={s.color}
                strokeWidth={stroke}
                strokeDasharray={`${dash} ${c - dash}`}
                strokeDashoffset={-offsets[i]}
              >
                <title>{`${s.label}: ${s.value} (${Math.round((s.value / total) * 100)}%)`}</title>
              </circle>
            );
          })}
        </g>
        <text x={cx} y={cy - 2} textAnchor="middle" fontSize="30" fontWeight="700" fill="#f3f4f6">
          {formatNum(total)}
        </text>
        <text x={cx} y={cy + 16} textAnchor="middle" fontSize="11" fill={VIZ.muted}>
          total
        </text>
      </svg>

      <ul className="flex-1 w-full space-y-2">
        {segments.map((s, i) => (
          <li key={i} className="flex items-center gap-2 text-sm">
            <span className="h-3 w-3 rounded-sm shrink-0" style={{ background: s.color }} />
            <span className="text-gray-300 flex-1">{s.label}</span>
            <span className="text-gray-400 tabular-nums">{s.value}</span>
            <span className="text-gray-600 tabular-nums w-10 text-right">
              {Math.round((s.value / total) * 100)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
