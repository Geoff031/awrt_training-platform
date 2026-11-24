// Pure helpers for reading Garmin replies (no network, no secrets), so they are easy to test.

const JWT = /^[\w-]+\.[\w-]+\.[\w-]+$/;

function findToken(value: unknown, depth = 0): string | undefined {
  if (!value || typeof value !== "object" || depth > 2) return undefined;
  const obj = value as Record<string, unknown>;
  for (const [k, v] of Object.entries(obj)) {
    if (/token/i.test(k) && typeof v === "string" && v.length > 10) return v;
  }
  for (const v of Object.values(obj)) {
    if (typeof v === "string" && JWT.test(v)) return v;
  }
  for (const v of Object.values(obj)) {
    const found = findToken(v, depth + 1);
    if (found) return found;
  }
  return undefined;
}

export type TokenReply = { token?: string; shape: string; fields: string[]; length: number };

// Garmin's token reply format is not documented, so accept a JSON object, a JSON string or plain text.
export function parseTokenReply(text: string): TokenReply {
  const trimmed = text.trim();
  if (!trimmed) return { shape: "empty reply", fields: [], length: 0 };
  const length = trimmed.length;
  try {
    const parsed: unknown = JSON.parse(trimmed);
    if (typeof parsed === "string") return { token: parsed.length > 10 ? parsed : undefined, shape: "JSON string", fields: [], length };
    if (Array.isArray(parsed)) return { token: findToken(parsed), shape: "JSON list", fields: [], length };
    if (parsed && typeof parsed === "object") {
      return { token: findToken(parsed), shape: "JSON object", fields: Object.keys(parsed), length };
    }
    return { shape: "JSON value", fields: [], length };
  } catch {
    const looksLikeToken = /^[\w\-.~+/=]{20,}$/.test(trimmed);
    return { token: looksLikeToken ? trimmed : undefined, shape: "plain text", fields: [], length };
  }
}

type Scalar = string | number | boolean | null;
export type Described = {
  shape: string;
  container?: string;
  count: number;
  itemKeys: string[];
  sample: Record<string, Scalar>[];
};

const WANTED = /id$|type|name|start|date|time|dist|dur|elapsed|moving|sport|unit/i;

// Flatten one level (activityType.typeKey) and keep only fields useful for matching runs.
function pickFields(item: unknown): Record<string, Scalar> {
  const out: Record<string, Scalar> = {};
  if (!item || typeof item !== "object") return out;
  const add = (path: string, v: unknown) => {
    if (!WANTED.test(path)) return;
    if (v === null || typeof v === "number" || typeof v === "boolean") out[path] = v;
    else if (typeof v === "string") out[path] = v.length > 60 ? v.slice(0, 60) + "…" : v;
  };
  for (const [k, v] of Object.entries(item as Record<string, unknown>)) {
    if (v && typeof v === "object" && !Array.isArray(v)) {
      for (const [k2, v2] of Object.entries(v as Record<string, unknown>)) add(`${k}.${k2}`, v2);
    } else {
      add(k, v);
    }
  }
  return out;
}

// Describe a JSON reply without dumping it: its shape, field names and a short sample.
export function describeResponse(text: string): Described {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { shape: `not JSON (${text.length} characters)`, count: 0, itemKeys: [], sample: [] };
  }

  let items: unknown[] = [];
  let container: string | undefined;
  let shape = "JSON value";
  if (Array.isArray(parsed)) {
    items = parsed;
    shape = "list";
  } else if (parsed && typeof parsed === "object") {
    shape = "object";
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      if (Array.isArray(v)) {
        items = v;
        container = k;
        shape = `object with a list under "${k}"`;
        break;
      }
    }
    if (!container) {
      return { shape: "object", count: 0, itemKeys: Object.keys(parsed as object), sample: [pickFields(parsed)] };
    }
  }

  const first = items[0];
  return {
    shape,
    container,
    count: items.length,
    itemKeys: first && typeof first === "object" ? Object.keys(first as object) : [],
    sample: items.slice(0, 3).map(pickFields),
  };
}

export type GarminRun = { id: string; date: string; distance_km: number; time_seconds: number; name: string };

// Turn Garmin's activity search reply into plain runs. Distance is in metres and
// duration in seconds; the date is the local start date. Only running types are kept.
export function toRuns(text: string): GarminRun[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  const runs: GarminRun[] = [];
  for (const item of parsed) {
    if (!item || typeof item !== "object") continue;
    const a = item as Record<string, unknown>;
    const typeKey = (a.activityType as { typeKey?: unknown } | undefined)?.typeKey;
    if (typeof typeKey !== "string" || !/run/i.test(typeKey)) continue;
    if (typeof a.startTimeLocal !== "string" || !/^\d{4}-\d{2}-\d{2}/.test(a.startTimeLocal)) continue;
    if (typeof a.distance !== "number" || typeof a.duration !== "number" || a.activityId == null) continue;
    runs.push({
      id: String(a.activityId),
      date: a.startTimeLocal.slice(0, 10),
      distance_km: Math.round(a.distance) / 1000,
      time_seconds: Math.round(a.duration),
      name: typeof a.activityName === "string" ? a.activityName.trim() : "",
    });
  }
  return runs;
}
