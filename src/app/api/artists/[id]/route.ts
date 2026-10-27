import { isOverrideBucket } from "@/lib/classify";
import { setArtistOverride } from "@/lib/db";
import { errorResponse, HttpError, requireSession } from "@/lib/http";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSession();
    const { id } = await context.params;
    const body = (await request.json()) as { override?: unknown };
    const override =
      body.override == null ? null : typeof body.override === "string" && isOverrideBucket(body.override) ? body.override : undefined;
    if (override === undefined) throw new HttpError("Unbekannte Korrektur.", 400);
    const updated = setArtistOverride(session.user_id, decodeURIComponent(id), override);
    if (!updated) throw new HttpError("Künstler nicht gefunden.", 404);
    return Response.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
