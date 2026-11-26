"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import Guard from "@/components/Guard";
import GarminCard from "@/components/GarminCard";

export default function Profile() {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [uid, setUid] = useState("");
  const [note, setNote] = useState("");
  const [garminOn, setGarminOn] = useState(false);

  useEffect(() => {
    async function load() {
      const { data } = await supabase.auth.getSession();
      const user = data.session?.user;
      if (!user) return;
      setUid(user.id);
      setEmail(user.email ?? "");
      const { data: p } = await supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle();
      setName(p?.full_name ?? "");
      // Garmin is only live for the account holding the personal key for now
      fetch("/api/garmin/status", { headers: { Authorization: `Bearer ${data.session?.access_token ?? ""}` } })
        .then((r) => r.json())
        .then((j) => setGarminOn(Boolean(j.linked)))
        .catch(() => setGarminOn(false));
    }
    load();
  }, []);

  async function save() {
    setNote("");
    const { error } = await supabase.from("profiles").update({ full_name: name.trim() || null }).eq("id", uid);
    setNote(error ? `✕ ${error.message}` : "✓ Saved");
  }

  return (
    <Guard>
      <h1 className="mb-4 text-2xl font-bold">Profile</h1>
      <section className="panel rounded border line p-4">
        <p className="mb-3 text-sm muted">{email}</p>
        <label className="block text-sm">
          Your name
          <span className="block muted">Shown to your coach on messages.</span>
          <input className="field mt-1 w-full" value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <div className="mt-3 flex items-center gap-3">
          <button className="btn" onClick={save} disabled={!uid}>Save</button>
          {note && <span className="text-sm">{note}</span>}
        </div>
      </section>
      <section className="mt-6 rounded border line p-4">
        <h2 className="mb-2 font-semibold">Connections</h2>
        <p className="mb-3 text-sm muted">Link a watch or running app and your runs fill in your plan.</p>
        <ul className="divide-y line text-sm">
          {[
            { name: "Garmin", state: garminOn ? "Connected" : "Coming soon" },
            { name: "Strava", state: "Coming soon" },
          ].map((c) => (
            <li key={c.name} className="flex items-center justify-between py-2 line">
              <span className="font-medium">{c.name}</span>
              <span className={c.state === "Connected" ? "" : "muted"}>{c.state === "Connected" ? "✓ Connected" : c.state}</span>
            </li>
          ))}
        </ul>
      </section>
      <GarminCard />
    </Guard>
  );
}
