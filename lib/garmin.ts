// Garmin personal API (server only). The key lives in the GARMIN_API_KEY environment
// variable and is never sent to the browser or logged.

const TOKEN_URL =
  process.env.GARMIN_TOKEN_URL ??
  "https://personal.connectapi.garmin.com/personalapitoken-service/personal-api/personal-api-key/token";

export type TokenResult =
  | { ok: true; token: string; fields: string[] }
  | { ok: false; status: number; message: string; fields?: string[] };

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

  let body: Record<string, unknown> = {};
  try {
    body = await res.json();
  } catch {
    // fall through: no JSON body
  }
  const fields = Object.keys(body);
  const token = [body.access_token, body.accessToken, body.token, body.AccessToken].find(
    (v): v is string => typeof v === "string" && v.length > 0
  );
  if (!token) {
    return { ok: false, status: res.status, message: "Garmin replied, but no access token was found in the reply.", fields };
  }
  return { ok: true, token, fields };
}
