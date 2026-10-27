import { appConfig } from "@/lib/config";
import { getSession, hasUndo, userMeta } from "@/lib/db";
import { readSessionId } from "@/lib/http";
import type { SessionResponse } from "@/lib/library-types";

export async function GET() {
  const config = appConfig();
  const base: SessionResponse = {
    configured: config.configured,
    redirectUri: config.redirectUri,
    lastfm: config.lastfm,
    authenticated: false,
    demo: false,
    displayName: null,
    hasUndo: false,
    genresAvailable: null,
    syncedAt: null,
  };
  const sessionId = await readSessionId();
  if (!sessionId) return Response.json(base);
  const session = getSession(sessionId);
  if (!session) return Response.json(base);
  const meta = userMeta(session.user_id);
  return Response.json({
    ...base,
    authenticated: true,
    demo: session.mode === "demo",
    displayName: session.display_name || meta?.displayName || null,
    hasUndo: hasUndo(session.id),
    genresAvailable: meta?.genresAvailable ?? null,
    syncedAt: meta?.syncedAt ?? null,
  } satisfies SessionResponse);
}
