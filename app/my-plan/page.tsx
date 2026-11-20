"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import Guard from "@/components/Guard";
import WorkoutRow from "@/components/WorkoutRow";
import { DISTANCE_KM, Workout, formatDate, formatDuration, formatPace, trainingPaces, workoutDate } from "@/lib/pace";

type UserPlan = {
  id: string;
  start_date: string;
  goal_time_seconds: number | null;
  plans: { title: string; goal_distance: string; plan_workouts: Workout[] };
};

export default function MyPlan() {
  const [items, setItems] = useState<UserPlan[] | null>(null);

  useEffect(() => {
    supabase
      .from("user_plans")
      .select("id,start_date,goal_time_seconds,plans(title,goal_distance,plan_workouts(*))")
      .eq("status", "active")
      .order("start_date")
      .then(({ data }) => setItems((data as unknown as UserPlan[]) ?? []));
  }, []);

  return (
    <Guard>
      <h1 className="mb-4 text-2xl font-bold">My plan</h1>
      {items === null && <p className="muted">Loading…</p>}
      {items?.length === 0 && <p className="muted">You haven&apos;t started a plan yet. Pick one on the Plans page.</p>}
      {items?.map((up) => {
        const km = DISTANCE_KM[up.plans.goal_distance];
        const paces = up.goal_time_seconds ? trainingPaces(up.goal_time_seconds, km) : null;
        const sorted = [...up.plans.plan_workouts]
          .filter((w) => w.type !== "rest")
          .sort((a, b) => a.week_number - b.week_number || a.day_number - b.day_number);
        return (
          <div key={up.id} className="mb-8">
            <h2 className="font-semibold">{up.plans.title}</h2>
            <p className="text-sm muted">Starts {formatDate(new Date(up.start_date + "T00:00:00"), true)}</p>
            <p className="mb-2 text-sm muted">
              {up.goal_time_seconds
                ? `Goal ${formatDuration(up.goal_time_seconds)} · ${formatPace(up.goal_time_seconds / km)} /km`
                : "Goal: just finish"}
            </p>
            <ul className="overflow-hidden rounded border line">
              {sorted.map((w) => (
                <WorkoutRow
                  key={w.id}
                  w={w}
                  label={formatDate(workoutDate(up.start_date, w.week_number, w.day_number))}
                  paces={paces}
                />
              ))}
            </ul>
          </div>
        );
      })}
    </Guard>
  );
}
