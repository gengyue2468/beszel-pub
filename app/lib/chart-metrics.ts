import type { PublicSystem, SystemStatsPayload } from "~/lib/beszel.server";
import { chartSeries, chartTimes } from "~/lib/chart-samples";

function swapPct(stats: SystemStatsPayload) {
  if (!stats.s) return null;
  return ((stats.su ?? 0) / stats.s) * 100;
}

function bytesPerSecToMb(bytesPerSec: number) {
  return bytesPerSec / 1024 / 1024;
}

function diskReadMb(stats: SystemStatsPayload) {
  if (stats.dio != null) return bytesPerSecToMb(stats.dio[0] ?? 0);
  if (stats.dr != null) return stats.dr;
  return null;
}

function diskWriteMb(stats: SystemStatsPayload) {
  if (stats.dio != null) return bytesPerSecToMb(stats.dio[1] ?? 0);
  if (stats.dw != null) return stats.dw;
  return null;
}

function netSentMb(stats: SystemStatsPayload) {
  if (stats.b?.[0] != null) return bytesPerSecToMb(stats.b[0]);
  if (stats.ns != null) return stats.ns;
  if (stats.ni) {
    return bytesPerSecToMb(
      Object.values(stats.ni).reduce((sum, iface) => sum + (iface[0] ?? 0), 0),
    );
  }
  return null;
}

function netRecvMb(stats: SystemStatsPayload) {
  if (stats.b?.[1] != null) return bytesPerSecToMb(stats.b[1]);
  if (stats.nr != null) return stats.nr;
  if (stats.ni) {
    return bytesPerSecToMb(
      Object.values(stats.ni).reduce((sum, iface) => sum + (iface[1] ?? 0), 0),
    );
  }
  return null;
}

export function chartMetricsFromSystem(system: PublicSystem) {
  const { chart } = system;
  return {
    times: chartTimes(chart),
    cpu: chartSeries(chart, (s) => s.cpu ?? null),
    mem: chartSeries(chart, (s) => s.mp ?? null),
    swap: chartSeries(chart, (s) => swapPct(s)),
    diskRead: chartSeries(chart, diskReadMb),
    diskWrite: chartSeries(chart, diskWriteMb),
    netSent: chartSeries(chart, netSentMb),
    netRecv: chartSeries(chart, netRecvMb),
  };
}
