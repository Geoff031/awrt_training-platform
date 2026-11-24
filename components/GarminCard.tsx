"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { GarminRun } from "@/lib/garmin-parse";
import { Match, PlannedRun, matchRuns } from "@/lib/garmin-match";
import { Workout, formatDate, formatDuration, formatPace, toISODate, workoutDate } from "@/lib/pace";

export type PlanForSync = { id: string; title: string; start_date: string; workouts: Workout[]; loggedIds: string[] };
export type SyncImport = { userPlanId: string; workoutId: string; distance_km: number; time_seconds: number };

type TestResult = { ok: boolean; message: string; status?: number; shape?: string; fields?: string[]; length?: number; headers?: string[] };
type Attempt = {
  name: string;
  path: string;
  ok: boolean;
  status: number;
  error?: string;
  shape?: string;
  count?: number;
  itemKeys?: string[];
  sample?: Record<string, string | number | boolean | null>[];
};
type PreviewResult = { ok: boolean; message?: string; attempts?: Attempt[] };

type Proposal = { key: string; userPlanId: string; workout: Workout; date: string; run: GarminRun };
type SyncState = { fetched: number; proposals: Proposal[]; picked: Set<string> };

const SYNC_DAYS = 120; // how far back one sync looks

// Only shown to the account linked to the personal Garmin key.
export default function GarminCard({
  plans,
  ready,
  onImport,
}: {
  plans: PlanForSync[];
  ready: boolean;
  onImport: (rows: SyncImport[]) => Promise<string | null>;
}) {
  const [linked, setLinked] = useState(false);
  const [busy, setBusy] = useState<"" | "test" | "preview" | "sync" | "import">("");
  const [result, setResult] = useState<TestResult | null>(null);
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [sync, setSync] = useState<SyncState | null>(null);
  const [note, setNote] = useState("");

  async function authHeader() {
    const { data } = await supabase.auth.getSession();
    return { Authorization: `Bearer ${data.session?.access_token ?? ""}` };
  }

  useEffect(() => {
    authHeader()
      .then((headers) => fetch("/api/garmin/status", { headers }))
      .then((r) => r.json())
      .then((j) => setLinked(Boolean(j.linked)))
      .catch(() => setLinked(false));
  }, []);

  async function run(kind: "test" | "preview") {
    setBusy(kind);
    if (kind === "test") setResult(null);
    else setPreview(null);
    try {
      const res = await fetch(`/api/garmin/${kind}`, { method: "POST", headers: await authHeader() });
      const json = await res.json();
      if (kind === "test") setResult(json);
      else setPreview(json);
    } catch {
      const failed = { ok: false, message: "Could not reach the server." };
      if (kind === "test") setResult(failed);
      else setPreview(failed);
    }
    setBusy("");
  }

  // Fetch runs from Garmin, match them to plan days, and show the matches to confirm
  async function findRuns() {
    setBusy("sync");
    setSync(null);
    setNote("");
    const today = toISODate(new Date());
    const earliest = plans.map((p) => p.start_date).sort()[0];
    const floor = new Date();
    floor.setDate(floor.getDate() - SYNC_DAYS);
    const from = earliest && earliest > toISODate(floor) ? earliest : toISODate(floor);

    try {
      const res = await fetch("/api/garmin/runs", {
        method: "POST",
        headers: { ...(await authHeader()), "Content-Type": "application/json" },
        body: JSON.stringify({ from, to: today }),
      });
      const json = await res.json();
      if (!json.ok) {
        setNote(json.message ?? "Garmin did not return your runs.");
        setBusy("");
        return;
      }
      const runs: GarminRun[] = json.runs;
      const byId = new Map(runs.map((r) => [r.id, r]));
      const taken = new Set<string>(); // a run is used by one plan day only
      const proposals: Proposal[] = [];
      for (const p of plans) {
        const planned: PlannedRun[] = p.workouts.map((w) => ({
          workout_id: w.id,
          date: toISODate(workoutDate(p.start_date, w.week_number, w.day_number)),
          distance_km: w.distance_km === null ? null : Number(w.distance_km),
          isRest: w.type === "rest",
        }));
        const matches: Match[] = matchRuns(
          runs.filter((r) => !taken.has(r.id)),
          planned,
          new Set(p.loggedIds),
          today
        );
        for (const m of matches) {
          taken.add(m.run.id);
          const w = p.workouts.find((x) => x.id === m.workout_id)!;
          const date = planned.find((x) => x.workout_id === m.workout_id)!.date;
          proposals.push({ key: `${p.id}:${w.id}`, userPlanId: p.id, workout: w, date, run: byId.get(m.run.id)! });
        }
      }
      proposals.sort((a, b) => a.date.localeCompare(b.date));
      setSync({ fetched: runs.length, proposals, picked: new Set(proposals.map((x) => x.key)) });
    } catch {
      setNote("Could not reach the server.");
    }
    setBusy("");
  }

  function toggle(key: string) {
    setSync((s) => {
      if (!s) return s;
      const picked = new Set(s.picked);
      if (picked.has(key)) picked.delete(key);
      else picked.add(key);
      return { ...s, picked };
    });
  }

  async function importPicked() {
    if (!sync) return;
    const rows = sync.proposals
      .filter((p) => sync.picked.has(p.key))
      .map((p) => ({ userPlanId: p.userPlanId, workoutId: p.workout.id, distance_km: p.run.distance_km, time_seconds: p.run.time_seconds }));
    if (rows.length === 0) return;
    setBusy("import");
    const error = await onImport(rows);
    setBusy("");
    if (error) {
      setNote(error);
      return;
    }
    setSync(null);
    setNote(`Imported ${rows.length} run${rows.length === 1 ? "" : "s"} from Garmin. They show as done on your calendar.`);
  }

  if (!linked) return null;

  return (
    <div className="panel mt-6 rounded border line p-4">
      <h2 className="font-semibold">Garmin</h2>
      <p className="mb-3 text-sm muted">Connected with your personal Garmin key. Only your account can see this.</p>
      <div className="flex flex-wrap gap-2">
        <button className="btn" disabled={busy !== "" || !ready || plans.length === 0} onClick={findRuns}>
          {busy === "sync" ? "Looking…" : "Sync runs from Garmin"}
        </button>
        <button className="btn-ghost" disabled={busy !== ""} onClick={() => run("test")}>
          {busy === "test" ? "Testing…" : "Test connection"}
        </button>
        <button className="btn-ghost" disabled={busy !== ""} onClick={() => run("preview")}>
          {busy === "preview" ? "Looking…" : "Preview recent activities"}
        </button>
      </div>
      {ready && plans.length === 0 && <p className="mt-2 text-sm muted">Start a plan first, then sync your runs into it.</p>}

      {note && <p className="mt-3 text-sm">{note}</p>}

      {sync && (
        <div className="mt-4 text-sm">
          <p className="muted">
            Found {sync.fetched} run{sync.fetched === 1 ? "" : "s"} on Garmin. {sync.proposals.length} match{sync.proposals.length === 1 ? "es" : ""} a plan day that isn&apos;t logged yet.
          </p>
          {sync.proposals.length === 0 ? (
            <p className="mt-2">Nothing new to import. Runs only match a plan day on the same date, and days you&apos;ve already logged are left alone.</p>
          ) : (
            <>
              <ul className="mt-2 divide-y line rounded border line">
                {sync.proposals.map((p) => (
                  <li key={p.key} className="line">
                    <label className="flex cursor-pointer items-start gap-3 p-3">
                      <input type="checkbox" className="mt-1" checked={sync.picked.has(p.key)} onChange={() => toggle(p.key)} />
                      <span className="flex-1">
                        <span className="block font-medium">
                          {formatDate(new Date(p.date + "T00:00:00"))} · <span className="capitalize">{p.workout.type}</span>
                          {p.workout.distance_km ? ` ${p.workout.distance_km} km planned` : ""}
                        </span>
                        <span className="block muted">
                          Garmin: {p.run.distance_km.toFixed(2)} km in {formatDuration(p.run.time_seconds)} (
                          {formatPace(p.run.time_seconds / p.run.distance_km)} /km)
                          {p.run.name ? ` · ${p.run.name}` : ""}
                        </span>
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
              <button className="btn mt-3" disabled={busy !== "" || sync.picked.size === 0} onClick={importPicked}>
                {busy === "import" ? "Importing…" : `Import ${sync.picked.size} run${sync.picked.size === 1 ? "" : "s"}`}
              </button>
            </>
          )}
        </div>
      )}

      {result && (
        <div className="mt-3 text-sm">
          <p>{result.ok ? `✓ ${result.message}` : `✕ ${result.message}`}</p>
          {result.status ? <p className="muted">HTTP status: {result.status}</p> : null}
          {result.shape && <p className="muted">Reply format: {result.shape}{result.length ? ` (${result.length} characters)` : ""}</p>}
          {result.fields && result.fields.length > 0 && <p className="muted">Reply contained: {result.fields.join(", ")}</p>}
          {result.headers && result.headers.length > 0 && <p className="muted">Reply headers: {result.headers.join(", ")}</p>}
        </div>
      )}

      {preview && (
        <div className="mt-4 space-y-4 text-sm">
          {!preview.ok && <p>✕ {preview.message}</p>}
          {preview.attempts?.map((a) => (
            <div key={a.path}>
              <p className="font-medium">{a.ok ? "✓" : "✕"} {a.name} · HTTP {a.status}</p>
              {a.ok ? (
                <>
                  <p className="muted">{a.shape} · {a.count} item{a.count === 1 ? "" : "s"}</p>
                  {a.itemKeys && a.itemKeys.length > 0 && <p className="muted break-words">Fields: {a.itemKeys.join(", ")}</p>}
                  {a.sample && a.sample.length > 0 && (
                    <pre className="mt-2 overflow-x-auto rounded border line p-2 text-xs">{JSON.stringify(a.sample, null, 1)}</pre>
                  )}
                </>
              ) : (
                <p className="muted break-words">{a.error || "No details returned."}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
