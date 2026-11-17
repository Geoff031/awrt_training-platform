"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Guard from "@/components/Guard";

type Plan = { id: string; title: string; description: string | null; goal_distance: string; weeks: number };
type Workout = { id: string; week_number: number; day_number: number; type: string; distance_km: number | null; description: string | null };

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export default function PlanDetail() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [plan, setPlan] = useState<Plan | null>(null);
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [start, setStart] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    supabase.from("plans").select("*").eq("id", id).single().then(({ data }) => setPlan(data));
    supabase
      .from("plan_workouts")
      .select("*")
      .eq("plan_id", id)
      .order("week_number")
      .order("day_number")
      .then(({ data }) => setWorkouts(data ?? []));
  }, [id]);

  async function startPlan() {
    setError("");
    if (!start) return setError("Pick a start date first.");
    const { data: auth } = await supabase.auth.getUser();
    const { error } = await supabase
      .from("user_plans")
      .insert({ user_id: auth.user!.id, plan_id: id, start_date: start });
    if (error) return setError(error.message);
    router.push("/my-plan");
  }

  const weeks = Array.from(new Set(workouts.map((w) => w.week_number)));

  return (
    <Guard>
      {!plan ? (
        <p className="text-gray-500">Loading…</p>
      ) : (
        <>
          <h1 className="text-2xl font-bold">{plan.title}</h1>
          <p className="mb-4 text-sm text-gray-600">
            {plan.goal_distance.toUpperCase()} · {plan.weeks} weeks
          </p>
          {plan.description && <p className="mb-4">{plan.description}</p>}

          <div className="mb-6 rounded border bg-gray-50 p-4">
            <label className="mb-1 block text-sm font-medium">When do you want to start?</label>
            <input type="date" className="mr-2 rounded border p-2" value={start} onChange={(e) => setStart(e.target.value)} />
            <button onClick={startPlan} className="rounded bg-black px-4 py-2 text-white">Start this plan</button>
            {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
          </div>

          {weeks.map((w) => (
            <div key={w} className="mb-4">
              <h2 className="mb-1 font-semibold">Week {w}</h2>
              <ul className="divide-y rounded border">
                {workouts.filter((x) => x.week_number === w).map((x) => (
                  <li key={x.id} className="flex gap-3 p-2 text-sm">
                    <span className="w-10 text-gray-500">{DAYS[x.day_number - 1]}</span>
                    <span className="w-24 capitalize">{x.type}</span>
                    <span className="w-14">{x.distance_km ? `${x.distance_km} km` : ""}</span>
                    <span className="text-gray-600">{x.description}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </>
      )}
    </Guard>
  );
}
