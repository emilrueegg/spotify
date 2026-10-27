import { cookies } from "next/headers";
import { connection } from "next/server";
import { getSession, type SessionRecord } from "./db";

export const SESSION_COOKIE = "reihe_sid";
export const OAUTH_COOKIE = "reihe_oauth";

export const cookieBase = {
  httpOnly: true,
  sameSite: "lax" as const,
  path: "/",
  secure: false,
};

export class HttpError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

export async function readSessionId(): Promise<string | null> {
  await connection();
  const jar = await cookies();
  return jar.get(SESSION_COOKIE)?.value ?? null;
}

export async function requireSession(): Promise<SessionRecord> {
  const id = await readSessionId();
  if (!id) throw new HttpError("Nicht angemeldet.", 401);
  const session = getSession(id);
  if (!session) throw new HttpError("Sitzung abgelaufen.", 401);
  return session;
}

export function errorResponse(error: unknown): Response {
  if (error instanceof HttpError) {
    return Response.json({ error: error.message }, { status: error.status });
  }
  const status = typeof error === "object" && error && "status" in error && typeof error.status === "number" ? error.status : 500;
  const message = error instanceof Error ? error.message : "Unerwarteter Fehler.";
  if (status >= 500) console.error(error);
  return Response.json({ error: message }, { status });
}
