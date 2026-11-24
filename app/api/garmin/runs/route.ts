import { garminGet, getGarminToken } from "@/lib/garmin";
import { toRuns } from "@/lib/garmin-parse";
import { isGarminLinked, requireUser } from "@/lib/server-auth";

export const dynamic = "force-dynamic";

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const PAGE = 99;

// Read-only: the signed-in owner's runs between two local dates (YYYY-MM-DD).
export async function POST(req: Request) {
  const auth = await requireUser(req);
  if (!auth.ok) return Response.json({ ok: false, message: auth.message }, { status: auth.status });
  if (!(await isGarminLinked(auth.sb, auth.user.id))) {
    return Response.json({ ok: false, message: "Garmin is not enabled for this account." }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as { from?: unknown; to?: unknown };
  if (typeof body.from !== "string" || typeof body.to !== "string" || !DATE.test(body.from) || !DATE.test(body.to)) {
    return Response.json({ ok: false, message: "Send a from and to date (YYYY-MM-DD)." }, { status: 400 });
  }

  const token = await getGarminToken();
  if (!token.ok) return Response.json({ ok: false, message: token.message });

  const runs = [];
  for (let page = 0; page < 5; page++) {
    const path = `/activitylist-service/activities/search/activities?start=${page * PAGE}&limit=${PAGE}&startDate=${body.from}&endDate=${body.to}`;
    const res = await garminGet(token.token, path);
    if (!res.ok) {
      return Response.json({ ok: false, message: res.error ?? `Garmin returned HTTP ${res.status} for the activity list.` });
    }
    runs.push(...toRuns(res.text));
    let count = 0;
    try {
      const parsed: unknown = JSON.parse(res.text);
      count = Array.isArray(parsed) ? parsed.length : 0;
    } catch {}
    if (count < PAGE) break;
  }
  return Response.json({ ok: true, runs });
}
