"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import Guard from "@/components/Guard";
import BarChart from "@/components/BarChart";
import { HistoryRun, loadHistoryRuns } from "@/lib/activities";
import { PB_DISTANCES, avgPace, inMonth, inYear, monthlyKm, personalBests, records, runsPerWeek, totalsOf, yearlyKm } from "@/lib/history";
import { formatDate, formatDuration, formatPace, toISODate } from "@/lib/pace";

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const num = (n: number, dp = 0) => n.toLocaleString("en-GB", { minimumFractionDigits: dp, maximumFractionDigits: dp });
const hm = (sec: number) => `${Math.floor(sec / 3600)}h ${String(Math.floor((sec % 3600) / 60)).padStart(2, "0")}m`;
const dateText = (iso: string) => formatDate(new Date(iso + "T00:00:00"), true);

function Stat({ label, value, sub }: { label: string; value: string; sub?: string[] }) {
  return (
    <div className="rounded border line p-3 text-center">
      <p className="text-xs uppercase tracking-wide muted">{label}</p>
      <p className="my-1 text-xl font-bold">{value}</p>
      {sub?.map((s) => (
        <p key={s} className="text-xs muted">{s}</p>
      ))}
    </div>
  );
}

// Your running in numbers: all-time, yearly and monthly totals, and the trophy cabinet.
export default function History() {
  const [runs, setRuns] = useState<HistoryRun[] | null>(null);
  const today = toISODate(new Date());
  const thisYear = Number(today.slice(0, 4));
  const thisMonth = Number(today.slice(5, 7));
  const [year, setYear] = useState(thisYear);

  useEffect(() => {
    loadHistoryRuns().then(setRuns);
  }, []);

  const view = useMemo(() => {
    if (!runs || runs.length === 0) return null;
    const all = totalsOf(runs);
    const ytd = totalsOf(inYear(runs, thisYear));
    const mtd = totalsOf(inMonth(runs, thisYear, thisMonth));
    const years = yearlyKm(runs, thisYear);
    return {
      all, ytd, mtd, years,
      first: runs[0].activity_date,
      perWeek: runsPerWeek(runs, today),
      pbs: personalBests(runs),
      rec: records(runs, thisYear),
    };
  }, [runs, thisYear, thisMonth, today]);

  const pace = (t: { km: number; seconds: number }) => (avgPace({ ...t, runs: 0 }) ? `${formatPace(t.seconds / t.km)} /km avg` : "–");

  return (
    <Guard>
      <h1 className="mb-1 text-2xl font-bold">History</h1>
      <p className="mb-5 text-sm muted">Your running in numbers, from the runs you&apos;ve synced.</p>

      {runs === null && <p className="muted">Loading…</p>}
      {runs && !view && (
        <p className="muted">
          No runs saved yet. Link a watch on your <Link href="/profile" className="underline">Profile</Link> and sync to see your totals and personal bests.
        </p>
      )}

      {view && (
        <div className="space-y-6">
          <section aria-label="Totals" className="grid grid-cols-2 gap-3">
            <Stat label="Total distance" value={`${num(view.all.km)} km`} sub={[`since ${new Date(view.first + "T00:00:00").toLocaleDateString("en-ZA", { month: "short", year: "numeric" })}`]} />
            <Stat label="Total runs" value={num(view.all.runs)} sub={[`avg ${num(view.perWeek, 1)} per week`]} />
            <Stat label={`${thisYear} to date`} value={`${num(view.ytd.km, 1)} km`} sub={[`${num(view.ytd.runs)} runs · ${pace(view.ytd)}`, `${hm(view.ytd.seconds)} total`]} />
            <Stat label={MONTH_NAMES[thisMonth - 1]} value={`${num(view.mtd.km, 1)} km`} sub={[`${num(view.mtd.runs)} runs · ${pace(view.mtd)}`, `${hm(view.mtd.seconds)} total`]} />
            <div className="col-span-2">
              <Stat label="Average pace" value={view.all.km > 0 ? `${formatPace(view.all.seconds / view.all.km)} /km` : "–"} sub={["across all runs"]} />
            </div>
          </section>

          <section className="panel rounded border line p-4">
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide muted">Yearly distance (km)</h2>
            <BarChart
              title="Yearly distance"
              data={view.years.map((y) => ({ label: String(y.year), value: y.km }))}
              selected={view.years.findIndex((y) => y.year === year)}
              onSelect={(i) => setYear(view.years[i].year)}
            />
            <div className="mt-3 flex flex-wrap gap-1.5">
              {view.years.map((y) => (
                <button key={y.year} className={`btn-ghost ${y.year === year ? "seg-on" : ""}`} aria-pressed={y.year === year} onClick={() => setYear(y.year)}>
                  {y.year}
                </button>
              ))}
            </div>
          </section>

          <section className="panel rounded border line p-4">
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide muted">Monthly distance, {year} (km)</h2>
            <BarChart
              title={`Monthly distance ${year}`}
              data={monthlyKm(runs!, year).map((km, i) => ({ label: MONTHS[i], value: km }))}
              selected={year === thisYear ? thisMonth - 1 : undefined}
            />
            <p className="mt-2 text-sm muted">
              {(() => {
                const t = totalsOf(inYear(runs!, year));
                return `${num(t.km, 1)} km in ${num(t.runs)} runs · ${t.km > 0 ? `${formatPace(t.seconds / t.km)} /km avg · ` : ""}${hm(t.seconds)}`;
              })()}
            </p>
          </section>

          <section aria-label="Trophy cabinet">
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide muted">Trophy cabinet</h2>
            <p className="mb-3 text-sm muted">Personal bests, taken from the fastest split inside any of your runs.</p>
            <div className="grid grid-cols-2 gap-3">
              {PB_DISTANCES.map((d) => {
                const pb = view.pbs.find((p) => p.key === d.key);
                return (
                  <div key={d.key} className="rounded border line p-3">
                    <p className="text-xs uppercase tracking-wide muted">{d.label}</p>
                    {pb ? (
                      <>
                        <p className="my-1 text-xl font-bold">{formatDuration(pb.seconds)}</p>
                        <p className="text-xs muted">{dateText(pb.date)}</p>
                        {pb.name && <p className="truncate text-xs muted">{pb.name}</p>}
                      </>
                    ) : (
                      <p className="my-1 text-xl font-bold muted">–</p>
                    )}
                  </div>
                );
              })}
              {view.rec.longest && (
                <div className="rounded border line p-3">
                  <p className="text-xs uppercase tracking-wide muted">Longest run</p>
                  <p className="my-1 text-xl font-bold">{num(view.rec.longest.distance_km, 1)} km</p>
                  <p className="text-xs muted">{dateText(view.rec.longest.activity_date)}</p>
                  {view.rec.longest.name && <p className="truncate text-xs muted">{view.rec.longest.name}</p>}
                </div>
              )}
              {view.rec.bestMonth && (
                <div className="rounded border line p-3">
                  <p className="text-xs uppercase tracking-wide muted">Biggest month</p>
                  <p className="my-1 text-xl font-bold">{num(view.rec.bestMonth.km, 1)} km</p>
                  <p className="text-xs muted">{MONTH_NAMES[view.rec.bestMonth.month]} {view.rec.bestMonth.year}</p>
                </div>
              )}
              {view.rec.bestYear && (
                <div className="rounded border line p-3">
                  <p className="text-xs uppercase tracking-wide muted">Biggest year</p>
                  <p className="my-1 text-xl font-bold">{num(view.rec.bestYear.km)} km</p>
                  <p className="text-xs muted">{view.rec.bestYear.year}</p>
                </div>
              )}
            </div>
            {view.pbs.length === 0 && (
              <p className="mt-3 text-sm muted">Personal bests appear after a sync that includes split times. Run a sync from your Profile to fill them in.</p>
            )}
          </section>
        </div>
      )}
    </Guard>
  );
}
