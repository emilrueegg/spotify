import { errorResponse, requireSession } from "@/lib/http";
import { undoTracks } from "@/lib/mutate";

export async function POST() {
  try {
    const session = await requireSession();
    const result = await undoTracks(session);
    return Response.json(result);
  } catch (error) {
    return errorResponse(error);
  }
}
