import { garminGet, getGarminToken } from "@/lib/garmin";
import { describeResponse } from "@/lib/garmin-parse";
import { isGarminLinked, requireUser } from "@/lib/server-auth";

export const dynamic = "force-dynamic";

// Read-only look at what Garmin returns for recent activities. It describes the reply
// (shape, field names, a short sample) so we can build the real sync on facts.
export async function POST(req: Request) {
  const auth = await requireUser(req);
  if (!auth.ok) return Response.json({ ok: false, message: auth.message }, { status: auth.status });
  if (!(await isGarminLinked(auth.sb, auth.user.id))) {
    return Response.json({ ok: false, message: "Garmin is not enabled for this account." }, { status: 403 });
  }

  const token = await getGarminToken();
  if (!token.ok) return Response.json({ ok: false, message: token.message, status: token.status });

  const until = new Date();
  const from = new Date(until.getTime() - 14 * 86400000);
  const day = (d: Date) => d.toISOString().slice(0, 10);
  const requests = [
    { name: "Date range (last 14 days)", path: `/wellnessactivity-service/activity/summary/range/${day(from)}/${day(until)}` },
    { name: "Activity search (latest 10)", path: "/activitylist-service/activities/search/activities?start=0&limit=10" },
  ];

  const attempts = [];
  for (const r of requests) {
    const res = await garminGet(token.token, r.path);
    if (res.ok) {
      attempts.push({ name: r.name, path: r.path, ok: true, status: res.status, contentType: res.contentType, ...describeResponse(res.text) });
    } else {
      attempts.push({
        name: r.name,
        path: r.path,
        ok: false,
        status: res.status,
        error: res.error ?? res.text.replace(/\s+/g, " ").slice(0, 300),
      });
    }
  }
  return Response.json({ ok: true, attempts });
}
