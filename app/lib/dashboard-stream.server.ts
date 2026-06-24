import type { DashboardData } from "~/lib/dashboard";
import {
  applyEvent,
  hasSystem,
  initDashboardState,
  loadChartForSystem,
  reloadDashboardState,
} from "~/lib/dashboard-state.server";
import { subscribeBeszelChanges, setBeszelSystemIds } from "~/lib/beszel-realtime.server";

type StreamClient = {
  push: (chunk: string) => void;
  close: () => void;
};

const clients = new Set<StreamClient>();
let lastData: DashboardData | null = null;
let pingTimer: ReturnType<typeof setInterval> | null = null;
let unsubscribeBeszel: (() => void) | null = null;
let hubStarting: Promise<void> | null = null;
let reloadPromise: Promise<void> | null = null;
let reloadGeneration = 0;
const pendingCharts = new Set<string>();

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

function syncSubscriptions(data: DashboardData) {
  setBeszelSystemIds(data.systems.map((system) => system.id));
}

function invalidateReload() {
  reloadGeneration++;
}

async function reloadAll() {
  if (reloadPromise) return reloadPromise;

  const generation = reloadGeneration;
  reloadPromise = reloadDashboardState()
    .then((data) => {
      if (generation !== reloadGeneration) return;
      syncSubscriptions(data);
      broadcast(data);
    })
    .finally(() => {
      reloadPromise = null;
    });

  return reloadPromise;
}

function scheduleChartLoad(systemId: string) {
  if (pendingCharts.has(systemId)) return;
  pendingCharts.add(systemId);
  void loadChartForSystem(systemId)
    .then((data) => {
      if (data) broadcast(data);
    })
    .finally(() => {
      pendingCharts.delete(systemId);
    });
}

function handleEvent(event: Parameters<typeof applyEvent>[0]) {
  const isSystems = event.kind === "collection" && event.collection === "systems";
  const systemId = isSystems ? String(event.record.id ?? "") : "";
  const existed = systemId !== "" && hasSystem(systemId);

  if (isSystems && event.action === "delete" && systemId) {
    pendingCharts.delete(systemId);
  }

  if (
    isSystems &&
    (event.action === "delete" ||
      (event.action === "create" && !existed) ||
      (event.action === "update" && !existed))
  ) {
    invalidateReload();
  }

  const updated = applyEvent(event);
  if (updated) {
    if (isSystems) {
      syncSubscriptions(updated);
      broadcast(updated);
      if (event.action !== "delete" && systemId && !existed) {
        scheduleChartLoad(systemId);
      }
      return;
    }
    broadcast(updated);
    return;
  }

  if (isSystems) void reloadAll();
}

function startHub() {
  if (unsubscribeBeszel || hubStarting) return;

  hubStarting = (async () => {
    try {
      const data = await initDashboardState();
      syncSubscriptions(data);
      broadcast(data);
      unsubscribeBeszel = subscribeBeszelChanges(handleEvent);
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
