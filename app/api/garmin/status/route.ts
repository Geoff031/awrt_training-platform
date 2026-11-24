import { isGarminLinked, requireUser } from "@/lib/server-auth";

export const dynamic = "force-dynamic";

// Tells the page whether to show the Garmin card (only for the linked account).
export async function GET(req: Request) {
  const auth = await requireUser(req);
  if (!auth.ok) return Response.json({ linked: false }, { status: auth.status });
  return Response.json({ linked: await isGarminLinked(auth.sb, auth.user.id) });
}
