"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import PaceChart from "@/components/PaceChart";
import StepEditor from "@/components/StepEditor";
import { DISTANCE_KM, Step, plausibleRacePace, trainingPaces } from "@/lib/pace";
import {
  Day, PRESETS, WorkoutType, buildSteps, defaultKm, generateWeeks, label, scaleSteps, sumKm, toRow,
} from "@/lib/workouts";

const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const GOALS = [
  { value: "5k", name: "5K" }, { value: "10k", name: "10K" }, { value: "half", name: "Half marathon" }, { value: "marathon", name: "Marathon" },
];
const BUILDS = [
  { value: 0, name: "Flat, same volume" }, { value: 0.2, name: "Gentle build (+20%)" }, { value: 0.35, name: "Steady build (+35%)" },
];

function parseTime(t: string) {
  const p = t.trim().split(":").map(Number);
  if (p.length < 2 || p.length > 3 || p.some((n) => !Number.isFinite(n) || n < 0)) return null;
  const [h, m, s] = p.length === 3 ? p : [0, p[0], p[1]];
  return h * 3600 + m * 60 + s;
}

const num = (v: string) => (Number.isFinite(parseFloat(v)) ? Math.max(0.1, Math.round(parseFloat(v) * 10) / 10) : null);

export default function PlanBuilder() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [goal, setGoal] = useState("10k");
  const [weeks, setWeeks] = useState(8);
  const [sessions, setSessions] = useState(4);
  const [level, setLevel] = useState("beginner");
  const [build, setBuild] = useState(0.2);
  const [race, setRace] = useState(true);
  const [isPublic, setIsPublic] = useState(false);
  const [previewTime, setPreviewTime] = useState("");

  const [plan, setPlan] = useState<Day[][] | null>(null);
  const [edited, setEdited] = useState(false);
  const [wk, setWk] = useState(0);
  const [open, setOpen] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const goalKm = DISTANCE_KM[goal];
  const previewSec = parseTime(previewTime);
  const paces = useMemo(
    () => (previewSec && plausibleRacePace(previewSec, goalKm) ? trainingPaces(previewSec, goalKm) : null),
    [previewSec, goalKm]
  );

  function generate() {
    if (plan && edited && !window.confirm("This replaces everything you've edited so far. Continue?")) return;
    const w = Math.min(52, Math.max(1, Math.round(weeks) || 1));
    const s = Math.min(7, Math.max(1, Math.round(sessions) || 1));
    setWeeks(w);
    setSessions(s);
    setPlan(generateWeeks({ weeks: w, sessions: s, goal, goalKm, build, race }));
    setEdited(false);
    setWk(0);
    setOpen(null);
  }

  function editDay(w: number, d: number, fn: (day: Day) => Day) {
    setPlan((p) => p && p.map((week, i) => (i !== w ? week : week.map((day, j) => (j === d ? fn(day) : day)))));
    setEdited(true);
  }

  function changeType(w: number, d: number, type: WorkoutType) {
    editDay(w, d, (day) => {
      const was = sumKm(day.steps);
      const km = type === "race" ? goalKm : was > 0 && day.type !== "race" ? was : defaultKm(type, goal, goalKm);
      return { type, steps: buildSteps(type, km), note: "" };
    });
  }

  const setSteps = (w: number, d: number, fn: (s: Step[]) => Step[]) => editDay(w, d, (day) => ({ ...day, steps: fn(day.steps) }));

  function copyWeek(to: "next" | "all") {
    if (!plan) return;
    // Weeks with a race in them are left alone, so copying never wipes out race day
    const hasRace = (week: Day[]) => week.some((d) => d.type === "race");
    setPlan(plan.map((week, i) => (i > wk && (to === "all" || i === wk + 1) && !hasRace(week) ? plan[wk].map((d) => ({ ...d, steps: d.steps.map((s) => ({ ...s })) })) : week)));
    setEdited(true);
  }

  async function save() {
    if (!plan) return;
    setError("");
    if (!title.trim()) return setError("Give the plan a title.");
    if (!plan.some((w) => w.some((d) => d.type !== "rest"))) return setError("The plan has no runs in it.");
    setSaving(true);
    const { data: auth } = await supabase.auth.getSession();
    const uid = auth.session?.user.id;
    if (!uid) return setError("You are signed out. Sign in again.");

    const { data: created, error: e1 } = await supabase
      .from("plans")
      .insert({
        title: title.trim(),
        description: description.trim() || null,
        goal_distance: goal,
        weeks: plan.length,
        level,
        source: "coach",
        created_by: uid,
        visibility: isPublic ? "public" : "private",
      })
      .select("id")
      .single();
    if (e1 || !created) {
      setSaving(false);
      return setError(e1?.message ?? "Could not save the plan.");
    }

    const rows = plan.flatMap((week, wi) => week.map((d, di) => toRow(created.id, wi + 1, di, d)));
    for (let i = 0; i < rows.length; i += 200) {
      const { error: e2 } = await supabase.from("plan_workouts").insert(rows.slice(i, i + 200));
      if (e2) {
        await supabase.from("plans").delete().eq("id", created.id); // don't leave a half-saved plan
        setSaving(false);
        return setError(e2.message);
      }
    }
    router.push(`/plans/${created.id}`);
  }

  const weekKm = (week: Day[]) => Math.round(week.reduce((s, d) => s + sumKm(d.steps), 0) * 10) / 10;

  return (
    <div>
      <h1 className="mb-1 text-2xl font-bold">Build a plan</h1>
      <p className="mb-5 text-sm muted">Set the shape, then tweak any week, day or step. Paces follow each runner&apos;s goal time.</p>

      <section className="panel rounded border line p-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm sm:col-span-2">
            Title
            <input className="field mt-1 w-full" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. 12-week 10K, sub-45" />
          </label>
          <label className="block text-sm sm:col-span-2">
            Description (optional)
            <textarea className="field mt-1 w-full" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
          </label>
          <label className="block text-sm">
            Goal distance
            <select className="field mt-1 w-full" value={goal} onChange={(e) => setGoal(e.target.value)}>
              {GOALS.map((g) => <option key={g.value} value={g.value}>{g.name}</option>)}
            </select>
          </label>
          <label className="block text-sm">
            Level
            <select className="field mt-1 w-full" value={level} onChange={(e) => setLevel(e.target.value)}>
              <option value="beginner">Beginner</option><option value="intermediate">Intermediate</option><option value="advanced">Advanced</option>
            </select>
          </label>
          <label className="block text-sm">
            Weeks (1–52)
            <input className="field mt-1 w-full" type="number" min={1} max={52} value={weeks} onChange={(e) => setWeeks(Number(e.target.value))} />
          </label>
          <label className="block text-sm">
            Sessions per week (1–7)
            <input className="field mt-1 w-full" type="number" min={1} max={7} value={sessions} onChange={(e) => setSessions(Number(e.target.value))} />
          </label>
          <label className="block text-sm">
            Volume
            <select className="field mt-1 w-full" value={build} onChange={(e) => setBuild(Number(e.target.value))}>
              {BUILDS.map((b) => <option key={b.value} value={b.value}>{b.name}</option>)}
            </select>
          </label>
          <label className="flex items-center gap-2 self-end pb-2 text-sm">
            <input type="checkbox" checked={race} onChange={(e) => setRace(e.target.checked)} />
            Finish with a race day and lighter last week
          </label>
        </div>
        <button className="btn mt-4" onClick={generate}>{plan ? "Regenerate weeks" : "Generate weeks"}</button>
      </section>

      {plan && (
        <>
          <section className="mt-6">
            <div className="mb-3 flex flex-wrap gap-1.5" role="tablist" aria-label="Weeks">
              {plan.map((_, i) => (
                <button key={i} role="tab" aria-selected={i === wk} className={`btn-ghost min-w-9 ${i === wk ? "seg-on" : ""}`} onClick={() => { setWk(i); setOpen(null); }}>
                  {i + 1}
                </button>
              ))}
            </div>

            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-semibold">Week {wk + 1} <span className="font-normal muted">· {weekKm(plan[wk])} km</span></h2>
              <div className="flex gap-2">
                {wk < plan.length - 1 && <button className="btn-ghost" onClick={() => copyWeek("next")}>Copy to next week</button>}
                {wk < plan.length - 2 && <button className="btn-ghost" onClick={() => copyWeek("all")}>Copy to all later weeks</button>}
              </div>
            </div>

            <label className="mb-3 block text-sm">
              <span className="muted">Preview paces for a goal time (optional, not saved)</span>
              <input className="field mt-1 w-40" placeholder="h:mm:ss" value={previewTime} onChange={(e) => setPreviewTime(e.target.value)} aria-label="Preview goal time" />
              {previewTime && !paces && <span className="ml-2 text-xs muted">Enter a realistic time like 45:00</span>}
            </label>

            <ul className="rounded border line">
              {plan[wk].map((d, di) => {
                const key = `${wk}-${di}`;
                const isOpen = open === key;
                const km = sumKm(d.steps);
                return (
                  <li key={key} className="border-b line p-3 last:border-b-0">
                    <div className="flex items-center gap-2">
                      <span className="w-10 shrink-0 text-sm muted">{DAY_NAMES[di]}</span>
                      <select className="field min-w-0 flex-1 py-1" value={d.type} aria-label={`${DAY_NAMES[di]} workout`} onChange={(e) => changeType(wk, di, e.target.value as WorkoutType)}>
                        {PRESETS.map((p) => <option key={p.type} value={p.type}>{p.label}</option>)}
                      </select>
                      {d.type !== "rest" && (
                        <>
                          <input
                            key={`${key}-${km}`}
                            className="field w-20 py-1"
                            type="number" step={0.5} min={0.5}
                            defaultValue={km}
                            disabled={d.type === "race" || d.steps.some((s) => s.reps || s.time_sec)}
                            title={d.steps.some((s) => s.reps || s.time_sec) ? "Worked out from the steps below" : undefined}
                            aria-label={`${DAY_NAMES[di]} distance km`}
                            onBlur={(e) => { const v = num(e.target.value); if (v && v !== km) setSteps(wk, di, (s) => scaleSteps(s, v)); }}
                            onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
                          />
                          <span className="text-sm muted">km</span>
                          <button type="button" aria-expanded={isOpen} aria-label={`${DAY_NAMES[di]} details`} className="ml-auto p-1" onClick={() => setOpen(isOpen ? null : key)}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`transition-transform ${isOpen ? "rotate-180" : ""}`} aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
                          </button>
                        </>
                      )}
                    </div>

                    {isOpen && d.type !== "rest" && (
                      <div className="mt-3 space-y-3">
                        <PaceChart steps={d.steps} paces={paces} />
                        <StepEditor
                          steps={d.steps}
                          paces={paces}
                          onChange={(next) => setSteps(wk, di, () => next)}
                          onReset={() => editDay(wk, di, (day) => ({ ...day, steps: buildSteps(day.type, km) }))}
                        />
                        <input className="field w-full py-1" placeholder={`Note for runner (default: ${label(d.type)} description)`} defaultValue={d.note} aria-label="Note for runner"
                          onBlur={(e) => editDay(wk, di, (day) => ({ ...day, note: e.target.value }))} />
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>

          <section className="panel mt-6 rounded border line p-4">
            <label className="mb-3 flex items-start gap-2 text-sm">
              <input type="checkbox" className="mt-1" checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} />
              <span>Show on the public Plans page<span className="block muted">Leave off to keep it private and assign it to your own runners.</span></span>
            </label>
            {error && <p className="mb-3 text-sm" role="alert">✕ {error}</p>}
            <button className="btn" disabled={saving} onClick={save}>{saving ? "Saving…" : `Save plan (${plan.length} weeks)`}</button>
            <p className="mt-2 text-xs muted">Saved plans can&apos;t be edited once runners have started them, so check the weeks first.</p>
          </section>
        </>
      )}
    </div>
  );
}
