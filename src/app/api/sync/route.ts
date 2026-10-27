import { errorResponse, requireSession } from "@/lib/http";
import { syncLibrary, type SyncEvent } from "@/lib/sync";

export async function POST() {
  try {
    const session = await requireSession();
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const send = (event: SyncEvent) => {
          controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
        };
        try {
          await syncLibrary(session, send);
        } catch (error) {
          const message = error instanceof Error ? error.message : "Abgleich fehlgeschlagen.";
          send({ phase: "error", message });
        } finally {
          controller.close();
        }
      },
    });
    return new Response(stream, {
      headers: {
        "Content-Type": "application/x-ndjson; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
