import type { PublicSystem } from "~/lib/beszel.server";
import type { SparklineSeries } from "~/components/sparkline";
import { chartMetricsFromSystem } from "~/lib/chart-metrics";
import {
  formatBytes,
  formatCpuCaption,
  formatCpuTooltip,
  formatCpuTotal,
  formatCpuUsed,
  formatDiskIoRead,
  formatDiskIoUsed,
  formatDiskIoWrite,
  formatDiskValue,
  formatIoTooltip,
  formatNetRecv,
  formatNetSent,
  formatNetUsed,
  formatPct,
  formatRamPct,
  formatRamTotal,
  formatRamUsedGb,
  formatUptime,
} from "./format";

export type ListFooterItem =
  | { type: "line"; text: string }
  | { type: "row"; items: string[] };

export type ChartMetricConfig = {
  key: string;
  label: string;
  used: string;
  total: string;
  data?: (number | null)[];
  series?: SparklineSeries[];
  times?: (string | undefined)[];
  colorClass?: string;
  fill?: string;
  caption?: string | null;
  tooltipFormatter?: (value: number) => string;
  listFooter?: ListFooterItem[];
};

export function getSystemChartMetrics(system: PublicSystem): ChartMetricConfig[] {
  const info = system.info;
  const services = info?.sv;
  const ramUsed = formatRamUsedGb(system);
  const ramTotal = formatRamTotal(system);
  const metrics = chartMetricsFromSystem(system);
  const { times, cpu, mem, swap, diskRead, diskWrite, netSent, netRecv } = metrics;

  const ramSeries: SparklineSeries[] = [
    {
      key: "mem",
      data: mem,
      color: "var(--chart-blue)",
      fill: "var(--chart-blue-fill)",
      label: "mem",
    },
    {
      key: "swap",
      data: swap,
      color: "var(--chart-violet)",
      fill: "var(--chart-violet-fill)",
      label: "swap",
    },
  ];

  const diskSeries: SparklineSeries[] = [
    {
      key: "read",
      data: diskRead,
      color: "var(--chart-cyan)",
      fill: "var(--chart-cyan-fill)",
      label: "read",
    },
    {
      key: "write",
      data: diskWrite,
      color: "var(--chart-amber)",
      fill: "var(--chart-amber-fill)",
      label: "write",
    },
  ];

  const netSeries: SparklineSeries[] = [
    {
      key: "sent",
      data: netSent,
      color: "var(--chart-amber)",
      fill: "var(--chart-amber-fill)",
      label: "↑",
    },
    {
      key: "recv",
      data: netRecv,
      color: "var(--chart-green)",
      fill: "var(--chart-green-fill)",
      label: "↓",
    },
  ];

  return [
    {
      key: "cpu",
      label: "CPU",
      used: formatCpuUsed(system),
      total: formatCpuTotal(system),
      data: cpu,
      times,
      colorClass: "text-chart-blue",
      fill: "var(--chart-blue-fill)",
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
      series: ramSeries,
      times,
      caption: formatRamUsedGb(system),
      tooltipFormatter: formatPct,
      listFooter: [{ type: "line", text: `${ramUsed}/${ramTotal}` }],
    },
    {
      key: "disk-io",
      label: "DISK I/O",
      used: formatDiskIoUsed(system),
      total: formatDiskIoWrite(system),
      series: diskSeries,
      times,
      caption: formatDiskIoRead(system),
      tooltipFormatter: formatIoTooltip,
      listFooter: [`DISK ${formatDiskValue(system)}`].map((text) => ({
        type: "line" as const,
        text,
      })),
    },
    {
      key: "net",
      label: "NET",
      used: formatNetUsed(system),
      total: formatNetRecv(system),
      series: netSeries,
      times,
      caption: formatNetSent(system),
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
