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

  useEffect(() => {
    async function load() {
      const { data } = await supabase.auth.getSession();
      const user = data.session?.user;
      if (!user) return;
      setUid(user.id);
      setEmail(user.email ?? "");
      const { data: p } = await supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle();
      setName(p?.full_name ?? "");
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
      <GarminCard />
    </Guard>
  );
}
