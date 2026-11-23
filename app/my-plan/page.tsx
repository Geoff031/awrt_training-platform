"use client";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import Guard from "@/components/Guard";
import PlanCalendar, { LogEntry, LogInput, LogStatus } from "@/components/PlanCalendar";
import { DISTANCE_KM, Workout, formatDate, formatDuration, formatPace, trainingPaces } from "@/lib/pace";

type UserPlan = {
  id: string;
  start_date: string;
  goal_time_seconds: number | null;
  plans: { title: string; goal_distance: string; plan_workouts: Workout[] };
};

// user plan id -> workout id -> log
type Logs = Record<string, Record<string, LogEntry>>;

function PlanSection({
  up,
  logs,
  onLog,
}: {
  up: UserPlan;
  logs: Record<string, LogEntry>;
  onLog: (workoutId: string, entry: LogInput | null) => Promise<string | null>;
}) {
  const km = DISTANCE_KM[up.plans.goal_distance];
  const paces = useMemo(
    () => (up.goal_time_seconds ? trainingPaces(up.goal_time_seconds, km) : null),
    [up.goal_time_seconds, km]
  );

  return (
    <div className="mb-10">
      <h2 className="font-semibold">{up.plans.title}</h2>
      <p className="text-sm muted">Starts {formatDate(new Date(up.start_date + "T00:00:00"), true)}</p>
      <p className="mb-4 text-sm muted">
        {up.goal_time_seconds
          ? `Goal ${formatDuration(up.goal_time_seconds)} · ${formatPace(up.goal_time_seconds / km)} /km`
          : "Goal: just finish"}
      </p>
      <PlanCalendar
        startDate={up.start_date}
        workouts={up.plans.plan_workouts}
        paces={paces}
        goalSeconds={up.goal_time_seconds}
        logs={logs}
        onLog={onLog}
      />
    </div>
  );
}

export default function MyPlan() {
  const [items, setItems] = useState<UserPlan[] | null>(null);
  const [logs, setLogs] = useState<Logs>({});

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from("user_plans")
        .select("id,start_date,goal_time_seconds,plans(title,goal_distance,plan_workouts(*))")
        .eq("status", "active")
        .order("start_date");
      const plans = (data as unknown as UserPlan[]) ?? [];
      if (plans.length > 0) {
        const { data: rows } = await supabase
          .from("workout_logs")
          .select("user_plan_id,workout_id,status,actual_distance_km,actual_time_seconds,source")
          .in("user_plan_id", plans.map((p) => p.id));
        const map: Logs = {};
        for (const r of rows ?? []) {
          (map[r.user_plan_id] ??= {})[r.workout_id] = {
            status: r.status as LogStatus,
            distance_km: r.actual_distance_km === null ? null : Number(r.actual_distance_km),
            time_seconds: r.actual_time_seconds,
            source: r.source,
          };
        }
        setLogs(map);
      }
      setItems(plans);
    }
    load();
  }, []);

  async function log(userPlanId: string, workoutId: string, input: LogInput | null) {
    const { error } = input
      ? await supabase.from("workout_logs").upsert(
          {
            user_plan_id: userPlanId,
            workout_id: workoutId,
            status: input.status,
            actual_distance_km: input.distance_km,
            actual_time_seconds: input.time_seconds,
            source: "manual",
          },
          { onConflict: "user_plan_id,workout_id" }
        )
      : await supabase.from("workout_logs").delete().eq("user_plan_id", userPlanId).eq("workout_id", workoutId);
    if (error) return error.message;
    setLogs((prev) => {
      const forPlan = { ...(prev[userPlanId] ?? {}) };
      if (input) forPlan[workoutId] = { ...input, source: "manual" };
      else delete forPlan[workoutId];
      return { ...prev, [userPlanId]: forPlan };
    });
    return null;
  }

  return (
    <Guard>
      <h1 className="mb-4 text-2xl font-bold">My plan</h1>
      {items === null && <p className="muted">Loading…</p>}
      {items?.length === 0 && <p className="muted">You haven&apos;t started a plan yet. Pick one on the Plans page.</p>}
      {items?.map((up) => (
        <PlanSection key={up.id} up={up} logs={logs[up.id] ?? {}} onLog={(wid, input) => log(up.id, wid, input)} />
      ))}
    </Guard>
  );
}
