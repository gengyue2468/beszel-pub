import type { DashboardData } from "~/lib/dashboard";
import {
  applyDashboardEvent,
  ensureDashboardCache,
  hasCachedSystem,
  mergeSystemHistoryInCache,
  refreshDashboardCache,
} from "~/lib/dashboard-cache.server";
import { subscribeBeszelChanges, setBeszelSystemIds } from "~/lib/beszel-realtime.server";

type StreamClient = {
  push: (chunk: string) => void;
  close: () => void;
};

const clients = new Set<StreamClient>();
let lastData: DashboardData | null = null;
let pingTimer: ReturnType<typeof setInterval> | null = null;
let unsubscribeBeszel: (() => void) | null = null;
let refreshPromise: Promise<void> | null = null;
let hubStarting: Promise<void> | null = null;
let refreshGeneration = 0;
const pendingHistory = new Set<string>();

function encodeEvent(data: DashboardData) {
  return `data: ${JSON.stringify(data)}\n\n`;
}

function broadcast(data: DashboardData) {
  lastData = data;
  const chunk = encodeEvent(data);
  for (const client of clients) {
    try {
      client.push(chunk);
    } catch {
      clients.delete(client);
    }
  }
}

function syncSystemSubscriptions(data: DashboardData) {
  setBeszelSystemIds(data.systems.map((system) => system.id));
}

function invalidatePendingRefresh() {
  refreshGeneration++;
}

async function fullRefresh() {
  if (refreshPromise) return refreshPromise;

  const generation = refreshGeneration;

  refreshPromise = refreshDashboardCache()
    .then((data) => {
      if (generation !== refreshGeneration) return;
      syncSystemSubscriptions(data);
      broadcast(data);
    })
    .finally(() => {
      refreshPromise = null;
    });

  return refreshPromise;
}

function shouldInvalidateRefresh(
  event: Parameters<typeof applyDashboardEvent>[0],
  existedBefore: boolean,
) {
  if (event.kind !== "collection" || event.collection !== "systems") return false;
  if (event.action === "delete") return true;
  if (event.action === "create") return !existedBefore;
  return event.action === "update" && !existedBefore;
}

function scheduleHistoryLoad(systemId: string) {
  if (pendingHistory.has(systemId)) return;
  pendingHistory.add(systemId);
  void mergeSystemHistoryInCache(systemId)
    .then((data) => {
      if (!data) return;
      broadcast(data);
    })
    .finally(() => {
      pendingHistory.delete(systemId);
    });
}

function handleBeszelEvent(event: Parameters<typeof applyDashboardEvent>[0]) {
  const isSystems =
    event.kind === "collection" && event.collection === "systems";
  const systemId = isSystems ? String(event.record.id ?? "") : "";
  const existedBefore = systemId !== "" && hasCachedSystem(systemId);

  if (isSystems && event.action === "delete" && systemId) {
    pendingHistory.delete(systemId);
  }

  if (shouldInvalidateRefresh(event, existedBefore)) {
    invalidatePendingRefresh();
  }

  const updated = applyDashboardEvent(event);
  if (updated) {
    if (isSystems) {
      syncSystemSubscriptions(updated);
      broadcast(updated);
      if (event.action !== "delete" && systemId && !existedBefore) {
        scheduleHistoryLoad(systemId);
      }
      return;
    }

    broadcast(updated);
    return;
  }

  if (isSystems) void fullRefresh();
}

function startHub() {
  if (unsubscribeBeszel || hubStarting) return;

  hubStarting = (async () => {
    try {
      const data = await ensureDashboardCache();
      syncSystemSubscriptions(data);
      broadcast(data);
      unsubscribeBeszel = subscribeBeszelChanges(handleBeszelEvent);
    } finally {
      hubStarting = null;
    }
  })();

  pingTimer = setInterval(() => {
    for (const client of clients) {
      try {
        client.push(": ping\n\n");
      } catch {
        clients.delete(client);
      }
    }
  }, 30_000);
}

function stopHub() {
  if (clients.size > 0) return;

  unsubscribeBeszel?.();
  unsubscribeBeszel = null;

  if (pingTimer) clearInterval(pingTimer);
  pingTimer = null;
}

export function subscribeDashboardStream(request: Request) {
  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();
      const client: StreamClient = {
        push(chunk) {
          try {
            controller.enqueue(encoder.encode(chunk));
          } catch {
            clients.delete(client);
          }
        },
        close() {
          controller.close();
        },
      };

      clients.add(client);
      startHub();

      if (lastData) {
        client.push(encodeEvent(lastData));
      }

      request.signal.addEventListener("abort", () => {
        clients.delete(client);
        stopHub();
        try {
          client.close();
        } catch {
          // already closed
        }
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
