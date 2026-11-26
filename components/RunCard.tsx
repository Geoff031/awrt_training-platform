"use client";
import { useState } from "react";
import type { Activity } from "@/lib/activities";
import { formatDuration, formatPace } from "@/lib/pace";

const ZONE_SHADE = [0.15, 0.3, 0.5, 0.75, 1];

// One saved run: the headline numbers, and heart rate and zones when you open it.
export default function RunCard({ run }: { run: Activity }) {
  const [open, setOpen] = useState(false);
  const pace = run.distance_km > 0 ? formatPace(run.duration_seconds / run.distance_km) : null;
  const time = run.started_local?.slice(11, 16);
  const zones = run.hr_zone_seconds;
  const zoneTotal = zones ? zones.reduce((a, b) => a + b, 0) : 0;
  const hasDetail = zoneTotal > 0 || run.avg_hr !== null || run.elevation_gain_m !== null;

  return (
    <div className="rounded border line p-3 text-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-medium">
            {run.name || "Run"}
            {run.event_type === "race" && <span className="ml-2 rounded border line px-1.5 text-xs font-normal">Race</span>}
          </p>
          <p className="muted">
            {time ? `${time} · ` : ""}
            {run.distance_km.toFixed(2)} km · {formatDuration(run.duration_seconds)}
            {pace ? ` · ${pace} /km` : ""}
          </p>
        </div>
        {hasDetail && (
          <button type="button" className="btn-ghost shrink-0 py-1" aria-expanded={open} onClick={() => setOpen(!open)}>
            {open ? "Hide" : "Details"}
          </button>
        )}
      </div>

      {open && (
        <div className="mt-3 space-y-3 border-t line pt-3">
          <dl className="grid grid-cols-3 gap-2">
            {run.avg_hr !== null && (<div><dt className="text-xs muted">Avg HR</dt><dd>{run.avg_hr} bpm</dd></div>)}
            {run.max_hr !== null && (<div><dt className="text-xs muted">Max HR</dt><dd>{run.max_hr} bpm</dd></div>)}
            {run.elevation_gain_m !== null && (<div><dt className="text-xs muted">Elevation</dt><dd>{Math.round(run.elevation_gain_m)} m</dd></div>)}
          </dl>
          {zones && zoneTotal > 0 && (
            <div>
              <p className="mb-1 text-xs muted">Time in heart-rate zones</p>
              <div className="flex h-5 overflow-hidden rounded border line" role="img" aria-label={`Heart rate zones: ${zones.map((z, i) => `zone ${i + 1} ${Math.round(z / 60)} minutes`).join(", ")}`}>
                {zones.map((z, i) =>
                  z > 0 ? <div key={i} title={`Zone ${i + 1}: ${formatDuration(z)}`} style={{ width: `${(z / zoneTotal) * 100}%`, background: "var(--foreground)", opacity: ZONE_SHADE[i] }} /> : null,
                )}
              </div>
              <ul className="mt-2 grid grid-cols-5 gap-1 text-center text-xs">
                {zones.map((z, i) => (
                  <li key={i}>
                    <span className="muted">Z{i + 1}</span>
                    <span className="block">{formatDuration(z)}</span>
                    <span className="block muted">{Math.round((z / zoneTotal) * 100)}%</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
