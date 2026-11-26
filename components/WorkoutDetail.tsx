"use client";
import PaceChart from "@/components/PaceChart";
import {
  EFFORT, Paces, Workout, amountText, estimateSeconds, formatDuration, offsetText, restText, stepPaceText, stepsFor, totalKm,
} from "@/lib/pace";

// The breakdown of one run: chart, then each segment with its pace.
// A repeat block shows as one line, e.g. "6 × 800 m" with its rest underneath.
export default function WorkoutDetail({ w, paces }: { w: Workout; paces: Paces | null }) {
  const steps = stepsFor(w);
  if (steps.length === 0) return null;
  const total = totalKm(steps, paces);

  return (
    <div>
      <PaceChart steps={steps} paces={paces} />
      <ul className="mt-4 space-y-2 text-sm">
        {steps.map((s, i) => {
          const pace = stepPaceText(s, paces);
          const sub = s.pace?.mode === "offset" ? offsetText(s.pace.offset) : s.pace?.mode === "fixed" ? "Set pace" : EFFORT[s.zone];
          return (
            <li key={i} className="flex items-baseline gap-3">
              <span className="w-24 shrink-0 font-medium">{s.label}</span>
              <span className="w-20 shrink-0">{s.reps && s.reps > 1 ? `${s.reps} × ${amountText(s)}` : amountText(s)}</span>
              <span className="flex-1">
                {pace ? <span className="font-medium">{pace}</span> : <span className="muted">{sub}</span>}
                {pace && <span className="block text-xs muted">{sub}</span>}
                {s.reps && s.reps > 1 && s.rest ? <span className="block text-xs muted">Rest {restText(s.rest)} between reps</span> : null}
              </span>
            </li>
          );
        })}
      </ul>
      <p className="mt-3 text-xs muted">
        Total {Number(total.toFixed(1))} km
        {paces ? ` · about ${formatDuration(estimateSeconds(steps, paces))}` : " · set a goal time to see target paces"}
      </p>
    </div>
  );
}
