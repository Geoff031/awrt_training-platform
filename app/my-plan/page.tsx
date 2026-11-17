"use client";
import { useEffect, useState } from "react";
import { supabase, workoutDate, formatDate } from "@/lib/supabase";
import Guard from "@/components/Guard";

type Workout = { id: string; week_number: number; day_number: number; type: string; distance_km: number | null; description: string | null };
type UserPlan = { id: string; start_date: string; plans: { title: string; plan_workouts: Workout[] } };

export default function MyPlan() {
  const [items, setItems] = useState<UserPlan[] | null>(null);

  useEffect(() => {
    supabase
      .from("user_plans")
      .select("id,start_date,plans(title,plan_workouts(*))")
      .eq("status", "active")
      .order("start_date")
      .then(({ data }) => setItems((data as unknown as UserPlan[]) ?? []));
  }, []);

  return (
    <Guard>
      <h1 className="mb-4 text-2xl font-bold">My plan</h1>
      {items === null && <p className="text-gray-500">Loading…</p>}
      {items?.length === 0 && <p className="text-gray-500">You haven&apos;t started a plan yet. Pick one on the Plans page.</p>}
      {items?.map((up) => {
        const sorted = [...up.plans.plan_workouts]
          .filter((w) => w.type !== "rest")
          .sort((a, b) => a.week_number - b.week_number || a.day_number - b.day_number);
        return (
          <div key={up.id} className="mb-8">
            <h2 className="font-semibold">{up.plans.title}</h2>
            <p className="mb-2 text-sm text-gray-600">Starts {formatDate(new Date(up.start_date + "T00:00:00"))}</p>
            <ul className="divide-y rounded border">
              {sorted.map((w) => (
                <li key={w.id} className="flex gap-3 p-2 text-sm">
                  <span className="w-24 text-gray-500">{formatDate(workoutDate(up.start_date, w.week_number, w.day_number))}</span>
                  <span className="w-24 capitalize">{w.type}</span>
                  <span className="w-14">{w.distance_km ? `${w.distance_km} km` : ""}</span>
                  <span className="text-gray-600">{w.description}</span>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </Guard>
  );
}
