"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

// Wraps a page: sends signed-out visitors to /login and shows the top bar.
export default function Guard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) router.replace("/login");
      else setReady(true);
    });
  }, [router]);

  if (!ready) return <p className="p-6 text-gray-500">Loading…</p>;

  return (
    <div className="mx-auto max-w-2xl p-4">
      <nav className="mb-6 flex items-center justify-between border-b pb-3">
        <div className="flex gap-4 font-medium">
          <Link href="/">Plans</Link>
          <Link href="/my-plan">My plan</Link>
        </div>
        <button
          className="text-sm text-gray-500"
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
