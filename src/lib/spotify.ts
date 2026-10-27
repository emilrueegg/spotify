import { appConfig } from "./config";
import { updateSessionTokens, type SessionRecord } from "./db";

export class SpotifyError extends Error {
  status: number;
  constructor(message: string, status = 502) {
    super(message);
    this.status = status;
  }
}

export type SpotifyAuth = {
  getAccessToken: () => string;
  shouldRefresh: () => boolean;
  refresh: () => Promise<void>;
};

export function authFromSession(session: SessionRecord): SpotifyAuth {
  let pending: Promise<void> | null = null;
  return {
    getAccessToken: () => session.access_token ?? "",
    shouldRefresh: () => session.expires_at != null && session.expires_at < Date.now() + 15_000,
    refresh: () => {
      if (!pending) {
        pending = refreshSession(session).finally(() => {
          pending = null;
        });
      }
      return pending;
    },
  };
}

async function refreshSession(session: SessionRecord) {
  if (!session.refresh_token) {
    throw new SpotifyError("Anmeldung abgelaufen. Bitte erneut mit Spotify anmelden.", 401);
  }
  const config = appConfig();
  const response = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${config.clientId}:${config.clientSecret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: session.refresh_token,
    }),
    cache: "no-store",
  });
  if (!response.ok) {
    throw new SpotifyError("Anmeldung abgelaufen. Bitte erneut mit Spotify anmelden.", 401);
  }
  const json = (await response.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
  };
  if (!json.access_token) {
    throw new SpotifyError("Spotify hat kein neues Token geliefert.", 401);
  }
  session.access_token = json.access_token;
  if (json.refresh_token) session.refresh_token = json.refresh_token;
  session.expires_at = Date.now() + (json.expires_in ?? 3600) * 1000;
  updateSessionTokens(session);
}

export async function spotifyFetch(
  auth: SpotifyAuth,
  path: string,
  init: RequestInit = {},
  rateRetries = 0,
  authRetries = 0,
): Promise<Response> {
  if (auth.shouldRefresh() && authRetries < 1) {
    await auth.refresh();
  }
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${auth.getAccessToken()}`);
  if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  const response = await fetch(path.startsWith("http") ? path : `https://api.spotify.com/v1${path}`, {
    ...init,
    headers,
    cache: "no-store",
  });
  if (response.status === 401 && authRetries < 1) {
    await auth.refresh();
    return spotifyFetch(auth, path, init, rateRetries, authRetries + 1);
  }
  if (response.status === 429 && rateRetries < 5) {
    const retryAfter = Number(response.headers.get("retry-after") ?? "1");
    const seconds = Number.isFinite(retryAfter) ? Math.min(Math.max(retryAfter, 0), 60) : 1;
    await new Promise((resolve) => setTimeout(resolve, seconds * 1000));
    return spotifyFetch(auth, path, init, rateRetries + 1, authRetries);
  }
  return response;
}

export async function spotifyError(response: Response): Promise<string> {
  const text = await response.text();
  try {
    const json = JSON.parse(text) as { error?: { message?: string } | string };
    if (typeof json.error === "string") return json.error;
    if (json.error && typeof json.error === "object" && json.error.message) return json.error.message;
  } catch {
    // Spotify sometimes returns plain text.
  }
  return text.trim() || `Spotify antwortet mit ${response.status}.`;
}
