import type { PublicSystem } from "~/lib/beszel.server";
import type { SparklineSeries } from "~/components/sparkline";
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
  data?: number[];
  series?: SparklineSeries[];
  colorClass?: string;
  fill?: string;
  caption?: string | null;
  tooltipFormatter?: (value: number) => string;
  listFooter?: ListFooterItem[];
};

const RAM_SERIES = (system: PublicSystem): SparklineSeries[] => [
  {
    key: "mem",
    data: system.history.mem,
    color: "var(--chart-blue)",
    fill: "var(--chart-blue-fill)",
    label: "mem",
  },
  {
    key: "swap",
    data: system.history.swap,
    color: "var(--chart-violet)",
    fill: "var(--chart-violet-fill)",
    label: "swap",
  },
];

const DISK_IO_SERIES = (system: PublicSystem): SparklineSeries[] => [
  {
    key: "read",
    data: system.history.diskRead,
    color: "var(--chart-cyan)",
    fill: "var(--chart-cyan-fill)",
    label: "read",
  },
  {
    key: "write",
    data: system.history.diskWrite,
    color: "var(--chart-amber)",
    fill: "var(--chart-amber-fill)",
    label: "write",
  },
];

const NET_SERIES = (system: PublicSystem): SparklineSeries[] => [
  {
    key: "sent",
    data: system.history.netSent,
    color: "var(--chart-amber)",
    fill: "var(--chart-amber-fill)",
    label: "↑",
  },
  {
    key: "recv",
    data: system.history.netRecv,
    color: "var(--chart-green)",
    fill: "var(--chart-green-fill)",
    label: "↓",
  },
];

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
      series: RAM_SERIES(system),
      caption: formatRamUsedGb(system),
      tooltipFormatter: formatPct,
      listFooter: [{ type: "line", text: `${ramUsed}/${ramTotal}` }],
    },
    {
      key: "disk-io",
      label: "DISK I/O",
      used: formatDiskIoUsed(system),
      total: formatDiskIoWrite(system),
      series: DISK_IO_SERIES(system),
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
      series: NET_SERIES(system),
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
