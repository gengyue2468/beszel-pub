import type { DashboardData } from "~/lib/dashboard";
import {
  applyDashboardEvent,
  ensureDashboardCache,
  refreshDashboardCache,
} from "~/lib/dashboard-cache.server";
import { subscribeBeszelChanges, setBeszelSystemIds } from "~/lib/beszel-realtime.server";

type StreamClient = {
  push: (chunk: string) => void;
  close: () => void;
};

const BROADCAST_MS = 500;

const clients = new Set<StreamClient>();
let lastData: DashboardData | null = null;
let pendingBroadcast: DashboardData | null = null;
let broadcastTimer: ReturnType<typeof setTimeout> | null = null;
let pingTimer: ReturnType<typeof setInterval> | null = null;
let unsubscribeBeszel: (() => void) | null = null;
let refreshPromise: Promise<void> | null = null;

function encodeEvent(data: DashboardData) {
  return `data: ${JSON.stringify(data)}\n\n`;
}

function flushBroadcast(data: DashboardData) {
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

function broadcast(data: DashboardData, immediate = false) {
  if (immediate) {
    if (broadcastTimer) {
      clearTimeout(broadcastTimer);
      broadcastTimer = null;
    }
    pendingBroadcast = null;
    flushBroadcast(data);
    return;
  }

  pendingBroadcast = data;
  if (broadcastTimer) return;

  broadcastTimer = setTimeout(() => {
    broadcastTimer = null;
    if (!pendingBroadcast) return;
    const next = pendingBroadcast;
    pendingBroadcast = null;
    flushBroadcast(next);
  }, BROADCAST_MS);
}

async function fullRefresh() {
  if (refreshPromise) return refreshPromise;

  refreshPromise = refreshDashboardCache()
    .then((data) => {
      setBeszelSystemIds(data.systems.map((system) => system.id));
      broadcast(data, true);
    })
    .finally(() => {
      refreshPromise = null;
    });

  return refreshPromise;
}

function handleBeszelEvent(event: Parameters<typeof applyDashboardEvent>[0]) {
  if (
    event.kind === "collection" &&
    event.collection === "systems" &&
    event.action === "create"
  ) {
    void fullRefresh();
    return;
  }

  const updated = applyDashboardEvent(event);
  if (updated) {
    broadcast(updated);
    return;
  }

  if (event.kind === "collection" && event.collection === "systems") {
    void fullRefresh();
  }
}

function startHub() {
  if (unsubscribeBeszel) return;

  unsubscribeBeszel = subscribeBeszelChanges(handleBeszelEvent);
  void ensureDashboardCache().then((data) => {
    setBeszelSystemIds(data.systems.map((system) => system.id));
    broadcast(data, true);
  });

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

  if (broadcastTimer) clearTimeout(broadcastTimer);
  broadcastTimer = null;
  pendingBroadcast = null;
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
