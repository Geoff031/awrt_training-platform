"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type TestResult = { ok: boolean; message: string; status?: number; fields?: string[] };

// Only shown to the account linked to the personal Garmin key.
export default function GarminCard() {
  const [linked, setLinked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<TestResult | null>(null);

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

  async function test() {
    setBusy(true);
    setResult(null);
    try {
      const res = await fetch("/api/garmin/test", { method: "POST", headers: await authHeader() });
      setResult(await res.json());
    } catch {
      setResult({ ok: false, message: "Could not reach the server." });
    }
    setBusy(false);
  }

  if (!linked) return null;

  return (
    <div className="panel mt-6 rounded border line p-4">
      <h2 className="font-semibold">Garmin</h2>
      <p className="mb-3 text-sm muted">Connected with your personal Garmin key. Only your account can see this.</p>
      <button className="btn" disabled={busy} onClick={test}>
        {busy ? "Testing…" : "Test connection"}
      </button>
      {result && (
        <div className="mt-3 text-sm">
          <p>{result.ok ? `✓ ${result.message}` : `✕ ${result.message}`}</p>
          {result.status ? <p className="muted">HTTP status: {result.status}</p> : null}
          {result.fields && result.fields.length > 0 && (
            <p className="muted">Garmin reply contained: {result.fields.join(", ")}</p>
          )}
        </div>
      )}
    </div>
  );
}
