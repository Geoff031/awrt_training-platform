// Run history maths: totals, yearly and monthly distance, personal bests. Pure code (no network).
import type { HistoryRun } from "@/lib/activities";

export type Totals = { km: number; runs: number; seconds: number };

export const PB_DISTANCES = [
  { key: "1000", label: "1 km" },
  { key: "1609", label: "1 mile" },
  { key: "5000", label: "5 km" },
  { key: "10000", label: "10 km" },
  { key: "21098", label: "Half marathon" },
  { key: "42195", label: "Marathon" },
];

export function totalsOf(runs: HistoryRun[]): Totals {
  return runs.reduce((t, r) => ({ km: t.km + r.distance_km, runs: t.runs + 1, seconds: t.seconds + r.duration_seconds }), { km: 0, runs: 0, seconds: 0 });
}

// Average pace (seconds per km) over a set of runs
export const avgPace = (t: Totals) => (t.km > 0 ? t.seconds / t.km : null);

export const inYear = (runs: HistoryRun[], year: number) => runs.filter((r) => r.activity_date.startsWith(`${year}-`));
export const inMonth = (runs: HistoryRun[], year: number, month: number) =>
  runs.filter((r) => r.activity_date.startsWith(`${year}-${String(month).padStart(2, "0")}-`));

// Runs per week since the first run
export function runsPerWeek(runs: HistoryRun[], todayISO: string) {
  if (runs.length === 0) return 0;
  const ms = new Date(todayISO + "T00:00:00").getTime() - new Date(runs[0].activity_date + "T00:00:00").getTime();
  return runs.length / Math.max(1, ms / (7 * 86400000));
}

// Every year from the first run to this year (years without runs count as 0)
export function yearlyKm(runs: HistoryRun[], thisYear: number) {
  if (runs.length === 0) return [];
  const first = Number(runs[0].activity_date.slice(0, 4));
  const out: { year: number; km: number }[] = [];
  for (let y = first; y <= thisYear; y++) out.push({ year: y, km: totalsOf(inYear(runs, y)).km });
  return out;
}

export function monthlyKm(runs: HistoryRun[], year: number) {
  const km = Array<number>(12).fill(0);
  for (const r of inYear(runs, year)) km[Number(r.activity_date.slice(5, 7)) - 1] += r.distance_km;
  return km;
}

export type PB = { key: string; label: string; seconds: number; date: string; name: string | null };

// Fastest time for each distance, using the fastest split Garmin recorded inside each run.
// Times that would mean a pace faster than 2:00/km or slower than 10:00/km are ignored as bad data.
export function personalBests(runs: HistoryRun[]): PB[] {
  const out: PB[] = [];
  for (const d of PB_DISTANCES) {
    const metres = d.key === "21098" ? 21097.5 : Number(d.key);
    let best: PB | null = null;
    for (const r of runs) {
      const t = r.best_splits?.[d.key];
      if (!t) continue;
      const pace = t / (metres / 1000);
      if (pace < 120 || pace > 600) continue;
      if (!best || t < best.seconds) best = { key: d.key, label: d.label, seconds: t, date: r.activity_date, name: r.name };
    }
    if (best) out.push(best);
  }
  return out;
}

export type Records = {
  longest: HistoryRun | null;
  bestMonth: { year: number; month: number; km: number } | null;
  bestYear: { year: number; km: number } | null;
};

export function records(runs: HistoryRun[], thisYear: number): Records {
  let longest: HistoryRun | null = null;
  for (const r of runs) if (!longest || r.distance_km > longest.distance_km) longest = r;
  let bestMonth: Records["bestMonth"] = null;
  let bestYear: Records["bestYear"] = null;
  for (const y of yearlyKm(runs, thisYear)) {
    if (y.km > 0 && (!bestYear || y.km > bestYear.km)) bestYear = y;
    const months = monthlyKm(runs, y.year);
    for (let i = 0; i < 12; i++) {
      if (months[i] > 0 && (!bestMonth || months[i] > bestMonth.km)) bestMonth = { year: y.year, month: i, km: months[i] };
    }
  }
  return { longest, bestMonth, bestYear };
}
