import { supabase } from "@/lib/supabase";

// A run saved in the runner's history (from a watch or running app)
export type Activity = {
  id: string;
  source: string;
  activity_date: string; // YYYY-MM-DD, local
  started_local: string | null;
  name: string | null;
  activity_type: string | null;
  event_type: string | null;
  distance_km: number;
  duration_seconds: number;
  elevation_gain_m: number | null;
  avg_hr: number | null;
  max_hr: number | null;
  hr_zone_seconds: number[] | null;
};

const COLUMNS =
  "id,source,activity_date,started_local,name,activity_type,event_type,distance_km,duration_seconds,elevation_gain_m,avg_hr,max_hr,hr_zone_seconds";

// All of the runner's saved runs, oldest first (read in pages of 1000)
export async function loadActivities(): Promise<Activity[]> {
  const out: Activity[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from("activities")
      .select(COLUMNS)
      .order("activity_date")
      .order("started_local")
      .range(from, from + 999);
    if (error || !data) break;
    out.push(
      ...data.map((r) => ({
        ...r,
        distance_km: Number(r.distance_km),
        elevation_gain_m: r.elevation_gain_m === null ? null : Number(r.elevation_gain_m),
      })),
    );
    if (data.length < 1000) break;
  }
  return out as Activity[];
}
