import { Metric } from "~/components/metric";
import type { PublicSystem } from "~/lib/beszel.server";
import { formatBytes, formatDiskValue, formatGb, formatUptime } from "./format";

export function SystemExtraMetrics({
  system,
  layout,
}: {
  system: PublicSystem;
  layout: "grid" | "list";
}) {
  const info = system.info;
  const services = info?.sv;

  if (layout === "list") return null;

  return (
    <>
      <div className="mt-3 grid grid-cols-2 gap-2">
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

      {(info?.g != null || services || system.live?.swapTotalGb != null) && (
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
    </>
  );
}
