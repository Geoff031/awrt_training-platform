// Pace maths. Training paces come from the Daniels/Gilbert VDOT formulas:
// goal time + race distance -> VDOT -> pace for each training intensity.

export const DISTANCE_KM: Record<string, number> = {
  "5k": 5,
  "10k": 10,
  half: 21.0975,
  marathon: 42.195,
};

export type Zone = "easy" | "tempo" | "interval" | "race";
export type Step = { label: string; distance_km: number; zone: Zone };
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

// Use the saved steps, or fall back to one step for the whole run
export function stepsFor(w: Workout): Step[] {
  if (w.steps && w.steps.length > 0) return w.steps;
  if (!w.distance_km) return [];
  const label = w.type.charAt(0).toUpperCase() + w.type.slice(1) + " run";
  return [{ label, distance_km: Number(w.distance_km), zone: zoneForType(w.type) }];
}

// Estimated time for a run, using the middle of each pace range
export function estimateSeconds(steps: Step[], paces: Paces) {
  return steps.reduce((sum, s) => {
    const p = paces[s.zone];
    return sum + s.distance_km * ((p.low + p.high) / 2);
  }, 0);
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
