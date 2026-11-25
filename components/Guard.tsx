"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

// Wraps a page: sends signed-out visitors to /login and shows the top bar.
export default function Guard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [coach, setCoach] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) router.replace("/login");
      else {
        setReady(true);
        // Approved coaches get a link to the plan builder
        supabase
          .from("coach_profiles")
          .select("approved")
          .eq("user_id", data.session.user.id)
          .maybeSingle()
          .then(({ data: c }) => setCoach(Boolean(c?.approved)));
      }
    });
  }, [router]);

  if (!ready) return <p className="p-6 muted">Loading…</p>;

  return (
    <div className="mx-auto max-w-2xl p-4">
      <nav className="mb-6 flex items-center justify-between border-b line pb-3">
        <div className="flex gap-4 font-medium">
          <Link href="/">Plans</Link>
          <Link href="/my-plan">My plan</Link>
          {coach && <Link href="/coach/new">Build plan</Link>}
        </div>
        <button
          className="text-sm muted"
          onClick={async () => {
            await supabase.auth.signOut();
            router.replace("/login");
          }}
        >
          Sign out
        </button>
      </nav>
      {children}
    </div>
  );
}
