"use client";
import { useState } from "react";
import Logo from "@/components/Logo";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function Login() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [role, setRole] = useState<"athlete" | "coach">("athlete");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMessage("");
    if (mode === "signup") {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: name, requested_role: role } },
      });
      if (error) return setMessage(error.message);
      if (!data.session) return setMessage("Check your email to confirm your account, then log in.");
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) return setMessage(error.message);
    }
    router.replace("/");
  }

  const roleButton = (value: "athlete" | "coach", text: string) => (
    <button
      type="button"
      onClick={() => setRole(value)}
      aria-pressed={role === value}
      className={`btn-ghost flex-1 py-2 ${role === value ? "seg-on" : ""}`}
    >
      {text}
    </button>
  );

  return (
    <main className="mx-auto max-w-sm p-6">
      <div className="mb-6 flex justify-center">
        <Logo variant="stacked" height={96} />
      </div>
      <h1 className="mb-4 text-2xl font-bold">{mode === "login" ? "Log in" : "Create account"}</h1>
      <form onSubmit={submit} className="space-y-3">
        {mode === "signup" && (
          <>
            <div>
              <p className="mb-1 text-sm font-medium">I am a…</p>
              <div className="flex gap-2">
                {roleButton("athlete", "Runner")}
                {roleButton("coach", "Coach")}
              </div>
              {role === "coach" && (
                <p className="mt-2 text-xs muted">
                  Coach accounts are approved before you can publish plans or take on runners. Until then you&apos;ll
                  see the runner view.
                </p>
              )}
            </div>
            <input className="field w-full" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
          </>
        )}
        <input className="field w-full" type="email" placeholder="Email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        <input className="field w-full" type="password" placeholder="Password (min 6 characters)" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
        <button className="btn w-full">{mode === "login" ? "Log in" : "Sign up"}</button>
      </form>
      {message && <p className="mt-3 text-sm">{message}</p>}
      <button className="mt-4 text-sm underline" onClick={() => setMode(mode === "login" ? "signup" : "login")}>
        {mode === "login" ? "New here? Create an account" : "Already have an account? Log in"}
      </button>
    </main>
  );
}
