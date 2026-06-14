import type { PublicSystem } from "~/lib/beszel.server";

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

export function formatBytes(bytes: number) {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** i;
  return `${value.toFixed(i > 0 ? 1 : 0)} ${units[i]}`;
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

export function formatDiskIoUsed(system: PublicSystem) {
  return formatMbPerSecond(system.rates?.diskRead);
}

export function formatDiskIoWrite(system: PublicSystem) {
  return formatMbPerSecond(system.rates?.diskWrite);
}

export function formatNetSent(system: PublicSystem) {
  return formatMbPerSecond(system.rates?.netSent);
}

export function formatNetRecv(system: PublicSystem) {
  return formatMbPerSecond(system.rates?.netRecv);
}

export function diskIoChartData(system: PublicSystem) {
  const { diskRead, diskWrite } = system.history;
  return diskRead.map((r, i) => r + (diskWrite[i] ?? 0));
}

export function netChartData(system: PublicSystem) {
  const { netSent, netRecv } = system.history;
  return netSent.map((r, i) => r + (netRecv[i] ?? 0));
}

export function formatGb(gb: number) {
  return `${gb.toFixed(gb >= 10 ? 0 : 1)} GB`;
}

export function formatMemoryTotal(system: PublicSystem) {
  const { spec, live } = system;
  if (spec?.memoryBytes) return formatBytes(spec.memoryBytes);
  if (live?.memTotalGb != null) return formatGb(live.memTotalGb);
  return null;
}

export function formatRamPct(system: PublicSystem) {
  const pct = system.info?.mp;
  return pct != null ? `${pct.toFixed(1)}%` : "-";
}

export function formatRamUsedGb(system: PublicSystem) {
  if (system.live?.memUsedGb != null) return formatGb(system.live.memUsedGb);
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
    return `${formatGb(usedGb)} / ${formatGb(totalGb)}`;
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
    return `${pct} (${formatGb(used)}/${formatGb(total)})`;
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
