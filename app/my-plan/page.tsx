"use client";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import Guard from "@/components/Guard";
import CommentThread, { PlanComment } from "@/components/CommentThread";
import PlanCalendar, { LogEntry, LogInput, LogStatus } from "@/components/PlanCalendar";
import { DISTANCE_KM, Workout, formatDate, formatDuration, formatPace, trainingPaces } from "@/lib/pace";

type UserPlan = {
  id: string;
  start_date: string;
  goal_time_seconds: number | null;
  plans: { title: string; goal_distance: string; created_by: string | null; plan_workouts: Workout[] };
};

// user plan id -> workout id -> log
type Logs = Record<string, Record<string, LogEntry>>;

function PlanSection({
  up,
  logs,
  onLog,
  comments,
  onSend,
  onCancel,
}: {
  up: UserPlan;
  logs: Record<string, LogEntry>;
  onLog: (workoutId: string, entry: LogInput | null) => Promise<string | null>;
  comments: PlanComment[];
  onSend: (workoutId: string | null, body: string) => Promise<string | null>;
  onCancel: () => Promise<string | null>;
}) {
  const [confirming, setConfirming] = useState(false);
  const [cancelError, setCancelError] = useState("");
  const [cancelling, setCancelling] = useState(false);
  const hasCoach = Boolean(up.plans.created_by); // AI/sample plans have no coach to message
  const planLevel = comments.filter((c) => c.workout_id === null);

  const km = DISTANCE_KM[up.plans.goal_distance];
  const paces = useMemo(
    () => (up.goal_time_seconds ? trainingPaces(up.goal_time_seconds, km) : null),
    [up.goal_time_seconds, km]
  );

  return (
    <div className="mb-10">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold">{up.plans.title}</h2>
          <p className="text-sm muted">Starts {formatDate(new Date(up.start_date + "T00:00:00"), true)}</p>
          <p className="mb-4 text-sm muted">
            {up.goal_time_seconds
              ? `Goal ${formatDuration(up.goal_time_seconds)} · ${formatPace(up.goal_time_seconds / km)} /km`
              : "Goal: just finish"}
          </p>
        </div>
        {!confirming && (
          <button className="btn-ghost shrink-0" onClick={() => setConfirming(true)}>
            Cancel plan
          </button>
        )}
      </div>

      {confirming && (
        <div className="panel mb-4 rounded border line p-3 text-sm" role="alertdialog" aria-label="Cancel this plan?">
          <p className="mb-2">Cancel this plan? It leaves your calendar. Runs you logged are kept, and you can start the plan again later.</p>
          <div className="flex gap-2">
            <button
              className="btn"
              disabled={cancelling}
              onClick={async () => {
                setCancelling(true);
                const err = await onCancel();
                if (err) {
                  setCancelError(err);
                  setCancelling(false);
                }
              }}
            >
              {cancelling ? "Cancelling…" : "Yes, cancel plan"}
            </button>
            <button className="btn-ghost" disabled={cancelling} onClick={() => setConfirming(false)}>
              Keep plan
            </button>
          </div>
          {cancelError && <p className="mt-2">✕ {cancelError}</p>}
        </div>
      )}

      {hasCoach && (
        <details className="mb-4 rounded border line p-3">
          <summary className="cursor-pointer text-sm font-medium">
            Message your coach{planLevel.length > 0 ? ` (${planLevel.length})` : ""}
          </summary>
          <div className="mt-3">
            <CommentThread comments={planLevel} onSend={(body) => onSend(null, body)} placeholder="Ask a question or share an update about the plan…" />
          </div>
        </details>
      )}
      <PlanCalendar
        startDate={up.start_date}
        workouts={up.plans.plan_workouts}
        paces={paces}
        goalSeconds={up.goal_time_seconds}
        logs={logs}
        onLog={onLog}
        extra={
          hasCoach
            ? (w) => {
                const mine = comments.filter((c) => c.workout_id === w.id);
                return (
                  <details key={w.id} open={mine.length > 0}>
                    <summary className="cursor-pointer text-sm font-medium">
                      Comment or ask your coach{mine.length > 0 ? ` (${mine.length})` : ""}
                    </summary>
                    <div className="mt-3">
                      <CommentThread comments={mine} onSend={(body) => onSend(w.id, body)} placeholder="How did it feel? Any questions about this session?" />
                    </div>
                  </details>
                );
              }
            : undefined
        }
      />
    </div>
  );
}

export default function MyPlan() {
  const [items, setItems] = useState<UserPlan[] | null>(null);
  const [logs, setLogs] = useState<Logs>({});
  const [comments, setComments] = useState<PlanComment[]>([]);

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from("user_plans")
        .select("id,start_date,goal_time_seconds,plans(title,goal_distance,created_by,plan_workouts(*))")
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
        const { data: msgs } = await supabase
          .from("plan_comments")
          .select("id,user_plan_id,workout_id,author_name,from_coach,body,created_at")
          .in("user_plan_id", plans.map((p) => p.id))
          .order("created_at");
        setComments((msgs as PlanComment[]) ?? []);
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

  async function sendComment(userPlanId: string, workoutId: string | null, body: string) {
    const { data, error } = await supabase
      .from("plan_comments")
      .insert({ user_plan_id: userPlanId, workout_id: workoutId, body })
      .select("id,user_plan_id,workout_id,author_name,from_coach,body,created_at")
      .single();
    if (error || !data) return error?.message ?? "Could not send that message.";
    setComments((prev) => [...prev, data as PlanComment]);
    return null;
  }

  // Cancelling keeps the logs and messages; the plan just leaves the calendar
  async function cancelPlan(userPlanId: string) {
    const { error } = await supabase.from("user_plans").update({ status: "cancelled" }).eq("id", userPlanId);
    if (error) return error.message;
    setItems((prev) => (prev ? prev.filter((p) => p.id !== userPlanId) : prev));
    return null;
  }

  return (
    <Guard>
      <h1 className="mb-4 text-2xl font-bold">My plan</h1>
      {items === null && <p className="muted">Loading…</p>}
      {items?.length === 0 && <p className="muted">You haven&apos;t started a plan yet. Pick one on the Plans page.</p>}
      {items?.map((up) => (
        <PlanSection
          key={up.id}
          up={up}
          logs={logs[up.id] ?? {}}
          onLog={(wid, input) => log(up.id, wid, input)}
          comments={comments.filter((c) => c.user_plan_id === up.id)}
          onSend={(wid, body) => sendComment(up.id, wid, body)}
          onCancel={() => cancelPlan(up.id)}
        />
      ))}
    </Guard>
  );
}
