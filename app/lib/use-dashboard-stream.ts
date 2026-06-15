import { useEffect, useRef, useState } from "react";
import type { DashboardData } from "~/lib/dashboard";
import { mergeDashboardProfiles } from "~/lib/merge-dashboard";
import type { SystemProfile } from "~/lib/beszel.server";

const MIN_RETRY_MS = 1_000;
const MAX_RETRY_MS = 30_000;

export function useDashboardStream(
  profiles: SystemProfile[],
  onData: (data: DashboardData) => void,
) {
  const [connected, setConnected] = useState(false);
  const profilesRef = useRef(profiles);
  const onDataRef = useRef(onData);
  profilesRef.current = profiles;
  onDataRef.current = onData;

  useEffect(() => {
    let source: EventSource | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let retryMs = MIN_RETRY_MS;
    let pending: DashboardData | null = null;
    let frame = 0;
    let stopped = false;

    const flush = () => {
      frame = 0;
      if (!pending) return;
      const next = pending;
      pending = null;
      onDataRef.current(next);
    };

    const scheduleReconnect = () => {
      if (stopped || retryTimer) return;
      const delay = retryMs;
      retryTimer = setTimeout(() => {
        retryTimer = null;
        retryMs = Math.min(retryMs * 2, MAX_RETRY_MS);
        connect();
      }, delay);
    };

    const connect = () => {
      if (stopped) return;
      source?.close();
      source = new EventSource("/api/systems/stream");

      source.onopen = () => {
        retryMs = MIN_RETRY_MS;
        setConnected(true);
      };

      source.onmessage = (event) => {
        retryMs = MIN_RETRY_MS;
        setConnected(true);
        pending = mergeDashboardProfiles(
          JSON.parse(event.data) as DashboardData,
          profilesRef.current,
        );
        if (!frame) frame = requestAnimationFrame(flush);
      };

      source.onerror = () => {
        setConnected(false);
        source?.close();
        source = null;
        scheduleReconnect();
      };
    };

    const onVisible = () => {
      if (document.visibilityState !== "visible" || stopped) return;
      if (source?.readyState === EventSource.OPEN) return;
      if (retryTimer) {
        clearTimeout(retryTimer);
        retryTimer = null;
      }
      retryMs = MIN_RETRY_MS;
      connect();
    };

    connect();
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      stopped = true;
      document.removeEventListener("visibilitychange", onVisible);
      if (frame) cancelAnimationFrame(frame);
      if (retryTimer) clearTimeout(retryTimer);
      source?.close();
    };
  }, []);

  return connected;
}
