"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import Guard from "@/components/Guard";

type Plan = { id: string; title: string; description: string | null; goal_distance: string; weeks: number; level: string | null };

export default function Home() {
  const [plans, setPlans] = useState<Plan[] | null>(null);

  useEffect(() => {
    supabase
      .from("plans")
      .select("id,title,description,goal_distance,weeks,level")
      .eq("visibility", "public")
      .order("weeks")
      .then(({ data }) => setPlans(data ?? []));
  }, []);

  return (
    <Guard>
      <h1 className="mb-4 text-2xl font-bold">Training plans</h1>
      {plans === null && <p className="muted">Loading plans…</p>}
      {plans?.length === 0 && <p className="muted">No plans yet.</p>}
      <div className="space-y-3">
        {plans?.map((p) => (
          <Link key={p.id} href={`/plans/${p.id}`} className="hover-panel block rounded border line p-4">
            <div className="font-semibold">{p.title}</div>
            <div className="text-sm muted">
              {p.goal_distance.toUpperCase()} · {p.weeks} weeks{p.level ? ` · ${p.level}` : ""}
            </div>
            {p.description && <p className="mt-1 text-sm">{p.description}</p>}
          </Link>
        ))}
      </div>
    </Guard>
  );
}
