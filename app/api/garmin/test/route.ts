import { getGarminToken } from "@/lib/garmin";
import { isGarminLinked, requireUser } from "@/lib/server-auth";

export const dynamic = "force-dynamic";

// Checks that the server's Garmin key works. Never returns the key or the token.
export async function POST(req: Request) {
  const auth = await requireUser(req);
  if (!auth.ok) return Response.json({ ok: false, message: auth.message }, { status: auth.status });
  if (!(await isGarminLinked(auth.sb, auth.user.id))) {
    return Response.json({ ok: false, message: "Garmin is not enabled for this account." }, { status: 403 });
  }

  const result = await getGarminToken();
  if (!result.ok) {
    const { ok, ...details } = result;
    void ok;
    return Response.json({ ok: false, ...details });
  }
  return Response.json({ ok: true, message: "Garmin accepted your key.", shape: result.shape, fields: result.fields });
}
