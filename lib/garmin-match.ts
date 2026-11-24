// Matching synced runs to planned runs. Pure logic (no network), so it is easy to test.

export type RunSummary = { id: string; date: string; distance_km: number; time_seconds: number };
export type PlannedRun = { workout_id: string; date: string; distance_km: number | null; isRest: boolean };
export type Match = { workout_id: string; run: RunSummary };

const MIN_RUN_KM = 0.5;

// For each planned run on or before `today` that is not already logged, pick the
// run done on the same date whose distance is closest to the plan. Each run is
// used once. Rest days are ignored, and nothing is ever marked missed or skipped.
export function matchRuns(runs: RunSummary[], planned: PlannedRun[], alreadyLogged: Set<string>, today: string): Match[] {
  const used = new Set<string>();
  const matches: Match[] = [];

  const ordered = [...planned].sort((a, b) => a.date.localeCompare(b.date));
  for (const p of ordered) {
    if (p.isRest || p.date > today || alreadyLogged.has(p.workout_id)) continue;

    const candidates = runs.filter((r) => r.date === p.date && !used.has(r.id) && r.distance_km >= MIN_RUN_KM);
    if (candidates.length === 0) continue;

    const target = p.distance_km;
    const best = candidates.reduce((a, b) =>
      target === null
        ? (b.distance_km > a.distance_km ? b : a)
        : (Math.abs(b.distance_km - target) < Math.abs(a.distance_km - target) ? b : a)
    );
    used.add(best.id);
    matches.push({ workout_id: p.workout_id, run: best });
  }
  return matches;
}
