import { NextRequest } from "next/server";
import {
  freshnessBroadcaster,
  type FreshnessEventPayload,
} from "@/lib/hubble/freshness";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const HEARTBEAT_INTERVAL_MS = 25_000;
const MAX_CONNECTION_LIFETIME_MS = 300_000; // 5 minutes max connection lifetime

export async function GET(req: NextRequest): Promise<Response> {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      let isClosed = false;

      function safeEnqueue(chunk: string): void {
        if (isClosed) return;
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          cleanup();
        }
      }

      function sendEvent(event: string, data: unknown): void {
        safeEnqueue(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
      }

      function sendComment(comment: string): void {
        safeEnqueue(`: ${comment}\n\n`);
      }

      function cleanup(): void {
        if (isClosed) return;
        isClosed = true;
        clearInterval(heartbeatInterval);
        clearTimeout(maxLifetimeTimeout);
        freshnessBroadcaster.off("change", onFreshnessChange);
        try {
          controller.close();
        } catch {
          // Ignore if already closed
        }
      }

      // 1. Initial snapshot of current cache freshness epoch
      const initial = freshnessBroadcaster.getFreshnessState();
      sendEvent("freshness", initial);

      // 2. Broadcast listener for cache rotations
      const onFreshnessChange = (payload: FreshnessEventPayload) => {
        sendEvent("freshness", payload);
      };

      freshnessBroadcaster.on("change", onFreshnessChange);

      // 3. Heartbeat comments to keep connection alive through proxies
      const heartbeatInterval = setInterval(() => {
        sendComment("ping");
      }, HEARTBEAT_INTERVAL_MS);

      // 4. Bounded connection lifetime to prevent leaked sockets
      const maxLifetimeTimeout = setTimeout(() => {
        cleanup();
      }, MAX_CONNECTION_LIFETIME_MS);

      // 5. Handle client disconnect / cancellation
      req.signal.addEventListener("abort", () => {
        cleanup();
      });
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform, no-store, must-revalidate",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
