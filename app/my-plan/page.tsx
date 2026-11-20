"use client";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import Guard from "@/components/Guard";
import PlanCalendar, { LogStatus } from "@/components/PlanCalendar";
import { DISTANCE_KM, Workout, formatDate, formatDuration, formatPace, trainingPaces } from "@/lib/pace";

type UserPlan = {
  id: string;
  start_date: string;
  goal_time_seconds: number | null;
  plans: { title: string; goal_distance: string; plan_workouts: Workout[] };
};

// user plan id -> workout id -> status
type Logs = Record<string, Record<string, LogStatus>>;

function PlanSection({
  up,
  logs,
  onMark,
}: {
  up: UserPlan;
  logs: Record<string, LogStatus>;
  onMark: (workoutId: string, status: LogStatus | null) => Promise<string | null>;
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
        logs={logs}
        onMark={onMark}
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
          .select("user_plan_id,workout_id,status")
          .in("user_plan_id", plans.map((p) => p.id));
        const map: Logs = {};
        for (const r of rows ?? []) (map[r.user_plan_id] ??= {})[r.workout_id] = r.status as LogStatus;
        setLogs(map);
      }
      setItems(plans);
    }
    load();
  }, []);

  async function mark(userPlanId: string, workoutId: string, status: LogStatus | null) {
    const { error } = status
      ? await supabase
          .from("workout_logs")
          .upsert({ user_plan_id: userPlanId, workout_id: workoutId, status }, { onConflict: "user_plan_id,workout_id" })
      : await supabase.from("workout_logs").delete().eq("user_plan_id", userPlanId).eq("workout_id", workoutId);
    if (error) return error.message;
    setLogs((prev) => {
      const forPlan = { ...(prev[userPlanId] ?? {}) };
      if (status) forPlan[workoutId] = status;
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
        <PlanSection key={up.id} up={up} logs={logs[up.id] ?? {}} onMark={(wid, st) => mark(up.id, wid, st)} />
      ))}
    </Guard>
  );
}
