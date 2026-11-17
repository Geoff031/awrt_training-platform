import { createClient } from "@supabase/supabase-js";

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Date of a workout = plan start date + (week - 1) * 7 + (day - 1)
export function workoutDate(start: string, week: number, day: number) {
  const d = new Date(start + "T00:00:00");
  d.setDate(d.getDate() + (week - 1) * 7 + (day - 1));
  return d;
}

export function formatDate(d: Date) {
  return d.toLocaleDateString("en-ZA", { weekday: "short", day: "numeric", month: "short" });
}
