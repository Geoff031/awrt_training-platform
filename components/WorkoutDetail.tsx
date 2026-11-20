"use client";
import PaceChart from "@/components/PaceChart";
import { EFFORT, Paces, Workout, estimateSeconds, formatDuration, paceText, stepsFor } from "@/lib/pace";

// The breakdown of one run: chart, then each segment with its pace.
export default function WorkoutDetail({ w, paces }: { w: Workout; paces: Paces | null }) {
  const steps = stepsFor(w);
  if (steps.length === 0) return null;
  const total = steps.reduce((sum, s) => sum + s.distance_km, 0);

  return (
    <div>
      <PaceChart steps={steps} paces={paces} />
      <ul className="mt-4 space-y-2 text-sm">
        {steps.map((s, i) => (
          <li key={i} className="flex items-baseline gap-3">
            <span className="w-24 shrink-0 font-medium">{s.label}</span>
            <span className="w-16 shrink-0">{Number(s.distance_km.toFixed(1))} km</span>
            <span className="flex-1">
              {paces ? (
                <span className="font-medium">{paceText(s.zone, paces)}</span>
              ) : (
                <span className="muted">{EFFORT[s.zone]}</span>
              )}
              {paces && <span className="block text-xs muted">{EFFORT[s.zone]}</span>}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs muted">
        Total {Number(total.toFixed(1))} km
        {paces ? ` · about ${formatDuration(estimateSeconds(steps, paces))}` : " · set a goal time to see target paces"}
      </p>
    </div>
  );
}
