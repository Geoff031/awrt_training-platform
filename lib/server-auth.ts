import { createClient, SupabaseClient, User } from "@supabase/supabase-js";

// Server-side helpers. The caller sends their Supabase session token, and every
// database call runs as that user, so the normal security rules still apply.

export type AuthResult =
  | { ok: true; sb: SupabaseClient; user: User }
  | { ok: false; status: number; message: string };

export async function requireUser(req: Request): Promise<AuthResult> {
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return { ok: false, status: 401, message: "Not signed in" };

  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await sb.auth.getUser(token);
  if (error || !data.user) return { ok: false, status: 401, message: "Not signed in" };
  return { ok: true, sb, user: data.user };
}

// Is this account the one linked to the server's personal Garmin key?
export async function isGarminLinked(sb: SupabaseClient, userId: string) {
  const { data } = await sb.from("garmin_links").select("user_id").eq("user_id", userId);
  return (data?.length ?? 0) > 0;
}
