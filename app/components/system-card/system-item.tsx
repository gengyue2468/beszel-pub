import { memo } from "react";
import type { ViewMode } from "~/components/view-mode-toggle";
import type { PublicSystem } from "~/lib/beszel.server";
import { SystemCharts } from "./system-charts";
import { SystemExtraMetrics } from "./system-extra-metrics";
import { SystemHeader } from "./system-header";

export const SystemItem = memo(function SystemItem({
  system,
  now,
  variant,
}: {
  system: PublicSystem;
  now: Date;
  variant: ViewMode;
}) {
  if (variant === "list") {
    return (
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:gap-4">
        <SystemHeader system={system} now={now} compact className="shrink-0 md:w-56 lg:w-64" />
        <div className="min-w-0 flex-1">
          <SystemCharts system={system} layout="list" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <SystemHeader system={system} now={now} />
      <SystemCharts system={system} layout="grid" />
      <SystemExtraMetrics system={system} layout="grid" />
    </div>
  );
});
