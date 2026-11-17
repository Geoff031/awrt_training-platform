"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function Login() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "signup">("login");
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
        options: { data: { full_name: name } },
      });
      if (error) return setMessage(error.message);
      if (!data.session) return setMessage("Check your email to confirm your account, then log in.");
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) return setMessage(error.message);
    }
    router.replace("/");
  }

  const input = "w-full rounded border p-2";
  return (
    <main className="mx-auto max-w-sm p-6">
      <h1 className="mb-4 text-2xl font-bold">{mode === "login" ? "Log in" : "Create account"}</h1>
      <form onSubmit={submit} className="space-y-3">
        {mode === "signup" && (
          <input className={input} placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
        )}
        <input className={input} type="email" placeholder="Email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        <input className={input} type="password" placeholder="Password (min 6 characters)" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
        <button className="w-full rounded bg-black p-2 text-white">{mode === "login" ? "Log in" : "Sign up"}</button>
      </form>
      {message && <p className="mt-3 text-sm text-red-600">{message}</p>}
      <button className="mt-4 text-sm underline" onClick={() => setMode(mode === "login" ? "signup" : "login")}>
        {mode === "login" ? "New here? Create an account" : "Already have an account? Log in"}
      </button>
    </main>
  );
}
