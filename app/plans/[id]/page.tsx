"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Guard from "@/components/Guard";
import WorkoutRow from "@/components/WorkoutRow";
import {
  DISTANCE_KM,
  Workout,
  formatDate,
  formatPace,
  nextMonday,
  paceText,
  plausibleRacePace,
  toISODate,
  trainingPaces,
} from "@/lib/pace";

type Plan = { id: string; title: string; description: string | null; goal_distance: string; weeks: number };

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export default function PlanDetail() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [plan, setPlan] = useState<Plan | null>(null);
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [start, setStart] = useState("");
  const [mode, setMode] = useState<"finish" | "goal">("finish");
  const [h, setH] = useState("");
  const [m, setM] = useState("");
  const [s, setS] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    supabase.from("plans").select("*").eq("id", id).single().then(({ data }) => setPlan(data));
    supabase
      .from("plan_workouts")
      .select("*")
      .eq("plan_id", id)
      .order("week_number")
      .order("day_number")
      .then(({ data }) => setWorkouts((data as Workout[]) ?? []));
  }, [id]);

  const km = plan ? DISTANCE_KM[plan.goal_distance] : 0;
  const goalSec = mode === "goal" ? (Number(h) || 0) * 3600 + (Number(m) || 0) * 60 + (Number(s) || 0) : 0;
  const goalOk = goalSec > 0 && km > 0 && plausibleRacePace(goalSec, km);
  const paces = goalOk ? trainingPaces(goalSec, km) : null;

  const startDate = start ? new Date(start + "T00:00:00") : null;
  const isMonday = startDate?.getDay() === 1;
  const endDate = startDate && plan ? new Date(startDate.getTime()) : null;
  if (endDate && plan) endDate.setDate(endDate.getDate() + plan.weeks * 7 - 1);
  const monday = nextMonday();

  async function startPlan() {
    setError("");
    if (!startDate) return setError("Pick a start date first.");
    if (!isMonday) return setError("Plans run Monday to Sunday, so please pick a Monday.");
    if (toISODate(startDate) < toISODate(new Date())) return setError("That date has already passed.");
    if (mode === "goal" && !goalOk) return setError("Enter a realistic goal time, or choose Just finish.");
    const { data: auth } = await supabase.auth.getUser();
    const { error } = await supabase.from("user_plans").insert({
      user_id: auth.user!.id,
      plan_id: id,
      start_date: start,
      goal_time_seconds: mode === "goal" ? goalSec : null,
    });
    if (error) return setError(error.message);
    router.push("/my-plan");
  }

  const weeks = Array.from(new Set(workouts.map((w) => w.week_number)));
  const toggle = (value: "finish" | "goal", text: string) => (
    <button
      type="button"
      onClick={() => setMode(value)}
      aria-pressed={mode === value}
      className={`btn-ghost ${mode === value ? "seg-on" : ""}`}
    >
      {text}
    </button>
  );

  return (
    <Guard>
      {!plan ? (
        <p className="muted">Loading…</p>
      ) : (
        <>
          <h1 className="text-2xl font-bold">{plan.title}</h1>
          <p className="mb-4 text-sm muted">
            {plan.goal_distance.toUpperCase()} · {plan.weeks} weeks
          </p>
          {plan.description && <p className="mb-4">{plan.description}</p>}

          <div className="panel mb-6 space-y-5 rounded border line p-4">
            <div>
              <label htmlFor="start" className="mb-1 block text-sm font-medium">Start date (a Monday)</label>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  id="start"
                  type="date"
                  className="field"
                  min={toISODate(new Date())}
                  value={start}
                  onChange={(e) => setStart(e.target.value)}
                />
                <button type="button" className="btn-ghost" onClick={() => setStart(toISODate(monday))}>
                  Next Monday
                </button>
              </div>
              {startDate && endDate && (
                <p className="mt-2 text-sm">
                  {formatDate(startDate, true)} → {formatDate(endDate, true)}
                  <span className="muted"> · {plan.weeks} weeks</span>
                </p>
              )}
              {startDate && !isMonday && (
                <p className="mt-1 text-sm muted">
                  That isn&apos;t a Monday.{" "}
                  <button type="button" className="underline" onClick={() => {
                    const d = new Date(startDate.getTime());
                    d.setDate(d.getDate() + ((1 - d.getDay() + 7) % 7));
                    setStart(toISODate(d));
                  }}>
                    Use the next Monday
                  </button>
                </p>
              )}
            </div>

            <div>
              <p className="mb-1 text-sm font-medium">Your goal</p>
              <div className="flex gap-2">
                {toggle("finish", "Just finish")}
                {toggle("goal", `${plan.goal_distance.toUpperCase()} goal time`)}
              </div>
              {mode === "goal" && (
                <div className="mt-3">
                  <div className="flex items-center gap-2">
                    <input aria-label="Hours" inputMode="numeric" placeholder="h" className="field w-16 text-center" value={h} onChange={(e) => setH(e.target.value.replace(/\D/g, ""))} />
                    <span className="muted">:</span>
                    <input aria-label="Minutes" inputMode="numeric" placeholder="mm" className="field w-16 text-center" value={m} onChange={(e) => setM(e.target.value.replace(/\D/g, ""))} />
                    <span className="muted">:</span>
                    <input aria-label="Seconds" inputMode="numeric" placeholder="ss" className="field w-16 text-center" value={s} onChange={(e) => setS(e.target.value.replace(/\D/g, ""))} />
                  </div>
                  {goalSec > 0 && !goalOk && (
                    <p className="mt-2 text-sm">That pace looks unrealistic for a {plan.goal_distance.toUpperCase()}. Please check the time.</p>
                  )}
                  {paces && (
                    <div className="mt-3 text-sm">
                      <p className="font-medium">Your target paces</p>
                      <p className="muted">
                        Goal pace {formatPace(goalSec / km)} /km · Easy {paceText("easy", paces)} · Tempo {paceText("tempo", paces)}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div>
              <button onClick={startPlan} className="btn">Start this plan</button>
              {error && <p className="mt-2 text-sm">{error}</p>}
            </div>
          </div>

          {weeks.map((w) => (
            <div key={w} className="mb-4">
              <h2 className="mb-1 font-semibold">Week {w}</h2>
              <ul className="overflow-hidden rounded border line">
                {workouts
                  .filter((x) => x.week_number === w)
                  .map((x) => (
                    <WorkoutRow key={x.id} w={x} label={DAYS[x.day_number - 1]} paces={paces} />
                  ))}
              </ul>
            </div>
          ))}
        </>
      )}
    </Guard>
  );
}
