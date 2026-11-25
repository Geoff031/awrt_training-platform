// Plan builder logic: preset workout types, week layouts and volume build. Pure code (no network).
import type { Step, Zone } from "@/lib/pace";

export type WorkoutType =
  | "easy" | "recovery" | "long" | "tempo" | "intervals" | "progression" | "hills" | "fartlek" | "race" | "rest";

export type Day = { type: WorkoutType; steps: Step[]; note: string };

export const ZONE_NAME: Record<Zone, string> = { easy: "Easy", tempo: "Tempo", interval: "Interval", race: "Race pace" };

// Pickable types (rest and race are handled separately in the UI list)
export const PRESETS: { type: WorkoutType; label: string; blurb: string; km10k: number }[] = [
  { type: "rest", label: "Rest", blurb: "Rest day", km10k: 0 },
  { type: "easy", label: "Easy run", blurb: "Relaxed, conversational effort.", km10k: 6 },
  { type: "recovery", label: "Recovery run", blurb: "Very gentle shake-out between harder days.", km10k: 4 },
  { type: "long", label: "Long run", blurb: "The week's longest run, kept easy.", km10k: 12 },
  { type: "tempo", label: "Tempo", blurb: "Warm-up, a sustained comfortably hard block, cool-down.", km10k: 8 },
  { type: "intervals", label: "Intervals", blurb: "Warm-up, hard repeats with easy jogs, cool-down.", km10k: 8 },
  { type: "progression", label: "Progression run", blurb: "Start easy and finish at tempo effort.", km10k: 8 },
  { type: "hills", label: "Hill repeats", blurb: "Warm-up, short hard hill reps with easy jogs down, cool-down.", km10k: 7 },
  { type: "fartlek", label: "Fartlek", blurb: "Warm-up, alternating hard surges and easy floats, cool-down.", km10k: 8 },
  { type: "race", label: "Race", blurb: "Race day: go for the goal.", km10k: 10 },
];

export const label = (t: WorkoutType) => PRESETS.find((p) => p.type === t)?.label ?? t;
export const blurb = (t: WorkoutType) => PRESETS.find((p) => p.type === t)?.blurb ?? "";

// Longer goal distances use longer sessions
const SCALE: Record<string, number> = { "5k": 0.8, "10k": 1, half: 1.4, marathon: 1.9 };

export const round1 = (n: number) => Math.round(n * 10) / 10;
const roundHalf = (n: number) => Math.max(0.5, Math.round(n * 2) / 2);
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
export const sumKm = (steps: Step[]) => round1(steps.reduce((s, x) => s + x.distance_km, 0));

export function defaultKm(type: WorkoutType, goal: string, goalKm: number) {
  if (type === "rest") return 0;
  if (type === "race") return goalKm;
  const base = PRESETS.find((p) => p.type === type)?.km10k ?? 6;
  return roundHalf(base * (SCALE[goal] ?? 1));
}

// Make the steps add up to exactly `km` by adjusting the last step
function fit(steps: Step[], km: number): Step[] {
  if (steps.length === 0) return steps;
  const out = steps.map((s) => ({ ...s, distance_km: round1(s.distance_km) }));
  const diff = round1(km - sumKm(out));
  const last = out[out.length - 1];
  last.distance_km = Math.max(0.1, round1(last.distance_km + diff));
  return out;
}

// The preset breakdown for a workout of `km` kilometres
export function buildSteps(type: WorkoutType, km: number): Step[] {
  const warm = (): Step => ({ label: "Warm-up", distance_km: clamp(roundHalf(km * 0.25), 1, 3), zone: "easy" });
  const cool = (): Step => ({ label: "Cool-down", distance_km: clamp(roundHalf(km * 0.2), 1, 2), zone: "easy" });
  const whole = (name: string, zone: Zone): Step[] => [{ label: name, distance_km: km, zone }];

  switch (type) {
    case "rest":
      return [];
    case "easy":
      return whole("Easy run", "easy");
    case "recovery":
      return whole("Recovery run", "easy");
    case "long":
      return whole("Long run", "easy");
    case "race":
      return whole("Race", "race");
    case "progression":
      return fit([{ label: "Easy", distance_km: km / 2, zone: "easy" }, { label: "Tempo finish", distance_km: km / 2, zone: "tempo" }], km);
    case "tempo": {
      if (km < 4) return whole("Tempo", "tempo");
      const w = warm(), c = cool();
      return fit([w, { label: "Tempo", distance_km: km - w.distance_km - c.distance_km, zone: "tempo" }, c], km);
    }
    case "intervals":
    case "hills":
    case "fartlek": {
      const rep = type === "intervals" ? 0.8 : type === "hills" ? 0.4 : 1;
      const jog = type === "intervals" ? 0.4 : type === "hills" ? 0.4 : 1;
      const names = type === "intervals" ? ["Rep", "Jog"] : type === "hills" ? ["Hill rep", "Jog down"] : ["Surge", "Float"];
      if (km < 4) return whole(label(type), "interval");
      const w = warm(), c = cool();
      const n = clamp(Math.floor((km - w.distance_km - c.distance_km) / (rep + jog)), 1, 10);
      const steps: Step[] = [w];
      for (let i = 1; i <= n; i++) {
        steps.push({ label: `${names[0]} ${i}`, distance_km: rep, zone: "interval" });
        steps.push({ label: names[1], distance_km: jog, zone: "easy" });
      }
      steps.push(c);
      return fit(steps, km);
    }
  }
}

// Change a workout's total distance, keeping the coach's step tweaks in proportion
export function scaleSteps(steps: Step[], km: number): Step[] {
  const total = sumKm(steps);
  if (steps.length === 0 || total <= 0) return steps;
  return fit(steps.map((s) => ({ ...s, distance_km: (s.distance_km * km) / total })), km);
}

// Which day of the week (1 = Monday ... 7 = Sunday) each session falls on
const LAYOUT: Record<number, WorkoutType[]> = {
  1: ["long"],
  2: ["easy", "long"],
  3: ["easy", "tempo", "long"],
  4: ["easy", "tempo", "easy", "long"],
  5: ["easy", "intervals", "easy", "tempo", "long"],
  6: ["easy", "intervals", "easy", "tempo", "recovery", "long"],
  7: ["easy", "intervals", "easy", "tempo", "easy", "recovery", "long"],
};
const DAYS: Record<number, number[]> = {
  1: [7], 2: [3, 7], 3: [2, 4, 7], 4: [1, 3, 5, 7], 5: [1, 2, 4, 6, 7], 6: [1, 2, 3, 5, 6, 7], 7: [1, 2, 3, 4, 5, 6, 7],
};

export type Setup = {
  weeks: number;
  sessions: number;
  goal: string; // 5k | 10k | half | marathon
  goalKm: number;
  build: number; // volume growth across the plan, e.g. 0.3 = 30%
  race: boolean; // finish with a race on the last Sunday and a lighter final week
};

// Weekly volume factor: a gradual build, an easier week every 4th week, and a taper
function factor(week: number, s: Setup) {
  let f = 1 + s.build * (s.weeks > 1 ? (week - 1) / (s.weeks - 1) : 0);
  if (s.weeks >= 8 && week % 4 === 0 && week !== s.weeks) f *= 0.8;
  if (s.race && week === s.weeks && s.weeks > 1) f *= 0.6;
  return f;
}

export function generateWeeks(s: Setup): Day[][] {
  const types = LAYOUT[Math.min(7, Math.max(1, s.sessions))];
  const days = DAYS[Math.min(7, Math.max(1, s.sessions))];
  const weeks: Day[][] = [];
  for (let w = 1; w <= s.weeks; w++) {
    const week: Day[] = Array.from({ length: 7 }, () => ({ type: "rest" as WorkoutType, steps: [], note: "" }));
    types.forEach((type, i) => {
      const km = Math.max(3, roundHalf(defaultKm(type, s.goal, s.goalKm) * factor(w, s)));
      week[days[i] - 1] = { type, steps: buildSteps(type, km), note: "" };
    });
    if (s.race && w === s.weeks) week[6] = { type: "race", steps: buildSteps("race", s.goalKm), note: "" };
    weeks.push(week);
  }
  return weeks;
}

// What gets saved for one day (matches the plan_workouts table)
export function toRow(planId: string, week: number, dayIndex: number, d: Day) {
  const km = sumKm(d.steps);
  return {
    plan_id: planId,
    week_number: week,
    day_number: dayIndex + 1,
    type: d.type,
    distance_km: d.type === "rest" ? null : km,
    description: d.note.trim() || blurb(d.type),
    steps: d.type === "rest" ? null : d.steps,
  };
}
