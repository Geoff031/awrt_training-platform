"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import Guard from "@/components/Guard";
import PlanBuilder from "@/components/PlanBuilder";

// Only approved coaches can build plans (the database enforces this too).
export default function NewPlan() {
  const [state, setState] = useState<"loading" | "ok" | "no">("loading");

  useEffect(() => {
    async function check() {
      const { data: auth } = await supabase.auth.getSession();
      const uid = auth.session?.user.id;
      if (!uid) return setState("no");
      const { data } = await supabase.from("coach_profiles").select("approved").eq("user_id", uid).maybeSingle();
      setState(data?.approved ? "ok" : "no");
    }
    check();
  }, []);

  return (
    <Guard>
      {state === "loading" && <p className="muted">Loading…</p>}
      {state === "no" && <p className="muted">Plan building is for approved coaches. Your coach account hasn&apos;t been approved yet.</p>}
      {state === "ok" && <PlanBuilder />}
    </Guard>
  );
}
