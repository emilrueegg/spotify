import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { appConfig, SPOTIFY_SCOPES } from "@/lib/config";
import { cookieBase, OAUTH_COOKIE } from "@/lib/http";

export async function GET() {
  await connection();
  const config = appConfig();
  if (!config.configured) redirect("/?fehler=config");
  const state = randomBytes(16).toString("hex");
  const jar = await cookies();
  jar.set(OAUTH_COOKIE, state, { ...cookieBase, maxAge: 60 * 10 });
  const url = new URL("https://accounts.spotify.com/authorize");
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("scope", SPOTIFY_SCOPES.join(" "));
  url.searchParams.set("redirect_uri", config.redirectUri);
  url.searchParams.set("state", state);
  redirect(url.toString());
}
