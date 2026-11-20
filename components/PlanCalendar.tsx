"use client";
import { useMemo, useState } from "react";
import WorkoutDetail from "@/components/WorkoutDetail";
import { Paces, Workout, formatDate, toISODate, workoutDate } from "@/lib/pace";

export type LogStatus = "done" | "skipped";
type Status = LogStatus | "missed" | "today" | "upcoming" | "rest";

type Props = {
  startDate: string;
  workouts: Workout[];
  paces: Paces | null;
  logs: Record<string, LogStatus>; // workout id -> status
  onMark: (workoutId: string, status: LogStatus | null) => Promise<string | null>; // returns an error message, or null
};

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const GLYPH: Partial<Record<Status, string>> = { done: "✓", missed: "✕", skipped: "–" };
const CELL_CLASS: Partial<Record<Status, string>> = { done: "cal-done", missed: "cal-missed", skipped: "cal-skipped" };

const monthOf = (iso: string) => new Date(iso.slice(0, 7) + "-01T00:00:00");

export default function PlanCalendar({ startDate, workouts, paces, logs, onMark }: Props) {
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

  const [selected, setSelected] = useState(() =>
    byDate.has(todayISO) ? todayISO : todayISO < firstISO ? firstISO : lastISO
  );
  const [month, setMonth] = useState(() => monthOf(selected));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  function statusOf(w: Workout, iso: string): Status {
    if (w.type === "rest") return "rest";
    const logged = logs[w.id];
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

  // Month grid, weeks start on Monday
  const y = month.getFullYear();
  const mo = month.getMonth();
  const offset = (new Date(y, mo, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(y, mo + 1, 0).getDate();
  // Full Monday-to-Sunday rows (including days of the neighbouring months),
  // keeping only the weeks that contain days of the plan
  const weekRows: string[][] = [];
  for (let wk = 0; wk < Math.ceil((offset + daysInMonth) / 7); wk++) {
    weekRows.push(Array.from({ length: 7 }, (_, d) => toISODate(new Date(y, mo, 1 - offset + wk * 7 + d))));
  }
  const visibleDays = weekRows.filter((row) => row.some((iso) => byDate.has(iso))).flat();

  const canPrev = month > monthOf(firstISO);
  const canNext = month < monthOf(lastISO);
  const shiftMonth = (by: number) => setMonth(new Date(y, mo + by, 1));

  const selW = byDate.get(selected);
  const selStatus = selW ? statusOf(selW, selected) : null;

  async function mark(status: LogStatus | null) {
    if (!selW) return;
    setBusy(true);
    setError("");
    const err = await onMark(selW.id, status);
    if (err) setError(err);
    setBusy(false);
  }

  return (
    <div>
      <p className="mb-3 text-sm muted">
        {counts.done} done · {counts.missed} missed · {counts.skipped} skipped · {counts.upcoming} to go
      </p>

      <div className="mb-2 flex items-center justify-between">
        <button className="btn-ghost" aria-label="Previous month" disabled={!canPrev} onClick={() => shiftMonth(-1)}>
          ‹
        </button>
        <div className="flex items-center gap-3">
          <h3 className="font-semibold">{month.toLocaleDateString("en-ZA", { month: "long", year: "numeric" })}</h3>
          {byDate.has(todayISO) && (
            <button
              className="text-sm underline"
              onClick={() => {
                setSelected(todayISO);
                setMonth(monthOf(todayISO));
              }}
            >
              Today
            </button>
          )}
        </div>
        <button className="btn-ghost" aria-label="Next month" disabled={!canNext} onClick={() => shiftMonth(1)}>
          ›
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1">
        {WEEKDAYS.map((d) => (
          <div key={d} className="pb-1 text-center text-xs muted">
            {d}
          </div>
        ))}
        {visibleDays.map((iso) => {
          const date = new Date(iso + "T00:00:00");
          // The 1st of a month also shows the month, e.g. "1 Dec"
          const day = date.getDate() === 1 ? `1 ${date.toLocaleDateString("en-ZA", { month: "short" })}` : date.getDate();
          const w = byDate.get(iso);
          if (!w) {
            return (
              <div key={iso} className="cal-cell cal-out">
                <span className="text-xs">{day}</span>
              </div>
            );
          }
          const st = statusOf(w, iso);
          const isRest = st === "rest";
          return (
            <button
              key={iso}
              type="button"
              onClick={() => setSelected(iso)}
              aria-pressed={iso === selected}
              aria-label={`${formatDate(new Date(iso + "T00:00:00"))}: ${isRest ? "rest day" : `${w.type} ${w.distance_km ?? ""} km`}, ${st}`}
              className={`cal-cell ${CELL_CLASS[st] ?? ""} ${iso === selected ? "cal-selected" : ""}`}
            >
              <span className="flex items-start justify-between">
                <span className={`text-xs ${iso === todayISO ? "cal-today" : ""}`}>{day}</span>
                <span className="text-xs leading-none">{GLYPH[st]}</span>
              </span>
              {isRest ? (
                <span className="opacity-60">Rest</span>
              ) : (
                <>
                  <span className="font-medium capitalize">{w.type}</span>
                  <span className="opacity-70">{w.distance_km ? `${w.distance_km} km` : ""}</span>
                </>
              )}
            </button>
          );
        })}
      </div>

      <p className="mt-2 text-xs muted">✓ Done · ✕ Missed (dashed) · – Skipped · circled number = today</p>

      {selW && selStatus && (
        <div className="panel mt-4 rounded border line p-4">
          <div className="mb-1 flex items-baseline justify-between gap-3">
            <h3 className="font-semibold">{formatDate(new Date(selected + "T00:00:00"), true)}</h3>
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
            <p className="text-sm muted">Rest day. Recovery is part of the plan.</p>
          ) : (
            <>
              <p className="mb-4 text-sm muted">
                <span className="capitalize">{selW.type}</span> · {selW.distance_km} km
                {selW.description ? ` · ${selW.description}` : ""}
              </p>
              <WorkoutDetail w={selW} paces={paces} />
              <div className="mt-4 flex flex-wrap items-center gap-2">
                {logs[selW.id] ? (
                  <button className="btn-ghost" disabled={busy} onClick={() => mark(null)}>
                    Undo
                  </button>
                ) : selected > todayISO ? (
                  <p className="text-sm muted">You can log this run on the day.</p>
                ) : (
                  <>
                    <button className="btn" disabled={busy} onClick={() => mark("done")}>
                      Mark done
                    </button>
                    <button className="btn-ghost" disabled={busy} onClick={() => mark("skipped")}>
                      Skip
                    </button>
                  </>
                )}
              </div>
              {error && <p className="mt-2 text-sm">{error}</p>}
            </>
          )}
        </div>
      )}
    </div>
  );
}
