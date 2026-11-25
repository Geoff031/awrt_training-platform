"use client";
import { useMemo, useState } from "react";
import WorkoutDetail from "@/components/WorkoutDetail";
import { Paces, Workout, formatDate, formatDuration, formatPace, toISODate, workoutDate } from "@/lib/pace";

export type LogStatus = "done" | "skipped";
export type LogEntry = { status: LogStatus; distance_km: number | null; time_seconds: number | null; source: string };
export type LogInput = { status: LogStatus; distance_km: number | null; time_seconds: number | null };
type Status = LogStatus | "missed" | "today" | "upcoming" | "rest";

type Props = {
  startDate: string;
  workouts: Workout[];
  paces: Paces | null;
  goalSeconds: number | null;
  logs: Record<string, LogEntry>; // workout id -> log
  onLog: (workoutId: string, entry: LogInput | null) => Promise<string | null>; // returns an error message, or null
  extra?: (w: Workout) => React.ReactNode; // optional content under the selected day (e.g. comments)
};

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const GLYPH: Partial<Record<Status, string>> = { done: "✓", missed: "✕", skipped: "–" };
const CELL_CLASS: Partial<Record<Status, string>> = { done: "cal-done", missed: "cal-missed", skipped: "cal-skipped" };

const monthStart = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);
const fromISO = (iso: string) => new Date(iso + "T00:00:00");

// Distance, optional time, then Mark done or Skip
function LogForm({
  planned,
  isRace,
  busy,
  onSubmit,
}: {
  planned: number | null;
  isRace: boolean;
  busy: boolean;
  onSubmit: (input: LogInput) => void;
}) {
  const [dist, setDist] = useState(planned ? String(planned) : "");
  const [h, setH] = useState("");
  const [m, setM] = useState("");
  const [s, setS] = useState("");
  const [err, setErr] = useState("");

  function submit(status: LogStatus) {
    setErr("");
    if (status === "skipped") return onSubmit({ status, distance_km: null, time_seconds: null });
    const d = dist.trim() === "" ? null : Number(dist);
    if (d !== null && !(d > 0 && d <= 100)) return setErr("Enter the distance in km, for example 5.2.");
    const secs = (Number(h) || 0) * 3600 + (Number(m) || 0) * 60 + (Number(s) || 0);
    if ((h || m || s) && secs <= 0) return setErr("Enter a valid time.");
    onSubmit({
      status,
      distance_km: d === null ? null : Math.round(d * 10) / 10,
      time_seconds: secs > 0 ? secs : null,
    });
  }

  const digits = (v: string) => v.replace(/\D/g, "");
  return (
    <div>
      <p className="mb-2 text-sm font-medium">{isRace ? "Log your race" : "Log this run"}</p>
      <div className="flex flex-wrap items-end gap-x-5 gap-y-3">
        <label className="text-sm">
          <span className="mb-1 block muted">Distance (km)</span>
          <input
            inputMode="decimal"
            className="field w-24 text-center"
            value={dist}
            onChange={(e) => setDist(e.target.value.replace(/[^0-9.]/g, ""))}
          />
        </label>
        <div className="text-sm">
          <span className="mb-1 block muted">{isRace ? "Finish time" : "Time (optional)"}</span>
          <div className="flex items-center gap-1.5">
            <input aria-label="Hours" inputMode="numeric" placeholder="h" className="field w-14 text-center" value={h} onChange={(e) => setH(digits(e.target.value))} />
            <span className="muted">:</span>
            <input aria-label="Minutes" inputMode="numeric" placeholder="mm" className="field w-14 text-center" value={m} onChange={(e) => setM(digits(e.target.value))} />
            <span className="muted">:</span>
            <input aria-label="Seconds" inputMode="numeric" placeholder="ss" className="field w-14 text-center" value={s} onChange={(e) => setS(digits(e.target.value))} />
          </div>
        </div>
      </div>
      <div className="mt-3 flex gap-2">
        <button className="btn" disabled={busy} onClick={() => submit("done")}>
          Mark done
        </button>
        <button className="btn-ghost" disabled={busy} onClick={() => submit("skipped")}>
          Skip
        </button>
      </div>
      {err && <p className="mt-2 text-sm">{err}</p>}
    </div>
  );
}

export default function PlanCalendar({ startDate, workouts, paces, goalSeconds, logs, onLog, extra }: Props) {
  const todayISO = toISODate(new Date());

  // Every day of the plan, including rest days: date -> workout
  const byDate = useMemo(() => {
    const m = new Map<string, Workout>();
    for (const w of workouts) m.set(toISODate(workoutDate(startDate, w.week_number, w.day_number)), w);
    return m;
  }, [workouts, startDate]);

  const dates = useMemo(() => Array.from(byDate.keys()).sort(), [byDate]);
  const firstISO = dates[0];
  const lastISO = dates[dates.length - 1];

  // Rolling calendar: opens on the current month, and you can go to any month
  const [month, setMonth] = useState(() => monthStart(new Date()));
  const [selected, setSelected] = useState<string | null>(() => (byDate.has(todayISO) ? todayISO : null));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  function statusOf(w: Workout, iso: string): Status {
    if (w.type === "rest") return "rest";
    const logged = logs[w.id]?.status;
    if (logged) return logged;
    if (iso < todayISO) return "missed";
    return iso === todayISO ? "today" : "upcoming";
  }

  // Totals above the calendar
  const counts = { done: 0, skipped: 0, missed: 0, upcoming: 0 };
  byDate.forEach((w, iso) => {
    const st = statusOf(w, iso);
    if (st === "done") counts.done++;
    else if (st === "skipped") counts.skipped++;
    else if (st === "missed") counts.missed++;
    else if (st !== "rest") counts.upcoming++;
  });

  // Month grid: full Monday-to-Sunday rows, with the plan week number on the left
  const y = month.getFullYear();
  const mo = month.getMonth();
  const offset = (new Date(y, mo, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(y, mo + 1, 0).getDate();
  const rows = Array.from({ length: Math.ceil((offset + daysInMonth) / 7) }, (_, r) =>
    Array.from({ length: 7 }, (_, d) => toISODate(new Date(y, mo, 1 - offset + r * 7 + d)))
  );
  const shiftMonth = (by: number) => setMonth(new Date(y, mo + by, 1));

  const selW = selected ? byDate.get(selected) : undefined;
  const selStatus = selW && selected ? statusOf(selW, selected) : null;
  const entry = selW ? logs[selW.id] : undefined;

  function goToPlan() {
    const target = todayISO < firstISO ? firstISO : lastISO;
    setMonth(monthStart(fromISO(target)));
    setSelected(target);
  }

  async function submit(input: LogInput | null) {
    if (!selW) return;
    setBusy(true);
    setError("");
    const err = await onLog(selW.id, input);
    if (err) setError(err);
    setBusy(false);
  }

  return (
    <div>
      <p className="mb-3 text-sm muted">
        {counts.done} done · {counts.missed} missed · {counts.skipped} skipped · {counts.upcoming} to go
      </p>

      <div className="mb-2 flex items-center justify-between">
        <button className="btn-ghost" aria-label="Previous month" onClick={() => shiftMonth(-1)}>
          ‹
        </button>
        <div className="flex items-center gap-3">
          <h3 className="font-semibold">{month.toLocaleDateString("en-ZA", { month: "long", year: "numeric" })}</h3>
          <button
            className="text-sm underline"
            onClick={() => {
              setMonth(monthStart(new Date()));
              if (byDate.has(todayISO)) setSelected(todayISO);
            }}
          >
            Today
          </button>
        </div>
        <button className="btn-ghost" aria-label="Next month" onClick={() => shiftMonth(1)}>
          ›
        </button>
      </div>

      <div className="grid grid-cols-[1.75rem_repeat(7,minmax(0,1fr))] gap-1">
        <div className="pb-1 text-center text-xs muted">Wk</div>
        {WEEKDAYS.map((d) => (
          <div key={d} className="pb-1 text-center text-xs muted">
            {d}
          </div>
        ))}
        {rows.map((row) => {
          const planWeek = row.map((iso) => byDate.get(iso)).find(Boolean)?.week_number ?? null;
          return [
            <div
              key={row[0] + "-wk"}
              className={`flex items-center justify-center text-[11px] ${planWeek ? "cal-weeklabel font-semibold" : ""}`}
            >
              {planWeek ? `W${planWeek}` : ""}
            </div>,
            ...row.map((iso) => {
              const date = fromISO(iso);
              const inMonth = date.getMonth() === mo;
              // The 1st of a month also shows the month, e.g. "1 Dec"
              const day = date.getDate() === 1 ? `1 ${date.toLocaleDateString("en-ZA", { month: "short" })}` : date.getDate();
              const w = byDate.get(iso);
              const isToday = iso === todayISO;
              if (!w) {
                return (
                  <div key={iso} className={`cal-cell cal-out ${inMonth ? "" : "cal-other-month"}`}>
                    <span className={`whitespace-nowrap text-xs ${isToday ? "cal-today" : ""}`}>{day}</span>
                  </div>
                );
              }
              const st = statusOf(w, iso);
              const isRest = st === "rest";
              const isRace = w.type === "race";
              const glyph = GLYPH[st] ?? (isRace ? "★" : "");
              return (
                <button
                  key={iso}
                  type="button"
                  onClick={() => setSelected(iso)}
                  aria-pressed={iso === selected}
                  aria-label={`${formatDate(date)}: ${isRest ? "rest day" : `${isRace ? "race day" : w.type} ${w.distance_km ?? ""} km`}, ${st}`}
                  className={`cal-cell cal-plan ${CELL_CLASS[st] ?? ""} ${iso === selected ? "cal-selected" : ""}`}
                >
                  <span className="flex items-start justify-between">
                    <span className={`whitespace-nowrap text-xs ${isToday ? "cal-today" : ""}`}>{day}</span>
                    <span className="text-xs leading-none">{glyph}</span>
                  </span>
                  {isRest ? (
                    <span className="opacity-60">Rest</span>
                  ) : (
                    <>
                      <span className={isRace ? "font-bold" : "font-medium capitalize"}>{isRace ? "Race day" : w.type}</span>
                      <span className="opacity-70">{w.distance_km ? `${w.distance_km} km` : ""}</span>
                    </>
                  )}
                </button>
              );
            }),
          ];
        })}
      </div>

      <p className="mt-2 text-xs muted">Shaded = your plan · ✓ Done · ✕ Missed (dashed) · – Skipped · ★ Race day · circled = today</p>

      {!selW && (
        <p className="mt-4 text-sm muted">
          {todayISO < firstISO
            ? `Your plan starts ${formatDate(fromISO(firstISO), true)}. `
            : todayISO > lastISO
              ? `Your plan finished ${formatDate(fromISO(lastISO), true)}. `
              : "Select a day to see the workout. "}
          {(todayISO < firstISO || todayISO > lastISO) && (
            <button className="underline" onClick={goToPlan}>
              Go to plan
            </button>
          )}
        </p>
      )}

      {selW && selected && selStatus && (
        <div className="panel mt-4 rounded border line p-4">
          <div className="mb-1 flex items-baseline justify-between gap-3">
            <h3 className="font-semibold">{formatDate(fromISO(selected), true)}</h3>
            <span className="text-sm muted">
              Week {selW.week_number} ·{" "}
              {selStatus === "done"
                ? "Done"
                : selStatus === "skipped"
                  ? "Skipped"
                  : selStatus === "missed"
                    ? "Missed"
                    : selStatus === "today"
                      ? "Today"
                      : selStatus === "rest"
                        ? "Rest day"
                        : "Upcoming"}
            </span>
          </div>

          {selStatus === "rest" ? (
            <p className="text-sm muted">{selW.description || "Rest day. Recovery is part of the plan."}</p>
          ) : (
            <>
              <p className="mb-4 text-sm muted">
                <span className={selW.type === "race" ? "" : "capitalize"}>{selW.type === "race" ? "Race day" : selW.type}</span> · {selW.distance_km} km
                {selW.description ? ` · ${selW.description}` : ""}
              </p>
              <WorkoutDetail w={selW} paces={paces} />

              <div className="mt-4 border-t line pt-4">
                {entry ? (
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="text-sm">
                      {entry.status === "skipped" ? (
                        <p>Skipped</p>
                      ) : (
                        <>
                          <p>
                            Logged {entry.distance_km ?? selW.distance_km} km
                            {entry.time_seconds ? ` in ${formatDuration(entry.time_seconds)}` : ""}
                            {entry.time_seconds && (entry.distance_km ?? selW.distance_km)
                              ? ` · ${formatPace(entry.time_seconds / Number(entry.distance_km ?? selW.distance_km))} /km`
                              : ""}
                            {entry.source !== "manual" ? ` · via ${entry.source}` : ""}
                          </p>
                          {selW.type === "race" && entry.time_seconds && goalSeconds ? (
                            <p className="muted">
                              {entry.time_seconds <= goalSeconds
                                ? `${formatDuration(goalSeconds - entry.time_seconds)} faster than your ${formatDuration(goalSeconds)} goal`
                                : `${formatDuration(entry.time_seconds - goalSeconds)} slower than your ${formatDuration(goalSeconds)} goal`}
                            </p>
                          ) : null}
                        </>
                      )}
                    </div>
                    <button className="btn-ghost" disabled={busy} onClick={() => submit(null)}>
                      Undo
                    </button>
                  </div>
                ) : selected > todayISO ? (
                  <p className="text-sm muted">You can log this run on the day.</p>
                ) : (
                  <LogForm key={selected} planned={selW.distance_km} isRace={selW.type === "race"} busy={busy} onSubmit={submit} />
                )}
                {error && <p className="mt-2 text-sm">{error}</p>}
              </div>
            </>
          )}
          {extra && <div className="mt-4 border-t line pt-3">{extra(selW)}</div>}
        </div>
      )}
    </div>
  );
}
