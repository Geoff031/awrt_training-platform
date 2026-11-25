"use client";
import { useState } from "react";

export type PlanComment = {
  id: string;
  user_plan_id: string;
  workout_id: string | null;
  author_name: string | null;
  from_coach: boolean;
  body: string;
  created_at: string;
};

const when = (iso: string) =>
  new Date(iso).toLocaleString("en-ZA", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

// A small message thread with a box to add to it. Used by runners and coaches.
export default function CommentThread({
  comments,
  onSend,
  placeholder,
  button = "Send",
}: {
  comments: PlanComment[];
  onSend: (body: string) => Promise<string | null>; // returns an error message, or null
  placeholder: string;
  button?: string;
}) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function send() {
    const body = text.trim();
    if (!body) return;
    setBusy(true);
    setError("");
    const err = await onSend(body);
    setBusy(false);
    if (err) setError(err);
    else setText("");
  }

  return (
    <div className="space-y-3">
      {comments.length > 0 && (
        <ul className="space-y-2">
          {comments.map((c) => (
            <li key={c.id} className={`rounded border line p-2 text-sm ${c.from_coach ? "panel border-l-4" : ""}`} style={c.from_coach ? { borderLeftColor: "var(--foreground)" } : undefined}>
              <p className="text-xs muted">
                {c.from_coach ? "Coach" : "Runner"}{c.author_name && c.author_name !== (c.from_coach ? "Coach" : "Runner") ? ` · ${c.author_name}` : ""} · {when(c.created_at)}
              </p>
              <p className="whitespace-pre-wrap break-words">{c.body}</p>
            </li>
          ))}
        </ul>
      )}
      <textarea className="field w-full" rows={2} maxLength={1000} value={text} placeholder={placeholder} aria-label={placeholder} onChange={(e) => setText(e.target.value)} />
      {error && <p className="text-sm" role="alert">✕ {error}</p>}
      <button className="btn-ghost" disabled={busy || !text.trim()} onClick={send}>
        {busy ? "Sending…" : button}
      </button>
    </div>
  );
}
