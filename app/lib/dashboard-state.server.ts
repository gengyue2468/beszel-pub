import type { DashboardData } from "~/lib/dashboard";
import {
  applyRtMetrics,
  applySystemRecord,
  applySystemStat,
  dashboardFromSystems,
  loadDashboardData,
  loadSystemChart,
  publicSystemFromRecord,
  type BeszelRealtimeEvent,
  type BeszelSystemRecord,
  type PublicSystem,
  type SystemStatPbRecord,
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

export function hasSystem(systemId: string) {
  return systems.has(systemId);
}

export function getSystem(systemId: string) {
  return systems.get(systemId);
}

export function isDashboardReady() {
  return ready;
}

export async function initDashboardState(): Promise<DashboardData> {
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

export async function reloadDashboardState(): Promise<DashboardData> {
  const data = await loadDashboardData();
  systems = new Map(data.systems.map((system) => [system.id, system]));
  ready = !data.error;
  return data;
}

export async function loadChartForSystem(systemId: string): Promise<DashboardData | null> {
  if (!ready || !systems.has(systemId)) return null;

  const bundle = await loadSystemChart(systemId);
  if (!systems.has(systemId)) return null;

  systems.set(systemId, { ...systems.get(systemId)!, ...bundle });
  return dashboardFromSystems([...systems.values()]);
}

export function applyEvent(event: BeszelRealtimeEvent): DashboardData | null {
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
    if (!id) return null;

    if (action === "delete") {
      systems.delete(id);
      return dashboardFromSystems([...systems.values()]);
    }

    const systemRecord = asSystemRecord(record);
    const existing = systems.get(id);
    systems.set(
      id,
      existing
        ? applySystemRecord(existing, systemRecord)
        : publicSystemFromRecord(systemRecord),
    );
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
