"use client";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import Guard from "@/components/Guard";
import CommentThread, { PlanComment } from "@/components/CommentThread";

type Row = PlanComment & {
  plan_title: string;
  week_number: number | null;
  day_number: number | null;
  workout_type: string | null;
};
type Thread = { key: string; userPlanId: string; workoutId: string | null; runner: string; where: string; rows: Row[]; waiting: boolean };

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

// Coach inbox: questions and comments from runners, grouped by plan and session.
export default function CoachMessages() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    supabase.rpc("coach_inbox").then(({ data, error: e }) => {
      if (e) setError(e.message);
      setRows((data as Row[]) ?? []);
    });
  }, []);

  const threads = useMemo<Thread[]>(() => {
    const map = new Map<string, Row[]>();
    for (const r of rows ?? []) {
      const key = `${r.user_plan_id}:${r.workout_id ?? "plan"}`;
      map.set(key, [...(map.get(key) ?? []), r]);
    }
    const out: Thread[] = [];
    for (const [key, list] of map) {
      const rs = [...list].sort((a, b) => a.created_at.localeCompare(b.created_at));
      const first = rs[0];
      out.push({
        key,
        userPlanId: first.user_plan_id,
        workoutId: first.workout_id,
        runner: rs.find((r) => !r.from_coach)?.author_name ?? "Runner",
        where: first.workout_id
          ? `Week ${first.week_number} · ${DAYS[(first.day_number ?? 1) - 1]} · ${first.workout_type}`
          : "About the plan",
        rows: rs,
        waiting: !rs[rs.length - 1].from_coach, // last word was the runner's
      });
    }
    return out.sort((a, b) => b.rows[b.rows.length - 1].created_at.localeCompare(a.rows[a.rows.length - 1].created_at));
  }, [rows]);

  async function reply(t: Thread, body: string) {
    const { data, error: e } = await supabase
      .from("plan_comments")
      .insert({ user_plan_id: t.userPlanId, workout_id: t.workoutId, body })
      .select("id,user_plan_id,workout_id,author_name,from_coach,body,created_at")
      .single();
    if (e || !data) return e?.message ?? "Could not send that reply.";
    const last = t.rows[0];
    setRows((prev) => [
      { ...(data as PlanComment), plan_title: last.plan_title, week_number: last.week_number, day_number: last.day_number, workout_type: last.workout_type },
      ...(prev ?? []),
    ]);
    return null;
  }

  const waiting = threads.filter((t) => t.waiting).length;

  return (
    <Guard>
      <h1 className="mb-1 text-2xl font-bold">Messages</h1>
      <p className="mb-5 text-sm muted">Questions and comments from runners on your plans.{waiting > 0 ? ` ${waiting} waiting for a reply.` : ""}</p>
      {rows === null && <p className="muted">Loading…</p>}
      {error && <p className="text-sm">✕ {error}</p>}
      {rows && threads.length === 0 && !error && <p className="muted">No messages yet.</p>}
      <ul className="space-y-4">
        {threads.map((t) => (
          <li key={t.key} className="rounded border line p-4">
            <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
              <div>
                <p className={`font-semibold ${t.workoutId ? "capitalize" : ""}`}>{t.where}</p>
                <p className="text-sm muted">{t.runner} · {t.rows[0].plan_title}</p>
              </div>
              {t.waiting && <span className="rounded border line px-2 py-0.5 text-xs">Needs reply</span>}
            </div>
            <CommentThread comments={t.rows} onSend={(body) => reply(t, body)} placeholder="Write a reply…" button="Reply" />
          </li>
        ))}
      </ul>
    </Guard>
  );
}
