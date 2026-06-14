import type { AxiosInstance } from "axios";
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

interface BeszelSystemRecord {
  id: string;
  name: string;
  host: string;
  status: string;
  info?: BeszelSystemInfo;
  version?: string;
  updated: string;
}

interface SystemStatRecord {
  stats?: SystemStatsPayload;
}

interface SystemDetailsRecord {
  hostname?: string;
  os_name?: string;
  cpu?: string;
  cores?: number;
  threads?: number;
  memory?: number;
  kernel?: string;
  arch?: string;
}

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

export interface SystemHistory {
  cpu: number[];
  mem: number[];
  diskRead: number[];
  diskWrite: number[];
  netSent: number[];
  netRecv: number[];
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

function getBeszelUpstream() {
  const url = process.env.BESZEL_URL?.replace(/\/$/, "");
  if (!url) throw new Error("Need BESZEL_URL environment variable");
  return url;
}

function getConfig() {
  const url = getBeszelUpstream();
  const email = process.env.BESZEL_EMAIL;
  const password = process.env.BESZEL_PASSWORD;
  const token = process.env.BESZEL_TOKEN;

  if (!process.env.BESZEL_URL) throw new Error("Need BESZEL_URL environment variable");
  if (!token && (!email || !password)) {
    throw new Error("Need BESZEL_TOKEN or BESZEL_EMAIL / BESZEL_PASSWORD");
  }

  return { url, email, password, token };
}

function bytesPerSecToMb(bytesPerSec: number) {
  return bytesPerSec / 1024 / 1024;
}

function diskReadMb(stats?: SystemStatsPayload) {
  if (!stats) return 0;
  if (stats.dr != null) return stats.dr;
  if (stats.dio?.[0] != null) return bytesPerSecToMb(stats.dio[0]);
  return 0;
}

function diskWriteMb(stats?: SystemStatsPayload) {
  if (!stats) return 0;
  if (stats.dw != null) return stats.dw;
  if (stats.dio?.[1] != null) return bytesPerSecToMb(stats.dio[1]);
  return 0;
}

function netSentMb(stats?: SystemStatsPayload) {
  if (!stats) return 0;
  if (stats.ns != null) return stats.ns;
  if (stats.b?.[0] != null) return bytesPerSecToMb(stats.b[0]);
  if (stats.ni) {
    return bytesPerSecToMb(
      Object.values(stats.ni).reduce((sum, iface) => sum + (iface[0] ?? 0), 0),
    );
  }
  return 0;
}

function netRecvMb(stats?: SystemStatsPayload) {
  if (!stats) return 0;
  if (stats.nr != null) return stats.nr;
  if (stats.b?.[1] != null) return bytesPerSecToMb(stats.b[1]);
  if (stats.ni) {
    return bytesPerSecToMb(
      Object.values(stats.ni).reduce((sum, iface) => sum + (iface[1] ?? 0), 0),
    );
  }
  return 0;
}

function hasIoStats(stats?: SystemStatsPayload) {
  if (!stats) return false;
  return (
    stats.dr != null ||
    stats.dw != null ||
    stats.ns != null ||
    stats.nr != null ||
    stats.b != null ||
    stats.dio != null ||
    stats.ni != null
  );
}

function mergeRates(stats?: IoRates, info?: BeszelSystemInfo): IoRates | undefined {
  const merged: IoRates = { ...stats };
  if (info?.bb) {
    if (merged.netSent == null) merged.netSent = bytesPerSecToMb(info.bb[0]);
    if (merged.netRecv == null) merged.netRecv = bytesPerSecToMb(info.bb[1]);
  }
  return Object.keys(merged).length > 0 ? merged : undefined;
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
  const { url, email, password, token: envToken } = getConfig();
  const client = createHttpClient(url);
  const token = envToken ?? (await getAuthToken(email!, password!));
  setAuthToken(client, token);
  return client;
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
      history: {
        cpu: items.map((r) => r.stats?.cpu ?? 0),
        mem: items.map((r) => r.stats?.mp ?? 0),
        diskRead: items.map((r) => diskReadMb(r.stats)),
        diskWrite: items.map((r) => diskWriteMb(r.stats)),
        netSent: items.map((r) => netSentMb(r.stats)),
        netRecv: items.map((r) => netRecvMb(r.stats)),
      },
      network: parseNetworkTotals(latest),
      rates: parseIoRates(latest),
      loadStats: latest,
      live: parseLiveStats(latest),
    };
  } catch {
    return {
      history: { cpu: [], mem: [], diskRead: [], diskWrite: [], netSent: [], netRecv: [] },
    };
  }
}

function parseIoRates(stats?: SystemStatsPayload): IoRates | undefined {
  if (!hasIoStats(stats)) return undefined;
  return {
    diskRead: diskReadMb(stats),
    diskWrite: diskWriteMb(stats),
    netSent: netSentMb(stats),
    netRecv: netRecvMb(stats),
  };
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
  if (info?.la || info?.l1 != null) return info;
  if (!stats) return info;
  return {
    ...info,
    la: stats.la,
    l1: stats.l1,
    l5: stats.l5,
    l15: stats.l15,
  };
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

async function fetchSystemDetails(
  client: AxiosInstance,
  systemId: string,
  info?: BeszelSystemInfo,
): Promise<{ os?: string; spec?: SystemSpec }> {
  const OS_NAMES = ["Linux", "macOS", "Windows", "FreeBSD"];
  const fallbackOs =
    info?.o ?? (info?.os != null && OS_NAMES[info.os] ? OS_NAMES[info.os] : undefined);

  try {
    const { data } = await client.get<SystemDetailsRecord>(
      `/api/collections/system_details/records/${systemId}`,
    );
    return {
      os: fallbackOs ?? data.os_name,
      spec: sanitizePublicSpec({
        cpu: data.cpu ?? info?.m,
        cores: data.cores ?? info?.c,
        threads: data.threads ?? info?.t,
        memoryBytes: data.memory,
        kernel: data.kernel,
        arch: data.arch,
      }),
    };
  } catch {
    return {
      os: fallbackOs,
      spec: sanitizePublicSpec({
        cpu: info?.m,
        cores: info?.c,
        threads: info?.t,
      }),
    };
  }
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

export async function fetchDashboardData(): Promise<PublicSystem[]> {
  const client = await createAuthenticatedClient();

  try {
    const { data } = await client.get<PocketBaseListResponse<BeszelSystemRecord>>(
      "/api/collections/systems/records",
      { params: { sort: "name" } },
    );

    return Promise.all(
      data.items.map(async (record) => {
        const [{ history, network, rates, loadStats, live }, details] = await Promise.all([
          fetchSystemHistory(client, record.id),
          fetchSystemDetails(client, record.id, record.info),
        ]);
        const info = mergeLoadInfo(record.info, loadStats);
        return toPublicSystem(
          record,
          info,
          history,
          details.os,
          details.spec,
          live,
          network,
          mergeRates(rates, info),
        );
      }),
    );
  } catch (error) {
    wrapError("Failed to fetch system list", error);
  }
}

export type DashboardData = {
  systems: PublicSystem[];
  error: string | null;
  fetchedAt: string;
};

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
