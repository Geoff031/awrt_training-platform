import { parseTokenReply } from "@/lib/garmin-parse";

// Garmin personal API (server only). The key lives in the GARMIN_API_KEY environment
// variable and is never sent to the browser or logged.

const BASE = process.env.GARMIN_API_BASE ?? "https://personal.connectapi.garmin.com";
const TOKEN_URL = process.env.GARMIN_TOKEN_URL ?? `${BASE}/personalapitoken-service/personal-api/personal-api-key/token`;

export type TokenResult =
  | { ok: true; token: string; shape: string; fields: string[] }
  | { ok: false; status: number; message: string; shape?: string; fields?: string[]; length?: number; headers?: string[] };

// Swap the API key for an access token (valid for up to 24 hours).
export async function getGarminToken(): Promise<TokenResult> {
  const key = process.env.GARMIN_API_KEY;
  if (!key) return { ok: false, status: 0, message: "GARMIN_API_KEY is not set on the server." };

  let res: Response;
  try {
    res = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { Authorization: `ApiKey ${key}` },
      signal: AbortSignal.timeout(15000),
      cache: "no-store",
    });
  } catch {
    return { ok: false, status: 0, message: "Could not reach Garmin (network error or timeout)." };
  }

  if (!res.ok) {
    return { ok: false, status: res.status, message: `Garmin refused the key (HTTP ${res.status}).` };
  }

  const reply = parseTokenReply(await res.text());
  if (!reply.token) {
    return {
      ok: false,
      status: res.status,
      message: "Garmin replied, but no access token could be found in the reply.",
      shape: reply.shape,
      fields: reply.fields,
      length: reply.length,
      headers: Array.from(res.headers.keys()), // names only, never values
    };
  }
  return { ok: true, token: reply.token, shape: reply.shape, fields: reply.fields };
}

export type GarminReply = { ok: boolean; status: number; contentType: string; text: string; error?: string };

// Read-only GET against the personal API with an access token.
export async function garminGet(token: string, path: string): Promise<GarminReply> {
  try {
    const res = await fetch(`${BASE}${path}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      signal: AbortSignal.timeout(20000),
      cache: "no-store",
    });
    return { ok: res.ok, status: res.status, contentType: res.headers.get("content-type") ?? "", text: await res.text() };
  } catch {
    return { ok: false, status: 0, contentType: "", text: "", error: "Could not reach Garmin (network error or timeout)." };
  }
}
