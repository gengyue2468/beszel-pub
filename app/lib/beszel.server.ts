import type { AxiosInstance } from "axios";
import type { DashboardData } from "~/lib/dashboard";
import { loadEnvFile } from "~/lib/env.server";
import { createHttpClient, HttpError, setAuthToken } from "~/lib/http.server";

loadEnvFile();

export interface PublicSystemInfo {
  cpu?: number;
  mp?: number;
  dp?: number;
  u?: number;
  la?: [number, number, number];
  l1?: number;
  l5?: number;
  l15?: number;
  g?: number;
  sv?: [number, number];
}

export interface BeszelSystemInfo {
  cpu?: number;
  mp?: number;
  dp?: number;
  u?: number;
  b?: number;
  o?: string;
  os?: number;
  m?: string;
  c?: number;
  k?: string;
  la?: [number, number, number];
  l1?: number;
  l5?: number;
  l15?: number;
  g?: number;
  t?: number;
  sv?: [number, number];
  bb?: [number, number];
}

interface SystemStatsPayload {
  cpu?: number;
  mp?: number;
  m?: number;
  mu?: number;
  d?: number;
  du?: number;
  s?: number;
  su?: number;
  dr?: number;
  dw?: number;
  ns?: number;
  nr?: number;
  b?: [number, number];
  dio?: [number, number];
  la?: [number, number, number];
  l1?: number;
  l5?: number;
  l15?: number;
  ni?: Record<string, [number, number, number, number]>;
}

export interface BeszelSystemRecord {
  id: string;
  name: string;
  host: string;
  status: string;
  info?: BeszelSystemInfo;
  version?: string;
  updated: string;
}

interface SystemStatRecord {
  created?: string;
  stats?: SystemStatsPayload;
}

export interface SystemStatPbRecord {
  id: string;
  system: string;
  type?: string;
  created?: string;
  stats?: SystemStatsPayload;
}

export type BeszelCollectionEvent = {
  kind: "collection";
  collection: "systems" | "system_stats";
  action: "create" | "update" | "delete";
  record: Record<string, unknown>;
};

export interface RtMetricsPayload {
  stats?: SystemStatsPayload;
  info?: BeszelSystemInfo;
}

export type BeszelRtMetricsEvent = {
  kind: "rt_metrics";
  systemId: string;
  data: RtMetricsPayload;
};

export type BeszelRealtimeEvent = BeszelCollectionEvent | BeszelRtMetricsEvent;

export interface SystemSpec {
  cpu?: string;
  cores?: number;
  threads?: number;
  memoryBytes?: number;
  kernel?: string;
  arch?: string;
}

export interface SystemLiveStats {
  memTotalGb?: number;
  memUsedGb?: number;
  diskTotalGb?: number;
  diskUsedGb?: number;
  swapTotalGb?: number;
  swapUsedGb?: number;
}

export interface NetworkTotals {
  upload: number;
  download: number;
}

export interface IoRates {
  diskRead?: number;
  diskWrite?: number;
  netSent?: number;
  netRecv?: number;
}

export type HistoryValue = number | null;

export interface SystemHistory {
  times: string[];
  cpu: HistoryValue[];
  mem: HistoryValue[];
  swap: HistoryValue[];
  diskRead: HistoryValue[];
  diskWrite: HistoryValue[];
  netSent: HistoryValue[];
  netRecv: HistoryValue[];
}

interface SystemDetailsRecord {
  id: string;
  system: string;
  hostname: string;
  kernel: string;
  cores: number;
  threads: number;
  cpu: string;
  os_name: string;
  memory: number;
  podman: boolean;
  arch?: string;
}

export interface SystemProfile {
  id: string;
  name: string;
  os?: string;
  spec?: SystemSpec;
}

export interface PublicSystem {
  id: string;
  name: string;
  status: string;
  os?: string;
  spec?: SystemSpec;
  live?: SystemLiveStats;
  info?: PublicSystemInfo;
  updated: string;
  history: SystemHistory;
  network?: NetworkTotals;
  rates?: IoRates;
}

interface PocketBaseListResponse<T> {
  items: T[];
}

interface AuthResponse {
  token: string;
}

const HISTORY_POINTS = 20;
const STAT_INTERVAL_MS = 60_000;
const GAP_THRESHOLD_MS = STAT_INTERVAL_MS * 1.5;
const OS_NAMES = ["Linux", "macOS", "Windows", "FreeBSD"];

export const EMPTY_HISTORY: SystemHistory = {
  times: [],
  cpu: [],
  mem: [],
  swap: [],
  diskRead: [],
  diskWrite: [],
  netSent: [],
  netRecv: [],
};

function historyValuesFromStats(stats?: SystemStatsPayload) {
  return {
    cpu: stats?.cpu ?? null,
    mem: stats?.mp ?? null,
    swap: stats ? swapPct(stats) : null,
    diskRead: stats ? diskReadMb(stats) : null,
    diskWrite: stats ? diskWriteMb(stats) : null,
    netSent: stats ? netSentMb(stats) : null,
    netRecv: stats ? netRecvMb(stats) : null,
  };
}

function appendGapPoint(history: SystemHistory, gapTime: string): SystemHistory {
  return {
    times: [...history.times, gapTime],
    cpu: [...history.cpu, null],
    mem: [...history.mem, null],
    swap: [...history.swap, null],
    diskRead: [...history.diskRead, null],
    diskWrite: [...history.diskWrite, null],
    netSent: [...history.netSent, null],
    netRecv: [...history.netRecv, null],
  };
}

function trimHistory(history: SystemHistory): SystemHistory {
  if (history.times.length <= HISTORY_POINTS) return history;
  const trim = history.times.length - HISTORY_POINTS;
  return {
    times: history.times.slice(trim),
    cpu: history.cpu.slice(trim),
    mem: history.mem.slice(trim),
    swap: history.swap.slice(trim),
    diskRead: history.diskRead.slice(trim),
    diskWrite: history.diskWrite.slice(trim),
    netSent: history.netSent.slice(trim),
    netRecv: history.netRecv.slice(trim),
  };
}

function buildHistoryFromStatRecords(items: SystemStatRecord[]): SystemHistory {
  let history = EMPTY_HISTORY;

  for (const item of items) {
    const created = item.created;
    if (!created) continue;

    if (history.times.length > 0) {
      const lastTime = history.times[history.times.length - 1]!;
      const gapMs = new Date(created).getTime() - new Date(lastTime).getTime();
      if (gapMs > GAP_THRESHOLD_MS) {
        history = appendGapPoint(
          history,
          new Date(new Date(lastTime).getTime() + STAT_INTERVAL_MS).toISOString(),
        );
      }
    }

    const values = historyValuesFromStats(item.stats);
    history = {
      times: [...history.times, created],
      cpu: [...history.cpu, values.cpu],
      mem: [...history.mem, values.mem],
      swap: [...history.swap, values.swap],
      diskRead: [...history.diskRead, values.diskRead],
      diskWrite: [...history.diskWrite, values.diskWrite],
      netSent: [...history.netSent, values.netSent],
      netRecv: [...history.netRecv, values.netRecv],
    };
  }

  return trimHistory(history);
}

function appendStatToHistory(
  history: SystemHistory,
  created: string,
  stats: SystemStatsPayload,
): SystemHistory {
  const lastTime = history.times[history.times.length - 1];
  if (lastTime === created) return history;

  let next = history;
  if (lastTime) {
    const gapMs = new Date(created).getTime() - new Date(lastTime).getTime();
    if (gapMs > GAP_THRESHOLD_MS) {
      next = appendGapPoint(
        next,
        new Date(new Date(lastTime).getTime() + STAT_INTERVAL_MS).toISOString(),
      );
    }
  }

  const values = historyValuesFromStats(stats);
  return trimHistory({
    times: [...next.times, created],
    cpu: [...next.cpu, values.cpu],
    mem: [...next.mem, values.mem],
    swap: [...next.swap, values.swap],
    diskRead: [...next.diskRead, values.diskRead],
    diskWrite: [...next.diskWrite, values.diskWrite],
    netSent: [...next.netSent, values.netSent],
    netRecv: [...next.netRecv, values.netRecv],
  });
}

function swapPct(stats?: SystemStatsPayload) {
  if (!stats?.s) return 0;
  return ((stats.su ?? 0) / stats.s) * 100;
}

export function getBeszelUrl() {
  const url = process.env.BESZEL_URL?.replace(/\/$/, "");
  if (!url) throw new Error("Need BESZEL_URL environment variable");
  return url;
}

function getConfig() {
  const url = getBeszelUrl();
  const email = process.env.BESZEL_EMAIL;
  const password = process.env.BESZEL_PASSWORD;
  const token = process.env.BESZEL_TOKEN;

  if (!token && (!email || !password)) {
    throw new Error("Need BESZEL_TOKEN or BESZEL_EMAIL / BESZEL_PASSWORD");
  }

  return { url, email, password, token };
}

export async function getBeszelAuthToken() {
  const { email, password, token: envToken } = getConfig();
  if (envToken) return envToken;
  return getAuthToken(email!, password!);
}

function bytesPerSecToMb(bytesPerSec: number) {
  return bytesPerSec / 1024 / 1024;
}

function diskReadMb(stats?: SystemStatsPayload) {
  if (!stats) return 0;
  if (stats.dio != null) return bytesPerSecToMb(stats.dio[0] ?? 0);
  if (stats.dr != null) return stats.dr;
  return 0;
}

function diskWriteMb(stats?: SystemStatsPayload) {
  if (!stats) return 0;
  if (stats.dio != null) return bytesPerSecToMb(stats.dio[1] ?? 0);
  if (stats.dw != null) return stats.dw;
  return 0;
}

function netSentMb(stats?: SystemStatsPayload) {
  if (!stats) return 0;
  if (stats.b?.[0] != null) return bytesPerSecToMb(stats.b[0]);
  if (stats.ns != null) return stats.ns;
  if (stats.ni) {
    return bytesPerSecToMb(
      Object.values(stats.ni).reduce((sum, iface) => sum + (iface[0] ?? 0), 0),
    );
  }
  return 0;
}

function netRecvMb(stats?: SystemStatsPayload) {
  if (!stats) return 0;
  if (stats.b?.[1] != null) return bytesPerSecToMb(stats.b[1]);
  if (stats.nr != null) return stats.nr;
  if (stats.ni) {
    return bytesPerSecToMb(
      Object.values(stats.ni).reduce((sum, iface) => sum + (iface[1] ?? 0), 0),
    );
  }
  return 0;
}

function hasDiskIoFields(stats: SystemStatsPayload) {
  return stats.dio != null || stats.dr != null || stats.dw != null;
}

function parseDiskRates(
  stats?: SystemStatsPayload,
): Pick<IoRates, "diskRead" | "diskWrite"> | undefined {
  if (!stats || !hasDiskIoFields(stats)) return undefined;

  if (stats.dio != null) {
    return {
      diskRead: bytesPerSecToMb(stats.dio[0] ?? 0),
      diskWrite: bytesPerSecToMb(stats.dio[1] ?? 0),
    };
  }

  const out: Pick<IoRates, "diskRead" | "diskWrite"> = {};
  if (stats.dr != null) out.diskRead = stats.dr;
  if (stats.dw != null) out.diskWrite = stats.dw;
  return Object.keys(out).length > 0 ? out : undefined;
}

function parseNetRates(
  stats?: SystemStatsPayload,
): Pick<IoRates, "netSent" | "netRecv"> | undefined {
  if (!stats) return undefined;

  const out: Pick<IoRates, "netSent" | "netRecv"> = {};

  if (stats.b != null) {
    out.netSent = bytesPerSecToMb(stats.b[0]);
    out.netRecv = bytesPerSecToMb(stats.b[1]);
  } else if (stats.ni) {
    out.netSent = netSentMb(stats);
    out.netRecv = netRecvMb(stats);
  } else {
    if (stats.ns != null) out.netSent = stats.ns;
    if (stats.nr != null) out.netRecv = stats.nr;
  }

  return Object.keys(out).length > 0 ? out : undefined;
}

function parseIoRates(stats?: SystemStatsPayload): IoRates | undefined {
  const rates = { ...parseDiskRates(stats), ...parseNetRates(stats) };
  return Object.keys(rates).length > 0 ? rates : undefined;
}

function mergeIoRates(
  existing?: IoRates,
  incoming?: IoRates,
  info?: BeszelSystemInfo,
): IoRates | undefined {
  const out: IoRates = { ...existing };

  if (incoming) {
    if ("diskRead" in incoming && incoming.diskRead != null) {
      out.diskRead = incoming.diskRead;
    }
    if ("diskWrite" in incoming && incoming.diskWrite != null) {
      out.diskWrite = incoming.diskWrite;
    }
    if ("netSent" in incoming && incoming.netSent != null) {
      out.netSent = incoming.netSent;
    }
    if ("netRecv" in incoming && incoming.netRecv != null) {
      out.netRecv = incoming.netRecv;
    }
  }

  if (info?.bb) {
    if (out.netSent == null) out.netSent = bytesPerSecToMb(info.bb[0]);
    if (out.netRecv == null) out.netRecv = bytesPerSecToMb(info.bb[1]);
  }

  return Object.keys(out).length > 0 ? out : undefined;
}

function wrapError(message: string, error: unknown): never {
  if (error instanceof HttpError) {
    throw new Error(`${message} (${error.status}): ${error.message.replace(/^HTTP \d+: /, "")}`);
  }
  throw error;
}

async function getAuthToken(email: string, password: string) {
  const client = createHttpClient(getConfig().url);
  try {
    const { data } = await client.post<AuthResponse>(
      "/api/collections/users/auth-with-password",
      { identity: email, password },
    );
    return data.token;
  } catch (error) {
    wrapError("Beszel authentication failed", error);
  }
}

async function createAuthenticatedClient() {
  const client = createHttpClient(getConfig().url);
  setAuthToken(client, await getBeszelAuthToken());
  return client;
}

function sanitizePublicSpec(spec?: SystemSpec): SystemSpec | undefined {
  if (!spec) return undefined;

  const out: SystemSpec = {};
  if (spec.cpu != null) out.cpu = spec.cpu;
  if (spec.cores != null) out.cores = spec.cores;
  if (spec.threads != null) out.threads = spec.threads;
  if (spec.memoryBytes != null) out.memoryBytes = spec.memoryBytes;
  if (spec.kernel != null) out.kernel = spec.kernel;
  if (spec.arch != null) out.arch = spec.arch;

  return Object.keys(out).length > 0 ? out : undefined;
}

function osFromInfo(info?: BeszelSystemInfo) {
  return info?.o ?? (info?.os != null && OS_NAMES[info.os] ? OS_NAMES[info.os] : undefined);
}

function specFromInfo(info?: BeszelSystemInfo): SystemSpec | undefined {
  return specFromDetails(info);
}

function specFromDetails(
  info?: BeszelSystemInfo,
  details?: SystemDetailsRecord,
): SystemSpec | undefined {
  return sanitizePublicSpec({
    cpu: details?.cpu ?? info?.m,
    cores: details?.cores ?? info?.c,
    threads: details?.threads ?? info?.t,
    memoryBytes: details?.memory,
    kernel: details?.kernel ?? info?.k,
    arch: details?.arch,
  });
}

function mergeStaticSpec(next?: SystemSpec, prev?: SystemSpec): SystemSpec | undefined {
  if (!next && !prev) return undefined;
  return sanitizePublicSpec({ ...prev, ...next });
}

function toSystemProfile(
  record: BeszelSystemRecord,
  details?: SystemDetailsRecord,
): SystemProfile {
  return {
    id: record.id,
    name: record.name,
    os: details?.os_name ?? osFromInfo(record.info),
    spec: specFromDetails(record.info, details),
  };
}

async function fetchSystemDetailsMap(client: AxiosInstance) {
  try {
    const { data } = await client.get<PocketBaseListResponse<SystemDetailsRecord>>(
      "/api/collections/system_details/records",
      { params: { perPage: 500 } },
    );
    return new Map(data.items.map((item) => [item.system, item]));
  } catch {
    return new Map<string, SystemDetailsRecord>();
  }
}

export async function loadSystemProfiles(): Promise<SystemProfile[]> {
  const client = await createAuthenticatedClient();

  try {
    const [{ data }, detailsMap] = await Promise.all([
      client.get<PocketBaseListResponse<BeszelSystemRecord>>(
        "/api/collections/systems/records",
        { params: { sort: "name" } },
      ),
      fetchSystemDetailsMap(client),
    ]);

    return data.items.map((record) =>
      toSystemProfile(record, detailsMap.get(record.id)),
    );
  } catch (error) {
    wrapError("Failed to fetch system profiles", error);
  }
}

async function fetchSystemHistory(
  client: AxiosInstance,
  systemId: string,
): Promise<{
  history: SystemHistory;
  network?: NetworkTotals;
  rates?: IoRates;
  loadStats?: SystemStatsPayload;
  live?: SystemLiveStats;
}> {
  try {
    const { data } = await client.get<PocketBaseListResponse<SystemStatRecord>>(
      "/api/collections/system_stats/records",
      {
        params: {
          filter: `system="${systemId}" && type="1m"`,
          sort: "-created",
          perPage: HISTORY_POINTS,
        },
      },
    );
    const items = [...data.items].reverse();
    const latest = data.items[0]?.stats;

    return {
      history: buildHistoryFromStatRecords(items),
      network: parseNetworkTotals(latest),
      rates: parseIoRates(latest),
      loadStats: latest,
      live: parseLiveStats(latest),
    };
  } catch {
    return { history: EMPTY_HISTORY };
  }
}

export async function loadSystemHistoryBundle(systemId: string) {
  const client = await createAuthenticatedClient();
  return fetchSystemHistory(client, systemId);
}

function parseLiveStats(stats?: SystemStatsPayload): SystemLiveStats | undefined {
  if (!stats) return undefined;
  const live: SystemLiveStats = {};
  if (stats.m != null) live.memTotalGb = stats.m;
  if (stats.mu != null) live.memUsedGb = stats.mu;
  if (stats.d != null) live.diskTotalGb = stats.d;
  if (stats.du != null) live.diskUsedGb = stats.du;
  if (stats.s != null) live.swapTotalGb = stats.s;
  if (stats.su != null) live.swapUsedGb = stats.su;
  return Object.keys(live).length > 0 ? live : undefined;
}

function mergeLoadInfo(
  info?: BeszelSystemInfo,
  stats?: SystemStatsPayload,
): BeszelSystemInfo | undefined {
  if (!info && !stats) return undefined;
  if (!stats) return info;
  return mergeStatsIntoInfo(info, stats);
}

function mergeStatsIntoInfo(
  info?: BeszelSystemInfo,
  stats?: SystemStatsPayload,
): BeszelSystemInfo | undefined {
  if (!info && !stats) return undefined;

  const merged: BeszelSystemInfo = { ...(info ?? {}) };
  if (!stats) return Object.keys(merged).length > 0 ? merged : undefined;

  if (stats.cpu != null) merged.cpu = stats.cpu;
  if (stats.mp != null) merged.mp = stats.mp;
  if (stats.la) merged.la = stats.la;
  if (stats.l1 != null) merged.l1 = stats.l1;
  if (stats.l5 != null) merged.l5 = stats.l5;
  if (stats.l15 != null) merged.l15 = stats.l15;

  return Object.keys(merged).length > 0 ? merged : undefined;
}

function parseNetworkTotals(stats?: SystemStatsPayload): NetworkTotals | undefined {
  if (!stats?.ni) return undefined;

  let upload = 0;
  let download = 0;
  for (const iface of Object.values(stats.ni)) {
    upload += iface[2] ?? 0;
    download += iface[3] ?? 0;
  }

  if (upload === 0 && download === 0) return undefined;
  return { upload, download };
}

export function publicSystemFromRecord(record: BeszelSystemRecord): PublicSystem {
  return toPublicSystem(
    record,
    record.info,
    EMPTY_HISTORY,
    osFromInfo(record.info),
    specFromInfo(record.info),
    undefined,
    undefined,
    ratesFromInfo(record.info),
  );
}

async function buildPublicSystem(
  client: AxiosInstance,
  record: BeszelSystemRecord,
  detailsMap: Map<string, SystemDetailsRecord>,
): Promise<PublicSystem> {
  const details = detailsMap.get(record.id);
  const { history, network, rates, loadStats, live } = await fetchSystemHistory(
    client,
    record.id,
  );
  const info = mergeLoadInfo(record.info, loadStats);
  return toPublicSystem(
    record,
    info,
    history,
    details?.os_name ?? osFromInfo(record.info),
    specFromDetails(record.info, details),
    live,
    network,
    mergeIoRates(undefined, rates, info),
  );
}

export async function fetchDashboardData(): Promise<PublicSystem[]> {
  const client = await createAuthenticatedClient();

  try {
    const [{ data }, detailsMap] = await Promise.all([
      client.get<PocketBaseListResponse<BeszelSystemRecord>>(
        "/api/collections/systems/records",
        { params: { sort: "name" } },
      ),
      fetchSystemDetailsMap(client),
    ]);

    return Promise.all(
      data.items.map((record) => buildPublicSystem(client, record, detailsMap)),
    );
  } catch (error) {
    wrapError("Failed to fetch system list", error);
  }
}

function sanitizePublicInfo(info?: BeszelSystemInfo): PublicSystemInfo | undefined {
  if (!info) return undefined;

  const out: PublicSystemInfo = {};
  if (info.cpu != null) out.cpu = info.cpu;
  if (info.mp != null) out.mp = info.mp;
  if (info.dp != null) out.dp = info.dp;
  if (info.u != null) out.u = info.u;
  if (info.la != null) out.la = info.la;
  if (info.l1 != null) out.l1 = info.l1;
  if (info.l5 != null) out.l5 = info.l5;
  if (info.l15 != null) out.l15 = info.l15;
  if (info.g != null) out.g = info.g;
  if (info.sv != null) out.sv = info.sv;

  return Object.keys(out).length > 0 ? out : undefined;
}

function toPublicSystem(
  record: BeszelSystemRecord,
  mergedInfo: BeszelSystemInfo | undefined,
  history: SystemHistory,
  os?: string,
  spec?: SystemSpec,
  live?: SystemLiveStats,
  network?: NetworkTotals,
  rates?: IoRates,
): PublicSystem {
  return {
    id: record.id,
    name: record.name,
    status: record.status,
    os,
    spec: sanitizePublicSpec(spec),
    live,
    info: sanitizePublicInfo(mergedInfo),
    updated: record.updated,
    history,
    network,
    rates,
  };
}

function ratesFromInfo(info?: BeszelSystemInfo): IoRates | undefined {
  if (!info) return undefined;
  const payload = info as BeszelSystemInfo & { dio?: [number, number]; b?: [number, number] };
  return mergeIoRates(undefined, parseIoRates({ b: payload.b, dio: payload.dio }), info);
}

export function applyRtMetrics(
  existing: PublicSystem,
  data: RtMetricsPayload,
): PublicSystem {
  const mergedInfo = data.info
    ? ({ ...(existing.info as BeszelSystemInfo | undefined), ...data.info } as BeszelSystemInfo)
    : (existing.info as BeszelSystemInfo | undefined);
  const info = mergeStatsIntoInfo(mergedInfo, data.stats);

  return {
    ...existing,
    info: sanitizePublicInfo(info) ?? existing.info,
    rates:
      mergeIoRates(
        existing.rates,
        data.stats ? parseIoRates(data.stats) : undefined,
        info,
      ) ?? existing.rates,
    live: (data.stats ? parseLiveStats(data.stats) : undefined) ?? existing.live,
  };
}

export function applySystemRecord(
  existing: PublicSystem,
  record: BeszelSystemRecord,
): PublicSystem {
  const info = record.info;
  return {
    ...existing,
    name: record.name,
    status: record.status,
    updated: record.updated,
    os: osFromInfo(info) ?? existing.os,
    spec: mergeStaticSpec(specFromInfo(info), existing.spec),
    info: sanitizePublicInfo(info) ?? existing.info,
    rates: ratesFromInfo(info) ?? existing.rates,
  };
}

export function applySystemStat(
  existing: PublicSystem,
  record: SystemStatPbRecord,
): PublicSystem | null {
  if (record.type && record.type !== "1m") return null;
  const stats = record.stats;
  if (!stats) return null;

  const mergedInfo = mergeLoadInfo(
    existing.info as BeszelSystemInfo | undefined,
    stats,
  );
  const created = record.created ?? new Date().toISOString();

  return {
    ...existing,
    history: appendStatToHistory(existing.history, created, stats),
    network: parseNetworkTotals(stats) ?? existing.network,
    rates: mergeIoRates(existing.rates, parseIoRates(stats), mergedInfo) ?? existing.rates,
    live: parseLiveStats(stats) ?? existing.live,
    info: sanitizePublicInfo(mergedInfo) ?? existing.info,
  };
}

export function dashboardFromSystems(systems: PublicSystem[]): DashboardData {
  return {
    systems: [...systems].sort((a, b) => a.name.localeCompare(b.name)),
    error: null,
    fetchedAt: new Date().toISOString(),
  };
}

function formatDashboardError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);

  if (message.includes("Need BESZEL_URL")) {
    return "Server misconfigured: set BESZEL_URL";
  }
  if (message.includes("Need BESZEL_TOKEN") || message.includes("BESZEL_EMAIL")) {
    return "Server misconfigured: set Beszel credentials";
  }
  if (message.includes("Beszel authentication failed")) {
    return "Beszel authentication failed";
  }
  if (message.includes("Failed to fetch system list")) {
    return "Failed to fetch systems from Beszel";
  }
  if (/ECONNREFUSED|ENOTFOUND|ETIMEDOUT|ECONNRESET|fetch failed/i.test(message)) {
    return "Cannot reach Beszel hub — check BESZEL_URL from the server";
  }

  return "Failed to load dashboard data";
}

export async function loadDashboardData(): Promise<DashboardData> {
  try {
    const systems = await fetchDashboardData();
    return { systems, error: null, fetchedAt: new Date().toISOString() };
  } catch (error) {
    console.error("[beszel-pub] loadDashboardData failed:", error);
    return {
      systems: [],
      error: formatDashboardError(error),
      fetchedAt: new Date().toISOString(),
    };
  }
}
