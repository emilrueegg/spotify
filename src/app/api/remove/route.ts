import { errorResponse, requireSession } from "@/lib/http";
import { removeTracks } from "@/lib/mutate";

export async function POST(request: Request) {
  try {
    const session = await requireSession();
    const body = (await request.json()) as {
      trackIds?: unknown;
      unlike?: unknown;
      playlistIds?: unknown;
    };
    const trackIds = Array.isArray(body.trackIds) ? body.trackIds.filter((id): id is string => typeof id === "string") : [];
    const playlistIds = Array.isArray(body.playlistIds)
      ? body.playlistIds.filter((id): id is string => typeof id === "string")
      : [];
    const result = await removeTracks(session, {
      trackIds,
      unlike: body.unlike === true,
      playlistIds,
    });
    return Response.json(result);
  } catch (error) {
    return errorResponse(error);
  }
}
