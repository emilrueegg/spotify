import { isRuleBucket, type Rule } from "@/lib/classify";
import { loadRules, replaceRules } from "@/lib/db";
import { errorResponse, HttpError, requireSession } from "@/lib/http";

export async function GET() {
  try {
    const session = await requireSession();
    return Response.json({ rules: loadRules(session.user_id) });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PUT(request: Request) {
  try {
    const session = await requireSession();
    const body = (await request.json()) as { rules?: unknown };
    if (!Array.isArray(body.rules)) throw new HttpError("Regeln fehlen.", 400);
    if (body.rules.length > 200) throw new HttpError("Höchstens 200 Regeln.", 400);
    const rules: Rule[] = [];
    const seen = new Set<string>();
    for (const entry of body.rules) {
      if (!entry || typeof entry !== "object") continue;
      const bucket = "bucket" in entry ? entry.bucket : null;
      const phrase = "phrase" in entry ? entry.phrase : null;
      if (typeof bucket !== "string" || typeof phrase !== "string" || !isRuleBucket(bucket)) continue;
      const trimmed = phrase.trim();
      if (!trimmed || trimmed.length > 80) continue;
      const key = `${bucket}:${trimmed.toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      rules.push({ bucket, phrase: trimmed });
    }
    replaceRules(session.user_id, rules);
    return Response.json({ rules: loadRules(session.user_id) });
  } catch (error) {
    return errorResponse(error);
  }
}
