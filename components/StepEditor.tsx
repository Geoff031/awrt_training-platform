"use client";
import { useState } from "react";
import { Paces, Rest, RestKind, Step, Zone, formatPace, stepKm, stepPaceSec, stepPaceText } from "@/lib/pace";
import { ZONE_NAME } from "@/lib/workouts";

// Coach editor for the steps of one workout: name, reps, distance or time, pace, and rest between reps.

// "3:00" or "90" -> seconds
function parseClock(t: string) {
  const p = t.trim().split(":").map(Number);
  if (p.length > 2 || p.some((n) => !Number.isFinite(n) || n < 0)) return null;
  const sec = p.length === 2 ? p[0] * 60 + p[1] : p[0];
  return sec > 0 ? Math.round(sec) : null;
}
// A pace must be written m:ss, e.g. 4:30
function parsePace(t: string) {
  const m = t.trim().match(/^(\d{1,2}):([0-5]\d)$/);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}
const blur = (e: React.KeyboardEvent) => e.key === "Enter" && (e.target as HTMLInputElement).blur();

function Clock({ value, onCommit, label, parse = parseClock }: { value: number; onCommit: (s: number) => void; label: string; parse?: (t: string) => number | null }) {
  return (
    <input
      key={value}
      className="field w-20 py-1"
      defaultValue={formatPace(value)}
      placeholder="m:ss"
      aria-label={label}
      onBlur={(e) => { const v = parse(e.target.value); if (v) onCommit(v); }}
      onKeyDown={blur}
    />
  );
}

// Distance entered in metres or kilometres, stored in km
function Dist({ km, onCommit, label }: { km: number; onCommit: (km: number) => void; label: string }) {
  const [unit, setUnit] = useState<"m" | "km">(km < 1 ? "m" : "km");
  return (
    <span className="inline-flex gap-1">
      <input
        key={`${km}-${unit}`}
        className="field w-20 py-1"
        type="number" min={0} step={unit === "m" ? 50 : 0.1}
        defaultValue={unit === "m" ? Math.round(km * 1000) : Number(km.toFixed(2))}
        aria-label={label}
        onBlur={(e) => { const v = parseFloat(e.target.value); if (v > 0) onCommit(unit === "m" ? v / 1000 : v); }}
        onKeyDown={blur}
      />
      <select className="field py-1" value={unit} aria-label={`${label} unit`} onChange={(e) => setUnit(e.target.value as "m" | "km")}>
        <option value="m">m</option><option value="km">km</option>
      </select>
    </span>
  );
}

function Offset({ offset, onCommit }: { offset: number; onCommit: (o: number) => void }) {
  const [dir, setDir] = useState<"faster" | "slower">(offset > 0 ? "slower" : "faster");
  const sign = (d: string) => (d === "faster" ? -1 : 1);
  return (
    <span className="inline-flex items-center gap-1">
      <input key={offset} className="field w-16 py-1" type="number" min={0} step={1} defaultValue={Math.abs(offset)} aria-label="Seconds per km"
        onBlur={(e) => onCommit(sign(dir) * Math.max(0, Math.round(Number(e.target.value) || 0)))} onKeyDown={blur} />
      <span className="text-sm muted">s/km</span>
      <select className="field py-1" value={dir} aria-label="Faster or slower than goal pace"
        onChange={(e) => { const d = e.target.value as "faster" | "slower"; setDir(d); onCommit(sign(d) * Math.abs(offset)); }}>
        <option value="faster">faster than goal pace</option><option value="slower">slower than goal pace</option>
      </select>
    </span>
  );
}

const small = "text-xs muted";

function StepCard({ s, paces, onChange, onRemove, canRemove }: { s: Step; paces: Paces | null; onChange: (s: Step) => void; onRemove: () => void; canRemove: boolean }) {
  const timed = s.time_sec != null;
  const reps = s.reps ?? 1;
  // Timed steps keep an estimated distance so totals and the chart work
  const set = (n: Step) => onChange(n.time_sec ? { ...n, distance_km: Math.round(stepKm(n, paces) * 100) / 100 } : n);
  const setRest = (r: Rest) => set({ ...s, rest: r });
  const mode = s.pace?.mode ?? "zone";

  const withoutTime = () => { const { time_sec: _t, ...rest } = s; void _t; return rest as Step; };

  return (
    <li className="space-y-2 rounded border line p-2">
      <div className="flex items-center gap-2">
        <input key={s.label} className="field min-w-0 flex-1 py-1" defaultValue={s.label} aria-label="Step name"
          onBlur={(e) => set({ ...s, label: e.target.value || s.label })} />
        <label className={`flex items-center gap-1 ${small}`}>
          Reps
          <input className="field w-14 py-1" type="number" min={1} max={30} defaultValue={reps} key={reps} aria-label="Repeats"
            onBlur={(e) => {
              const n = Math.min(30, Math.max(1, Math.round(Number(e.target.value) || 1)));
              if (n <= 1) { const { reps: _r, rest: _x, ...single } = s; void _r; void _x; set(single as Step); }
              else set({ ...s, reps: n, rest: s.rest ?? { kind: "jog", time_sec: 90 } });
            }}
            onKeyDown={blur} />
        </label>
        <button type="button" className="btn-ghost py-1" disabled={!canRemove} aria-label="Remove step" onClick={onRemove}>✕</button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <select className="field py-1" value={timed ? "time" : "distance"} aria-label="Measured by"
          onChange={(e) => set(e.target.value === "time" ? { ...s, time_sec: 180 } : withoutTime())}>
          <option value="distance">Distance</option><option value="time">Time</option>
        </select>
        {timed ? <Clock value={s.time_sec!} label="Step time" onCommit={(sec) => set({ ...s, time_sec: sec })} />
               : <Dist km={s.distance_km} label="Step distance" onCommit={(km) => set({ ...s, distance_km: km })} />}
        <select className="field py-1" value={s.zone} aria-label="Effort zone" onChange={(e) => set({ ...s, zone: e.target.value as Zone })}>
          {(Object.keys(ZONE_NAME) as Zone[]).map((z) => <option key={z} value={z}>{ZONE_NAME[z]}</option>)}
        </select>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <select className="field py-1" value={mode} aria-label="Pace type"
          onChange={(e) => {
            const m = e.target.value;
            const { pace: _p, ...noPace } = s; void _p;
            if (m === "zone") set(noPace as Step);
            else if (m === "offset") set({ ...s, pace: { mode: "offset", offset: 0 } });
            else set({ ...s, pace: { mode: "fixed", sec: Math.round(stepPaceSec(noPace as Step, paces)) } });
          }}>
          <option value="zone">Pace from zone</option><option value="offset">Relative to goal pace</option><option value="fixed">Fixed pace</option>
        </select>
        {s.pace?.mode === "offset" && <Offset offset={s.pace.offset} onCommit={(o) => set({ ...s, pace: { mode: "offset", offset: o } })} />}
        {s.pace?.mode === "fixed" && (
          <span className="inline-flex items-center gap-1">
            <Clock value={s.pace.sec} label="Fixed pace" parse={parsePace} onCommit={(sec) => set({ ...s, pace: { mode: "fixed", sec } })} />
            <span className="text-sm muted">/km</span>
          </span>
        )}
        {stepPaceText(s, paces) && <span className={small}>→ {stepPaceText(s, paces)}</span>}
      </div>

      {reps > 1 && s.rest && (
        <div className="flex flex-wrap items-center gap-2 border-t line pt-2">
          <span className={small}>Rest between reps</span>
          <select className="field py-1" value={s.rest.kind} aria-label="Rest type"
            onChange={(e) => {
              const kind = e.target.value as RestKind;
              setRest(kind === "stand" || s.rest!.time_sec ? { kind, time_sec: s.rest!.time_sec ?? 90 } : { kind, distance_km: s.rest!.distance_km ?? 0.4 });
            }}>
            <option value="jog">Jog</option><option value="walk">Walk</option><option value="stand">Stand</option>
          </select>
          {s.rest.kind !== "stand" && (
            <select className="field py-1" value={s.rest.time_sec ? "time" : "distance"} aria-label="Rest measured by"
              onChange={(e) => setRest(e.target.value === "time" ? { kind: s.rest!.kind, time_sec: 90 } : { kind: s.rest!.kind, distance_km: 0.4 })}>
              <option value="time">Time</option><option value="distance">Distance</option>
            </select>
          )}
          {s.rest.time_sec ? <Clock value={s.rest.time_sec} label="Rest time" onCommit={(sec) => setRest({ ...s.rest!, time_sec: sec })} />
                           : <Dist km={s.rest.distance_km ?? 0.4} label="Rest distance" onCommit={(km) => setRest({ ...s.rest!, distance_km: km })} />}
        </div>
      )}
    </li>
  );
}

export default function StepEditor({ steps, paces, onChange, onReset }: { steps: Step[]; paces: Paces | null; onChange: (steps: Step[]) => void; onReset: () => void }) {
  return (
    <div className="space-y-2">
      <ul className="space-y-2">
        {steps.map((s, i) => (
          <StepCard
            key={`${i}-${steps.length}`}
            s={s}
            paces={paces}
            canRemove={steps.length > 1}
            onChange={(n) => onChange(steps.map((x, j) => (j === i ? n : x)))}
            onRemove={() => onChange(steps.filter((_, j) => j !== i))}
          />
        ))}
      </ul>
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn-ghost" onClick={() => onChange([...steps, { label: "Step", distance_km: 1, zone: "easy" }])}>Add step</button>
        <button type="button" className="btn-ghost"
          onClick={() => onChange([...steps, { label: "Rep", distance_km: 0.4, zone: "interval", reps: 6, rest: { kind: "jog", time_sec: 90 } }])}>
          Add repeat block
        </button>
        <button type="button" className="btn-ghost" onClick={onReset}>Reset to preset</button>
      </div>
    </div>
  );
}
