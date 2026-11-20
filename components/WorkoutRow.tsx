"use client";
import { useState } from "react";
import WorkoutDetail from "@/components/WorkoutDetail";
import { Paces, Workout } from "@/lib/pace";

// One run in a plan preview. Click the row to open the workout detail.
export default function WorkoutRow({ w, label, paces }: { w: Workout; label: string; paces: Paces | null }) {
  const [open, setOpen] = useState(false);

  if (w.type === "rest") {
    return (
      <li className="flex gap-3 border-b line p-3 text-sm last:border-b-0">
        <span className="w-20 shrink-0 muted">{label}</span>
        <span className="w-20 shrink-0">Rest</span>
        <span className="muted">{w.description}</span>
      </li>
    );
  }

  return (
    <li className="border-b line last:border-b-0">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="hover-panel flex w-full items-center gap-3 p-3 text-left text-sm"
      >
        <span className="w-20 shrink-0 muted">{label}</span>
        <span className="w-20 shrink-0 capitalize">{w.type}</span>
        <span className="w-16 shrink-0">{w.distance_km ? `${w.distance_km} km` : ""}</span>
        <span className="hidden flex-1 muted sm:block">{w.description}</span>
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`ml-auto shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
          aria-hidden="true"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div className="panel border-t line px-3 py-3">
          {w.description && <p className="mb-3 text-sm muted sm:hidden">{w.description}</p>}
          <WorkoutDetail w={w} paces={paces} />
        </div>
      )}
    </li>
  );
}
