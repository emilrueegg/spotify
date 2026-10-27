import { cookies } from "next/headers";
import { deleteSession } from "@/lib/db";
import { cookieBase, readSessionId, SESSION_COOKIE } from "@/lib/http";

export async function POST() {
  const sessionId = await readSessionId();
  if (sessionId) deleteSession(sessionId);
  const jar = await cookies();
  jar.set(SESSION_COOKIE, "", { ...cookieBase, maxAge: 0 });
  return Response.json({ ok: true });
}
