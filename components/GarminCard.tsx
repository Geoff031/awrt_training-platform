"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type TestResult = {
  ok: boolean;
  message: string;
  status?: number;
  shape?: string;
  fields?: string[];
  length?: number;
  headers?: string[];
};
type Attempt = {
  name: string;
  path: string;
  ok: boolean;
  status: number;
  error?: string;
  contentType?: string;
  shape?: string;
  count?: number;
  itemKeys?: string[];
  sample?: Record<string, string | number | boolean | null>[];
};
type PreviewResult = { ok: boolean; message?: string; status?: number; attempts?: Attempt[] };

// Only shown to the account linked to the personal Garmin key.
export default function GarminCard() {
  const [linked, setLinked] = useState(false);
  const [busy, setBusy] = useState<"" | "test" | "preview">("");
  const [result, setResult] = useState<TestResult | null>(null);
  const [preview, setPreview] = useState<PreviewResult | null>(null);

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

  if (!linked) return null;

  return (
    <div className="panel mt-6 rounded border line p-4">
      <h2 className="font-semibold">Garmin</h2>
      <p className="mb-3 text-sm muted">Connected with your personal Garmin key. Only your account can see this.</p>
      <div className="flex flex-wrap gap-2">
        <button className="btn" disabled={busy !== ""} onClick={() => run("test")}>
          {busy === "test" ? "Testing…" : "Test connection"}
        </button>
        <button className="btn-ghost" disabled={busy !== ""} onClick={() => run("preview")}>
          {busy === "preview" ? "Looking…" : "Preview recent activities"}
        </button>
      </div>

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
              <p className="font-medium">
                {a.ok ? "✓" : "✕"} {a.name} · HTTP {a.status}
              </p>
              {a.ok ? (
                <>
                  <p className="muted">
                    {a.shape} · {a.count} item{a.count === 1 ? "" : "s"}
                  </p>
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
