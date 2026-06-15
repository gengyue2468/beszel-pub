import type { BeszelCollectionEvent, BeszelRealtimeEvent } from "~/lib/beszel.server";
import { getBeszelAuthToken, getBeszelUrl } from "~/lib/beszel.server";

const RETRY_MS = 3_000;

type RealtimeListener = (event: BeszelRealtimeEvent) => void;

const listeners = new Set<RealtimeListener>();
let subscribedSystemIds: string[] = [];
let abortController: AbortController | null = null;
let loopPromise: Promise<void> | null = null;
let activeClientId: string | null = null;
let activeToken: string | null = null;

function rtMetricsTopic(systemId: string) {
  return `rt_metrics?options=${encodeURIComponent(JSON.stringify({ query: { system: systemId } }))}`;
}

function buildSubscriptions() {
  return [
    "systems/*",
    "system_stats/*",
    ...subscribedSystemIds.map(rtMetricsTopic),
  ];
}

function systemIdFromRtMetricsTopic(topic: string) {
  const marker = "?options=";
  const index = topic.indexOf(marker);
  if (index === -1) return null;

  try {
    const options = JSON.parse(decodeURIComponent(topic.slice(index + marker.length))) as {
      query?: { system?: string };
    };
    return options.query?.system ?? null;
  } catch {
    return null;
  }
}

function collectionFromTopic(topic: string): BeszelCollectionEvent["collection"] | null {
  if (topic.startsWith("system_stats")) return "system_stats";
  if (topic.startsWith("systems")) return "systems";
  return null;
}

function notifyListeners(event: BeszelRealtimeEvent) {
  for (const listener of listeners) {
    listener(event);
  }
}

async function setSubscriptions(clientId: string, token: string) {
  const url = getBeszelUrl();
  const response = await fetch(`${url}/api/realtime`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: token,
    },
    body: JSON.stringify({
      clientId,
      subscriptions: buildSubscriptions(),
    }),
  });

  if (!response.ok) {
    throw new Error(`Beszel realtime subscribe failed (${response.status})`);
  }

  activeClientId = clientId;
  activeToken = token;
}

export function setBeszelSystemIds(systemIds: string[]) {
  const next = [...new Set(systemIds)].sort();
  if (next.join() === subscribedSystemIds.join()) return;

  subscribedSystemIds = next;

  if (activeClientId && activeToken) {
    void (async () => {
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          await setSubscriptions(activeClientId!, activeToken!);
          return;
        } catch (error) {
          console.error("[beszel-pub] Beszel realtime resubscribe failed:", error);
          if (attempt === 2) return;
          await new Promise((resolve) => setTimeout(resolve, RETRY_MS));
        }
      }
    })();
  }
}

function parseSseEvent(block: string) {
  let event = "message";
  const dataLines: string[] = [];

  for (const line of block.split("\n")) {
    if (line.startsWith("event:")) event = line.slice(6).trim();
    else if (line.startsWith("data:")) dataLines.push(line.slice(5).trim());
  }

  if (dataLines.length === 0) return null;
  return { event, data: dataLines.join("\n") };
}

function parseCollectionEvent(
  topic: string,
  raw: string,
): BeszelRealtimeEvent | null {
  const payload = JSON.parse(raw) as {
    action: BeszelCollectionEvent["action"];
    record: Record<string, unknown> & { collectionName?: string };
  };

  const collection =
    collectionFromTopic(topic) ??
    (payload.record.collectionName === "systems"
      ? "systems"
      : payload.record.collectionName === "system_stats"
        ? "system_stats"
        : null);

  if (!collection) return null;

  return {
    kind: "collection",
    collection,
    action: payload.action,
    record: payload.record,
  };
}

function parseRtMetricsEvent(topic: string, raw: string): BeszelRealtimeEvent | null {
  const systemId = systemIdFromRtMetricsTopic(topic);
  if (!systemId) return null;

  return {
    kind: "rt_metrics",
    systemId,
    data: JSON.parse(raw),
  };
}

function parseRealtimeEvent(topic: string, raw: string): BeszelRealtimeEvent | null {
  if (topic.startsWith("rt_metrics")) {
    return parseRtMetricsEvent(topic, raw);
  }
  return parseCollectionEvent(topic, raw);
}

async function readRealtimeStream(signal: AbortSignal) {
  const url = getBeszelUrl();
  const token = await getBeszelAuthToken();
  const response = await fetch(`${url}/api/realtime`, {
    headers: { Accept: "text/event-stream" },
    signal,
  });

  if (!response.ok || !response.body) {
    throw new Error(`Beszel realtime connect failed (${response.status})`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let subscribed = false;

  while (!signal.aborted) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    let splitAt = buffer.indexOf("\n\n");
    while (splitAt !== -1) {
      const block = buffer.slice(0, splitAt);
      buffer = buffer.slice(splitAt + 2);
      splitAt = buffer.indexOf("\n\n");

      const parsed = parseSseEvent(block);
      if (!parsed) continue;

      if (parsed.event === "PB_CONNECT") {
        const { clientId } = JSON.parse(parsed.data) as { clientId: string };
        await setSubscriptions(clientId, token);
        subscribed = true;
        continue;
      }

      if (!subscribed) continue;

      try {
        const event = parseRealtimeEvent(parsed.event, parsed.data);
        if (event) notifyListeners(event);
      } catch (error) {
        console.error("[beszel-pub] Beszel realtime parse error:", error);
      }
    }
  }
}

async function runRealtimeLoop() {
  while (listeners.size > 0) {
    abortController = new AbortController();
    activeClientId = null;
    activeToken = null;
    try {
      await readRealtimeStream(abortController.signal);
    } catch (error) {
      if (abortController.signal.aborted) return;
      console.error("[beszel-pub] Beszel realtime error:", error);
    }

    if (listeners.size === 0) return;
    await new Promise((resolve) => setTimeout(resolve, RETRY_MS));
  }
}

function ensureRealtimeLoop() {
  if (loopPromise) return;
  loopPromise = runRealtimeLoop().finally(() => {
    loopPromise = null;
    abortController = null;
    activeClientId = null;
    activeToken = null;
  });
}

function stopRealtimeLoop() {
  abortController?.abort();
}

export function subscribeBeszelChanges(listener: RealtimeListener) {
  listeners.add(listener);
  ensureRealtimeLoop();
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) stopRealtimeLoop();
  };
}
