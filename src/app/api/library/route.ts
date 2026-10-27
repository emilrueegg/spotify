import { loadLibrary, userMeta } from "@/lib/db";
import { errorResponse, requireSession } from "@/lib/http";

export async function GET() {
  try {
    const session = await requireSession();
    const library = loadLibrary(session.user_id);
    const meta = userMeta(session.user_id);
    return Response.json({
      tracks: library.tracks,
      playlists: library.playlists,
      syncedAt: meta?.syncedAt ?? null,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
