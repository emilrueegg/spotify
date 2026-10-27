import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { appConfig } from "@/lib/config";
import { createSession, ensureUser } from "@/lib/db";
import { cookieBase, OAUTH_COOKIE, SESSION_COOKIE } from "@/lib/http";

export async function GET(request: Request) {
  await connection();
  const url = new URL(request.url);
  const oauthError = url.searchParams.get("error");
  if (oauthError === "access_denied") redirect("/?fehler=access_denied");
  if (oauthError) redirect("/?fehler=token");

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const jar = await cookies();
  const expected = jar.get(OAUTH_COOKIE)?.value;
  jar.delete(OAUTH_COOKIE);
  if (!code || !state || !expected || state !== expected) redirect("/?fehler=state");

  const config = appConfig();
  if (!config.configured) redirect("/?fehler=config");

  try {
    const tokenResponse = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${config.clientId}:${config.clientSecret}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: config.redirectUri,
      }),
      cache: "no-store",
    });
    if (!tokenResponse.ok) redirect("/?fehler=token");
    const token = (await tokenResponse.json()) as {
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
    };
    if (!token.access_token) redirect("/?fehler=token");
    const profileResponse = await fetch("https://api.spotify.com/v1/me", {
      headers: { Authorization: `Bearer ${token.access_token}` },
      cache: "no-store",
    });
    if (!profileResponse.ok) redirect("/?fehler=token");
    const profile = (await profileResponse.json()) as { id?: string; display_name?: string };
    if (!profile.id) redirect("/?fehler=token");
    const displayName = profile.display_name || profile.id;
    ensureUser({ id: profile.id, mode: "spotify", displayName, spotifyId: profile.id });
    const sessionId = randomUUID();
    createSession({
      id: sessionId,
      userId: profile.id,
      mode: "spotify",
      displayName,
      accessToken: token.access_token,
      refreshToken: token.refresh_token ?? null,
      expiresAt: Date.now() + (token.expires_in ?? 3600) * 1000,
    });
    jar.set(SESSION_COOKIE, sessionId, { ...cookieBase, maxAge: 60 * 60 * 24 * 30 });
  } catch (error) {
    if (isRedirect(error)) throw error;
    redirect("/?fehler=token");
  }
  redirect("/");
}

function isRedirect(error: unknown): boolean {
  return typeof error === "object" && error !== null && "digest" in error && String((error as { digest?: string }).digest).startsWith("NEXT_REDIRECT");
}
