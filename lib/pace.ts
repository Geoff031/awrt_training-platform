// Pace maths. Training paces come from the Daniels/Gilbert VDOT formulas:
// goal time + race distance -> VDOT -> pace for each training intensity.

export const DISTANCE_KM: Record<string, number> = {
  "5k": 5,
  "10k": 10,
  half: 21.0975,
  marathon: 42.195,
};

export type Zone = "easy" | "tempo" | "interval" | "race";
// A coach can set a step's pace relative to the runner's goal race pace, or as a fixed pace.
// With no pace set, the pace comes from the zone (easy, tempo, interval, race).
export type PaceSpec = { mode: "offset"; offset: number } | { mode: "fixed"; sec: number }; // offset: sec/km, negative = faster than goal pace
export type RestKind = "jog" | "walk" | "stand";
export type Rest = { kind: RestKind; distance_km?: number; time_sec?: number };
export type Step = {
  label: string;
  distance_km: number; // for a timed step this is only an estimate
  zone: Zone;
  time_sec?: number; // set when the step is prescribed by time, e.g. 3 minutes
  pace?: PaceSpec;
  reps?: number; // a repeat block: this step done `reps` times
  rest?: Rest; // recovery between reps (none after the last rep)
  rest_kind?: RestKind; // only on the expanded rest steps made by expandSteps
};
export type Workout = {
  id: string;
  week_number: number;
  day_number: number;
  type: string;
  distance_km: number | null;
  description: string | null;
  steps: Step[] | null;
};

// Seconds per km. low = faster end of the range, high = slower end.
export type PaceRange = { low: number; high: number };
export type Paces = Record<Zone, PaceRange>;

export const EFFORT: Record<Zone, string> = {
  easy: "Easy, you can hold a conversation",
  tempo: "Comfortably hard",
  interval: "Hard but controlled",
  race: "Race effort",
};

function vdot(timeSec: number, km: number) {
  const t = timeSec / 60;
  const v = (km * 1000) / t; // metres per minute
  const vo2 = -4.6 + 0.182258 * v + 0.000104 * v * v;
  const fraction = 0.8 + 0.1894393 * Math.exp(-0.012778 * t) + 0.2989558 * Math.exp(-0.1932605 * t);
  return vo2 / fraction;
}

// Pace (sec/km) at a given fraction of VDOT
function paceAt(v: number, fraction: number) {
  const a = 0.000104;
  const b = 0.182258;
  const c = -4.6 - fraction * v;
  const speed = (-b + Math.sqrt(b * b - 4 * a * c)) / (2 * a); // metres per minute
  return 60000 / speed;
}

const round5 = (s: number) => Math.round(s / 5) * 5;

export function trainingPaces(goalSec: number, km: number): Paces {
  const v = vdot(goalSec, km);
  const race = goalSec / km;
  const tempo = round5(paceAt(v, 0.88));
  const interval = round5(paceAt(v, 0.98));
  return {
    easy: { low: round5(paceAt(v, 0.74)), high: round5(paceAt(v, 0.62)) },
    tempo: { low: tempo, high: tempo },
    interval: { low: interval, high: interval },
    race: { low: race, high: race },
  };
}

// A goal pace outside this range is almost certainly a typo
export function plausibleRacePace(goalSec: number, km: number) {
  const pace = goalSec / km;
  return pace >= 150 && pace <= 540;
}

export function formatPace(sec: number) {
  const s = Math.round(sec);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function paceText(zone: Zone, paces: Paces) {
  const p = paces[zone];
  return p.low === p.high ? `${formatPace(p.low)} /km` : `${formatPace(p.low)}–${formatPace(p.high)} /km`;
}

export function formatDuration(sec: number) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.round(sec % 60);
  return h > 0
    ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
    : `${m}:${String(s).padStart(2, "0")}`;
}

export function zoneForType(type: string): Zone {
  if (type === "tempo" || type === "progression") return "tempo";
  if (type === "intervals" || type === "hills" || type === "fartlek") return "interval";
  if (type === "race") return "race";
  return "easy";
}

// ---- Steps: repeat blocks, timed steps and per-step paces ----

const NOMINAL: Record<Zone, number> = { easy: 360, tempo: 300, interval: 270, race: 300 }; // sec/km when no goal is known

// Turn repeat blocks into a flat list: rep 1, rest, rep 2, rest ... rep N (no rest after the last rep)
export function expandSteps(steps: Step[]): Step[] {
  const out: Step[] = [];
  for (const s of steps) {
    const n = Math.max(1, Math.floor(s.reps ?? 1));
    const { reps: _r, rest, ...single } = s;
    void _r;
    if (n === 1) {
      out.push(single);
      continue;
    }
    for (let i = 1; i <= n; i++) {
      out.push({ ...single, label: `${s.label} ${i}` });
      if (i < n && rest) {
        out.push({
          label: rest.kind === "jog" ? "Jog" : rest.kind === "walk" ? "Walk" : "Stand",
          zone: "easy",
          distance_km: rest.distance_km ?? 0,
          ...(rest.time_sec ? { time_sec: rest.time_sec } : {}),
          rest_kind: rest.kind,
        });
      }
    }
  }
  return out;
}

// Pace (sec/km) for one expanded step. Without a goal, only fixed paces are known.
export function stepPaceSec(s: Step, paces: Paces | null): number {
  if (s.rest_kind === "walk") return 720;
  if (s.rest_kind === "stand") return 3600;
  if (s.rest_kind === "jog") return paces ? paces.easy.high : 390;
  if (s.pace?.mode === "fixed") return s.pace.sec;
  if (!paces) return NOMINAL[s.zone];
  if (s.pace?.mode === "offset") return paces.race.low + s.pace.offset; // race.low is the goal race pace
  return (paces[s.zone].low + paces[s.zone].high) / 2;
}

// Distance of one expanded step. Timed steps are worked out from the pace.
export function stepKm(s: Step, paces: Paces | null): number {
  return s.time_sec ? s.time_sec / stepPaceSec(s, paces) : s.distance_km;
}

export function totalKm(steps: Step[], paces: Paces | null = null): number {
  return expandSteps(steps).reduce((sum, s) => sum + stepKm(s, paces), 0);
}

export const offsetText = (o: number) => (o === 0 ? "goal pace" : `goal pace ${o < 0 ? "−" : "+"}${Math.abs(o)} s/km`);

// The pace to show for a step (empty for rests)
export function stepPaceText(s: Step, paces: Paces | null): string {
  if (s.rest_kind) return "";
  if (s.pace?.mode === "fixed") return `${formatPace(s.pace.sec)} /km`;
  if (s.pace?.mode === "offset") return paces ? `${formatPace(paces.race.low + s.pace.offset)} /km` : offsetText(s.pace.offset);
  return paces ? paceText(s.zone, paces) : "";
}

export const fmtDistance = (km: number) => (km < 1 ? `${Math.round(km * 1000)} m` : `${Number(km.toFixed(2))} km`);
export const fmtTime = (sec: number) => (sec < 60 ? `${sec} s` : sec % 60 === 0 ? `${sec / 60} min` : formatPace(sec));
export const amountText = (s: Step) => (s.time_sec ? fmtTime(s.time_sec) : fmtDistance(s.distance_km));
export const restText = (r: Rest) =>
  `${r.time_sec ? fmtTime(r.time_sec) : r.distance_km ? fmtDistance(r.distance_km) : ""} ${r.kind}`.trim();

// Use the saved steps, or fall back to one step for the whole run
export function stepsFor(w: Workout): Step[] {
  if (w.steps && w.steps.length > 0) return w.steps;
  if (!w.distance_km) return [];
  const label = w.type.charAt(0).toUpperCase() + w.type.slice(1) + " run";
  return [{ label, distance_km: Number(w.distance_km), zone: zoneForType(w.type) }];
}

// Estimated time for a run
export function estimateSeconds(steps: Step[], paces: Paces) {
  return expandSteps(steps).reduce((sum, s) => sum + (s.time_sec ?? s.distance_km * stepPaceSec(s, paces)), 0);
}

// Dates. Workout date = start date + (week - 1) * 7 + (day - 1)
export function workoutDate(start: string, week: number, day: number) {
  const d = new Date(start + "T00:00:00");
  d.setDate(d.getDate() + (week - 1) * 7 + (day - 1));
  return d;
}

export function formatDate(d: Date, withYear = false) {
  return d.toLocaleDateString("en-ZA", {
    weekday: "short",
    day: "numeric",
    month: "short",
    ...(withYear ? { year: "numeric" } : {}),
  });
}

// yyyy-mm-dd in local time (toISOString would shift the day in South Africa)
export function toISODate(d: Date) {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

// The next Monday, or today if today is a Monday
export function nextMonday(from = new Date()) {
  const d = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  d.setDate(d.getDate() + ((1 - d.getDay() + 7) % 7));
  return d;
}
