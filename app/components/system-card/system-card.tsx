import { ChartMetric } from "~/components/chart-metric";
import { Metric } from "~/components/metric";
import type { PublicSystem } from "~/lib/beszel.server";
import {
  diskIoChartData,
  formatCpuCaption,
  formatCpuTooltip,
  formatCpuTotal,
  formatCpuUsed,
  formatBytes,
  formatDiskIoUsed,
  formatDiskIoWrite,
  formatDiskValue,
  formatGb,
  formatIoTooltip,
  formatLastSeen,
  formatLoad,
  formatNetRecv,
  formatNetSent,
  formatRamPct,
  formatRamTooltip,
  formatRamTotal,
  formatRamUsedGb,
  formatUptime,
  netChartData,
  statusColor,
} from "./format";

export function SystemCard({ system, now }: { system: PublicSystem; now: Date }) {
  const info = system.info;
  const load = formatLoad(info);
  const services = info?.sv;
  const meta = [system.os, system.spec?.kernel, system.spec?.arch]
    .filter(Boolean)
    .join(" · ");
  const lastSeen =
    system.status !== "up" ? formatLastSeen(system.updated, now) : null;

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-baseline gap-2 min-w-0">
          <span className="text-base font-bold">{system.name}</span>
          {load && (
            <span className="text-foreground-muted text-sm tabular-nums shrink-0">
              [{load}]
            </span>
          )}
        </div>
        <span className={`uppercase text-xs shrink-0 ${statusColor(system.status)}`}>
          {system.status}
        </span>
      </div>

      {meta && <div className="text-foreground-muted text-xs">{meta}</div>}

      {lastSeen && (
        <div className="text-foreground-muted text-xs tabular-nums">
          last seen {lastSeen}
        </div>
      )}

      <div className="grid grid-cols-2 gap-2 mt-3">
        <ChartMetric
          label="CPU"
          used={formatCpuUsed(system)}
          total={formatCpuTotal(system)}
          data={system.history.cpu}
          colorClass="text-success"
          caption={formatCpuCaption(system)}
          tooltipFormatter={formatCpuTooltip}
        />
        <ChartMetric
          label="RAM"
          used={formatRamPct(system)}
          total={formatRamTotal(system)}
          caption={formatRamUsedGb(system)}
          data={system.history.mem}
          colorClass="text-foreground"
          tooltipFormatter={(v) => formatRamTooltip(v, system)}
        />
      </div>

      <div className="grid grid-cols-2 gap-2 mt-3">
        <ChartMetric
          label="DISK I/O"
          used={formatDiskIoUsed(system)}
          total={formatDiskIoWrite(system)}
          data={diskIoChartData(system)}
          colorClass="text-warning"
          caption="read"
          tooltipFormatter={formatIoTooltip}
        />
        <ChartMetric
          label="NET"
          used={formatNetSent(system)}
          total={formatNetRecv(system)}
          data={netChartData(system)}
          colorClass="text-foreground-muted"
          tooltipFormatter={formatIoTooltip}
        />
      </div>

      <div className="grid grid-cols-2 gap-2 mt-3">
        <Metric label="DISK" value={formatDiskValue(system)} />
        <Metric label="UPTIME" value={formatUptime(info?.u)} />
        <Metric
          label="UPLOAD"
          value={system.network ? formatBytes(system.network.upload) : "-"}
        />
        <Metric
          label="DOWNLOAD"
          value={system.network ? formatBytes(system.network.download) : "-"}
        />
      </div>

      {(info?.g != null ||
        services ||
        system.live?.swapTotalGb != null) && (
        <div className="grid grid-cols-2 gap-2">
          {info?.g != null && (
            <Metric label="GPU" value={`${info.g.toFixed(1)}%`} />
          )}
          {system.live?.swapTotalGb != null && (
            <Metric
              label="SWAP"
              value={
                system.live.swapUsedGb != null
                  ? `${formatGb(system.live.swapUsedGb)}/${formatGb(system.live.swapTotalGb)}`
                  : formatGb(system.live.swapTotalGb)
              }
            />
          )}
          {services && (
            <Metric
              label="SERVICES"
              value={`${services[1]} failed / ${services[0]}`}
            />
          )}
        </div>
      )}
    </div>
  );
}
