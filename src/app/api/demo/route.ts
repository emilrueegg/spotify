import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { buildDemoSnapshot, DEMO_USER_ID } from "@/lib/demo-data";
import { createSession, ensureUser, replaceLibrary, resetDemoUser, touchSynced } from "@/lib/db";
import { cookieBase, errorResponse, SESSION_COOKIE } from "@/lib/http";

export async function POST() {
  try {
    resetDemoUser(DEMO_USER_ID);
    ensureUser({ id: DEMO_USER_ID, mode: "demo", displayName: "Beispiel" });
    replaceLibrary(DEMO_USER_ID, buildDemoSnapshot());
    touchSynced(DEMO_USER_ID);
    const sessionId = randomUUID();
    createSession({
      id: sessionId,
      userId: DEMO_USER_ID,
      mode: "demo",
      displayName: "Beispiel",
    });
    const jar = await cookies();
    jar.set(SESSION_COOKIE, sessionId, { ...cookieBase, maxAge: 60 * 60 * 24 * 30 });
    return Response.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
