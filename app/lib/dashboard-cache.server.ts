import type { DashboardData } from "~/lib/dashboard";
import {
  applySystemRecord,
  applySystemStat,
  applyRtMetrics,
  dashboardFromSystems,
  loadSystemHistoryBundle,
  publicSystemFromRecord,
  type BeszelRealtimeEvent,
  type BeszelSystemRecord,
  type PublicSystem,
  type SystemStatPbRecord,
  loadDashboardData,
} from "~/lib/beszel.server";

let systems = new Map<string, PublicSystem>();
let ready = false;
let initPromise: Promise<DashboardData> | null = null;

function asSystemRecord(record: Record<string, unknown>): BeszelSystemRecord {
  return record as unknown as BeszelSystemRecord;
}

function asStatRecord(record: Record<string, unknown>): SystemStatPbRecord {
  return record as unknown as SystemStatPbRecord;
}

function systemIdFromRecord(record: Record<string, unknown>) {
  return String(record.id ?? "");
}

export function hasCachedSystem(systemId: string) {
  return systems.has(systemId);
}

export async function ensureDashboardCache(): Promise<DashboardData> {
  if (ready) return dashboardFromSystems([...systems.values()]);

  if (!initPromise) {
    initPromise = loadDashboardData().then((data) => {
      systems = new Map(data.systems.map((system) => [system.id, system]));
      ready = !data.error;
      return data;
    });
  }

  return initPromise;
}

export async function refreshDashboardCache(): Promise<DashboardData> {
  const data = await loadDashboardData();
  systems = new Map(data.systems.map((system) => [system.id, system]));
  ready = !data.error;
  return data;
}

export async function mergeSystemHistoryInCache(
  systemId: string,
): Promise<DashboardData | null> {
  if (!ready || !systems.has(systemId)) return null;

  const bundle = await loadSystemHistoryBundle(systemId);
  if (!systems.has(systemId)) return null;

  const existing = systems.get(systemId)!;
  systems.set(systemId, {
    ...existing,
    history: bundle.history,
    network: bundle.network ?? existing.network,
    rates: bundle.rates ?? existing.rates,
    live: bundle.live ?? existing.live,
  });
  return dashboardFromSystems([...systems.values()]);
}

export function applyDashboardEvent(event: BeszelRealtimeEvent): DashboardData | null {
  if (!ready) return null;

  if (event.kind === "rt_metrics") {
    const existing = systems.get(event.systemId);
    if (!existing) return null;

    systems.set(event.systemId, applyRtMetrics(existing, event.data));
    return dashboardFromSystems([...systems.values()]);
  }

  const { collection, action, record } = event;

  if (collection === "systems") {
    const id = systemIdFromRecord(record);
    if (!id) return null;

    if (action === "delete") {
      systems.delete(id);
      return dashboardFromSystems([...systems.values()]);
    }

    const systemRecord = asSystemRecord(record);

    if (action === "create" || !systems.has(id)) {
      const existing = systems.get(id);
      systems.set(
        id,
        existing
          ? applySystemRecord(existing, systemRecord)
          : publicSystemFromRecord(systemRecord),
      );
      return dashboardFromSystems([...systems.values()]);
    }

    systems.set(id, applySystemRecord(systems.get(id)!, systemRecord));
    return dashboardFromSystems([...systems.values()]);
  }

  if (collection === "system_stats") {
    const stat = asStatRecord(record);
    const existing = systems.get(stat.system);
    if (!existing) return null;

    const updated = applySystemStat(existing, stat);
    if (!updated) return null;

    systems.set(stat.system, updated);
    return dashboardFromSystems([...systems.values()]);
  }

  return null;
}

export function getDashboardSnapshot(): DashboardData | null {
  if (!ready) return null;
  return dashboardFromSystems([...systems.values()]);
}
