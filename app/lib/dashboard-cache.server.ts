import type { DashboardData } from "~/lib/dashboard";
import {
  applySystemRecord,
  applySystemStat,
  applyRtMetrics,
  dashboardFromSystems,
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
    const id = String(record.id ?? "");

    if (action === "delete") {
      systems.delete(id);
      return dashboardFromSystems([...systems.values()]);
    }

    if (action === "create" || !systems.has(id)) {
      return null;
    }

    systems.set(id, applySystemRecord(systems.get(id)!, asSystemRecord(record)));
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
