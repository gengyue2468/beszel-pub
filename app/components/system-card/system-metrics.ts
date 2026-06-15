import type { PublicSystem } from "~/lib/beszel.server";
import {
  diskIoChartData,
  formatBytes,
  formatCpuCaption,
  formatCpuTooltip,
  formatCpuTotal,
  formatCpuUsed,
  formatDiskIoUsed,
  formatDiskIoWrite,
  formatDiskValue,
  formatIoTooltip,
  formatNetRecv,
  formatNetSent,
  formatRamPct,
  formatRamTooltip,
  formatRamTotal,
  formatRamUsedGb,
  formatUptime,
  netChartData,
} from "./format";

export type ListFooterItem =
  | { type: "line"; text: string }
  | { type: "row"; items: string[] };

export type ChartMetricConfig = {
  key: string;
  label: string;
  used: string;
  total: string;
  data: number[];
  colorClass: string;
  caption?: string | null;
  tooltipFormatter?: (value: number) => string;
  listFooter?: ListFooterItem[];
};

export function getSystemChartMetrics(system: PublicSystem): ChartMetricConfig[] {
  const info = system.info;
  const services = info?.sv;
  const ramUsed = formatRamUsedGb(system);
  const ramTotal = formatRamTotal(system);

  return [
    {
      key: "cpu",
      label: "CPU",
      used: formatCpuUsed(system),
      total: formatCpuTotal(system),
      data: system.history.cpu,
      colorClass: "text-success",
      caption: formatCpuCaption(system),
      tooltipFormatter: formatCpuTooltip,
      listFooter: [
        {
          type: "row",
          items: [
            formatCpuCaption(system) ?? "-",
            formatUptime(info?.u),
          ],
        },
        info?.g != null
          ? { type: "line", text: `GPU ${info.g.toFixed(1)}%` }
          : null,
      ].filter(Boolean) as ListFooterItem[],
    },
    {
      key: "ram",
      label: "RAM",
      used: formatRamPct(system),
      total: formatRamTotal(system),
      caption: formatRamUsedGb(system),
      data: system.history.mem,
      colorClass: "text-foreground",
      tooltipFormatter: (v) => formatRamTooltip(v, system),
      listFooter: [{ type: "line", text: `${ramUsed}/${ramTotal}` }],
    },
    {
      key: "disk-io",
      label: "DISK I/O",
      used: formatDiskIoUsed(system),
      total: formatDiskIoWrite(system),
      data: diskIoChartData(system),
      colorClass: "text-warning",
      caption: "read",
      tooltipFormatter: formatIoTooltip,
      listFooter: [`DISK ${formatDiskValue(system)}`].map((text) => ({
        type: "line" as const,
        text,
      })),
    },
    {
      key: "net",
      label: "NET",
      used: formatNetSent(system),
      total: formatNetRecv(system),
      data: netChartData(system),
      colorClass: "text-foreground-muted",
      tooltipFormatter: formatIoTooltip,
      listFooter: [
        {
          type: "row",
          items: [
            system.network ? `↑${formatBytes(system.network.upload)}` : "-",
            system.network ? `↓${formatBytes(system.network.download)}` : "-",
          ],
        },
        services
          ? { type: "line", text: `SVC ${services[1]}/${services[0]}` }
          : null,
      ].filter(Boolean) as ListFooterItem[],
    },
  ];
}
