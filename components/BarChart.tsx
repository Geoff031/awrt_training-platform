// A simple bar chart in the site's black and white: one bar per label, with an optional average line.
// The selected bar is solid; click a bar to select it.

const W = 360;
const H = 180;
const L = 38; // left space for the km axis
const T = 18;
const B = 22;

// Round axis steps (1, 2 or 5 times a power of ten) with about 4 intervals
function niceStep(max: number) {
  const raw = max / 4;
  const pow = Math.pow(10, Math.floor(Math.log10(raw)));
  return ([1, 2, 5, 10].map((m) => m * pow).find((s) => s >= raw) ?? pow * 10);
}

export default function BarChart({
  data,
  selected,
  onSelect,
  unit = "km",
  title,
}: {
  data: { label: string; value: number }[];
  selected?: number;
  onSelect?: (i: number) => void;
  unit?: string;
  title: string;
}) {
  const max = Math.max(...data.map((d) => d.value), 1);
  const step = niceStep(max);
  const top = Math.ceil(max / step) * step;
  const plotW = W - L - 6;
  const plotH = H - T - B;
  const slot = plotW / data.length;
  const y = (v: number) => T + plotH - (v / top) * plotH;
  const active = data.filter((d) => d.value > 0);
  const avg = active.length > 0 ? active.reduce((s, d) => s + d.value, 0) / active.length : 0;
  const fmt = (v: number) => Math.round(v).toLocaleString("en-GB");

  const ticks: number[] = [];
  for (let v = 0; v <= top + 1e-9; v += step) ticks.push(v);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="block w-full" role="img" aria-label={`${title}: ${data.map((d) => `${d.label} ${fmt(d.value)} ${unit}`).join(", ")}`}>
      {ticks.map((v) => (
        <g key={v}>
          <line x1={L} x2={W - 6} y1={y(v)} y2={y(v)} strokeDasharray="2 4" style={{ stroke: "var(--line)" }} />
          <text x={L - 5} y={y(v) + 3} fontSize={9} textAnchor="end" style={{ fill: "var(--muted)" }}>
            {fmt(v)}
          </text>
        </g>
      ))}
      {data.map((d, i) => {
        const h = Math.max(d.value > 0 ? (d.value / top) * plotH : 0, d.value > 0 ? 2 : 0);
        const x = L + i * slot + slot * 0.14;
        const w = slot * 0.72;
        const isSel = i === selected;
        return (
          <g key={d.label} onClick={onSelect ? () => onSelect(i) : undefined} style={{ cursor: onSelect ? "pointer" : undefined }}>
            <rect x={L + i * slot} y={T} width={slot} height={plotH} fill="transparent" />
            <rect x={x} y={T + plotH - h} width={w} height={h} rx={2} style={{ fill: "var(--foreground)", fillOpacity: isSel ? 1 : 0.28 }}>
              <title>{`${d.label}: ${fmt(d.value)} ${unit}`}</title>
            </rect>
            <text x={x + w / 2} y={H - 7} fontSize={9} textAnchor="middle" style={{ fill: isSel ? "var(--foreground)" : "var(--muted)", fontWeight: isSel ? 700 : 400 }}>
              {d.label}
            </text>
            {isSel && d.value > 0 && (
              <text x={x + w / 2} y={T + plotH - h - 4} fontSize={9} textAnchor="middle" fontWeight={700} style={{ fill: "var(--foreground)" }}>
                {fmt(d.value)}
              </text>
            )}
          </g>
        );
      })}
      {avg > 0 && (
        <g>
          <line x1={L} x2={W - 6} y1={y(avg)} y2={y(avg)} strokeDasharray="5 3" style={{ stroke: "var(--muted)" }} />
          <text x={W - 8} y={y(avg) - 3} fontSize={9} textAnchor="end" style={{ fill: "var(--muted)" }}>
            avg {fmt(avg)} {unit}
          </text>
        </g>
      )}
      <line x1={L} x2={W - 6} y1={T + plotH} y2={T + plotH} style={{ stroke: "var(--muted)" }} />
    </svg>
  );
}
