"use client";
import { useEffect, useRef, useState } from "react";
import { Paces, Step, Zone, formatPace } from "@/lib/pace";

// Workout chart: bar WIDTH = distance (km), bar HEIGHT = pace (taller = faster).
// With no goal time there are no paces, so height shows effort instead.

const ZONE_LABEL: Record<Zone, string> = { easy: "Easy", tempo: "Tempo", interval: "Interval", race: "Race pace" };
const FILL: Record<Zone, number> = { easy: 0.28, tempo: 0.62, interval: 0.85, race: 1 };
const EFFORT_LEVEL: Record<Zone, number> = { easy: 0.4, tempo: 0.7, interval: 0.9, race: 0.8 };
const EFFORT_TICKS = [
  { label: "Easy", frac: 0.4 },
  { label: "Tempo", frac: 0.7 },
  { label: "Hard", frac: 0.9 },
];

const H = 190;
const L = 46; // left margin for the pace axis
const R = 8;
const T = 20;
const B = 32;

const km = (n: number) => String(Number(n.toFixed(1)));

export default function PaceChart({ steps, paces }: { steps: Step[]; paces: Paces | null }) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(320);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setWidth(el.clientWidth || 320);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const total = steps.reduce((sum, s) => sum + s.distance_km, 0);
  if (!total) return null;

  const plotW = Math.max(width - L - R, 60);
  const plotH = H - T - B;
  const base = T + plotH;

  // Height of each bar as a fraction (0 to 1) of the plot, plus the y-axis ticks
  let frac: (z: Zone) => number;
  let ticks: { label: string; frac: number }[];
  if (paces) {
    const mid = (z: Zone) => (paces[z].low + paces[z].high) / 2;
    const ps = steps.map((s) => mid(s.zone));
    const minP = Math.min(...ps);
    const maxP = Math.max(...ps);
    const range = Math.max(maxP - minP, 60);
    const fast = minP - 0.25 * range;
    const slow = maxP + 0.6 * range;
    frac = (z) => (slow - mid(z)) / (slow - fast);
    // Round pace ticks (every 15, 30 or 60 seconds), no more than 5 of them
    const step = [15, 30, 60].find((st) => Math.floor(slow / st) - Math.ceil(fast / st) + 1 <= 5) ?? 60;
    ticks = [];
    for (let p = Math.ceil(fast / step) * step; p <= slow; p += step) {
      ticks.push({ label: formatPace(p), frac: (slow - p) / (slow - fast) });
    }
  } else {
    frac = (z) => EFFORT_LEVEL[z];
    ticks = EFFORT_TICKS;
  }

  // Bars and distance labels along the bottom
  let cum = 0;
  const bars = steps.map((s) => {
    const x = L + (plotW * cum) / total;
    const w = (plotW * s.distance_km) / total;
    cum += s.distance_km;
    const h = Math.max(frac(s.zone) * plotH, 4);
    return { s, x: x + 1, w: Math.max(w - 2, 1), y: base - h, h };
  });

  const boundaries = [0];
  let c = 0;
  for (const s of steps) boundaries.push((c += s.distance_km));
  // Keep distance labels from overlapping: work back from the finish
  const labelled: number[] = [];
  let lastX = Infinity;
  for (let i = boundaries.length - 1; i >= 0; i--) {
    const x = L + (plotW * boundaries[i]) / total;
    if (lastX - x >= 34) {
      labelled.unshift(i);
      lastX = x;
    } else if (i === boundaries.length - 1) {
      labelled.unshift(i);
      lastX = x;
    }
  }

  const zones = Array.from(new Set(steps.map((s) => s.zone)));
  const summary = steps
    .map((s) => `${s.label} ${km(s.distance_km)} km${paces ? "" : ""}`)
    .join(", ");

  return (
    <div>
      <div ref={ref} className="w-full">
        <svg width={width} height={H} role="img" aria-label={`Workout chart: ${summary}`} className="block">
          <text x={0} y={11} fontSize={11} style={{ fill: "var(--muted)" }}>
            {paces ? "pace /km" : "effort"}
          </text>

          {ticks.map((t) => {
            const y = base - t.frac * plotH;
            return (
              <g key={t.label}>
                <line x1={L} x2={L + plotW} y1={y} y2={y} strokeDasharray="2 4" style={{ stroke: "var(--line)" }} />
                <text x={L - 6} y={y + 4} fontSize={11} textAnchor="end" style={{ fill: "var(--muted)" }}>
                  {t.label}
                </text>
              </g>
            );
          })}

          {bars.map(({ s, x, w, y, h }, i) => (
            <rect
              key={i}
              x={x}
              y={y}
              width={w}
              height={h}
              rx={2}
              style={{ fill: "var(--foreground)", fillOpacity: FILL[s.zone], stroke: "var(--foreground)" }}
              strokeWidth={1}
            >
              <title>
                {s.label} · {km(s.distance_km)} km · {ZONE_LABEL[s.zone]}
              </title>
            </rect>
          ))}

          <line x1={L} x2={L + plotW} y1={base} y2={base} style={{ stroke: "var(--muted)" }} />
          {labelled.map((i) => {
            const x = L + (plotW * boundaries[i]) / total;
            const isLast = i === boundaries.length - 1;
            return (
              <g key={i}>
                <line x1={x} x2={x} y1={base} y2={base + 4} style={{ stroke: "var(--muted)" }} />
                <text
                  x={x}
                  y={base + 17}
                  fontSize={11}
                  textAnchor={isLast ? "end" : i === 0 ? "start" : "middle"}
                  style={{ fill: "var(--muted)" }}
                >
                  {isLast ? `${km(boundaries[i])} km` : km(boundaries[i])}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs muted">
        {zones.map((z) => (
          <span key={z} className="inline-flex items-center gap-1.5">
            <span
              className="inline-block h-3 w-3 rounded-sm"
              style={{
                border: "1px solid var(--foreground)",
                background: `color-mix(in srgb, var(--foreground) ${FILL[z] * 100}%, transparent)`,
              }}
            />
            {ZONE_LABEL[z]}
          </span>
        ))}
        <span className="ml-auto">Bar width = distance{paces ? ", height = pace (taller is faster)" : ", height = effort"}</span>
      </div>
    </div>
  );
}
