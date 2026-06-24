import type { PublicSystem } from "~/lib/beszel.server";

function latestChartStats(system: PublicSystem) {
  for (let i = system.chart.length - 1; i >= 0; i--) {
    const stats = system.chart[i]?.stats;
    if (stats) return stats;
  }
  return undefined;
}

export function formatUptime(seconds?: number) {
  if (!seconds) return "-";
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const parts = [];
  if (d) parts.push(`${d}d`);
  if (h) parts.push(`${h}h`);
  parts.push(`${m}m`);
  return parts.join(" ");
}

export function formatLoad(info?: PublicSystem["info"]) {
  const la =
    info?.la ??
    (info?.l1 != null ? [info.l1, info.l5 ?? 0, info.l15 ?? 0] as [number, number, number] : undefined);
  if (!la) return null;
  return la.map((n) => n.toFixed(2)).join(", ");
}

const GB_BYTES = 1024 ** 3;

export function formatBytes(bytes: number) {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** i;
  return `${value.toFixed(i > 0 ? 1 : 0)} ${units[i]}`;
}

export function formatFromGb(gb: number) {
  return formatBytes(gb * GB_BYTES);
}

export function formatMbPerSecond(mb?: number) {
  if (mb == null) return "-";
  if (mb === 0) return "0 B/s";
  const bytesPerSec = mb * 1024 * 1024;
  const units = ["B/s", "KB/s", "MB/s", "GB/s"];
  const i = Math.min(Math.floor(Math.log(bytesPerSec) / Math.log(1024)), units.length - 1);
  const value = bytesPerSec / 1024 ** i;
  return `${value.toFixed(i > 1 ? 1 : 0)} ${units[i]}`;
}

export function formatIoTooltip(mb: number) {
  return formatMbPerSecond(mb);
}

export function formatLastSeen(updated: string, now: Date) {
  const ms = now.getTime() - new Date(updated).getTime();
  if (ms < 0 || ms < 10_000) return "just now";
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function resolveDiskRates(system: PublicSystem) {
  const stats = latestChartStats(system);
  return {
    read: system.rates?.diskRead ?? (stats ? diskReadFromStats(stats) : undefined),
    write: system.rates?.diskWrite ?? (stats ? diskWriteFromStats(stats) : undefined),
  };
}

function diskReadFromStats(stats: NonNullable<ReturnType<typeof latestChartStats>>) {
  if (stats.dio != null) return (stats.dio[0] ?? 0) / 1024 / 1024;
  return stats.dr;
}

function diskWriteFromStats(stats: NonNullable<ReturnType<typeof latestChartStats>>) {
  if (stats.dio != null) return (stats.dio[1] ?? 0) / 1024 / 1024;
  return stats.dw;
}

export function formatDiskIoRead(system: PublicSystem) {
  return formatMbPerSecond(resolveDiskRates(system).read);
}

export function formatDiskIoWrite(system: PublicSystem) {
  return formatMbPerSecond(resolveDiskRates(system).write);
}

/** Headline throughput — matches sparkline (read + write). */
export function formatDiskIoUsed(system: PublicSystem) {
  const { read, write } = resolveDiskRates(system);
  const combined = (read ?? 0) + (write ?? 0);
  if (combined > 0) return formatMbPerSecond(combined);
  return formatMbPerSecond(read);
}

export function formatPct(value: number) {
  return `${value.toFixed(1)}%`;
}

function resolveNetRates(system: PublicSystem) {
  const stats = latestChartStats(system);
  const netSent = stats?.b?.[0] != null
    ? (stats.b[0] ?? 0) / 1024 / 1024
    : stats?.ns;
  const netRecv = stats?.b?.[1] != null
    ? (stats.b[1] ?? 0) / 1024 / 1024
    : stats?.nr;

  return {
    sent: system.rates?.netSent ?? netSent,
    recv: system.rates?.netRecv ?? netRecv,
  };
}

export function formatNetSent(system: PublicSystem) {
  return formatMbPerSecond(resolveNetRates(system).sent);
}

export function formatNetRecv(system: PublicSystem) {
  return formatMbPerSecond(resolveNetRates(system).recv);
}

/** Headline throughput — sent + recv. */
export function formatNetUsed(system: PublicSystem) {
  const { sent, recv } = resolveNetRates(system);
  const combined = (sent ?? 0) + (recv ?? 0);
  if (combined > 0) return formatMbPerSecond(combined);
  return formatMbPerSecond(sent);
}

export function formatMemoryTotal(system: PublicSystem) {
  const { spec, live } = system;
  if (spec?.memoryBytes) return formatBytes(spec.memoryBytes);
  if (live?.memTotalGb != null) return formatFromGb(live.memTotalGb);
  return null;
}

export function formatRamPct(system: PublicSystem) {
  const pct = system.info?.mp;
  return pct != null ? `${pct.toFixed(1)}%` : "-";
}

export function formatRamUsedGb(system: PublicSystem) {
  if (system.live?.memUsedGb != null) return formatFromGb(system.live.memUsedGb);
  return "-";
}

export function formatRamTotal(system: PublicSystem) {
  return formatMemoryTotal(system) ?? "-";
}

export function formatCpuUsed(system: PublicSystem) {
  const cpu = system.info?.cpu;
  return cpu != null ? `${cpu.toFixed(1)}%` : "-";
}

export function formatCpuTotal(system: PublicSystem) {
  const { spec } = system;
  if (spec?.cores != null && spec?.threads != null) return `${spec.cores}c/${spec.threads}t`;
  if (spec?.cores != null) return `${spec.cores} cores`;
  if (spec?.threads != null) return `${spec.threads} threads`;
  return "-";
}

export function formatCpuCaption(system: PublicSystem) {
  return system.spec?.cpu ?? null;
}

export function formatRamTooltip(pct: number, system: PublicSystem) {
  const totalGb = system.live?.memTotalGb;
  if (totalGb != null) {
    const usedGb = (pct / 100) * totalGb;
    return `${formatFromGb(usedGb)} / ${formatFromGb(totalGb)}`;
  }
  const total = formatMemoryTotal(system);
  if (total) return `${pct.toFixed(1)}% / ${total}`;
  return `${pct.toFixed(1)}% / -`;
}

export function formatCpuTooltip(pct: number) {
  return `${pct.toFixed(1)}% / 100%`;
}

export function formatDiskValue(system: PublicSystem) {
  const info = system.info;
  const pct = info?.dp != null ? `${info.dp.toFixed(1)}%` : null;
  const used = system.live?.diskUsedGb;
  const total = system.live?.diskTotalGb;
  if (pct && used != null && total != null) {
    return `${pct} (${formatFromGb(used)}/${formatFromGb(total)})`;
  }
  return pct ?? "-";
}

export function statusColor(status: string) {
  switch (status) {
    case "up":
      return "text-success";
    case "down":
      return "text-error";
    case "paused":
      return "text-warning";
    default:
      return "text-foreground-muted";
  }
}
