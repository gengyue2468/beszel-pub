import { ChartMetric } from "~/components/chart-metric";
import type { PublicSystem } from "~/lib/beszel.server";
import { getSystemChartMetrics, type ListFooterItem } from "./system-metrics";

function ListChartFooter({ items }: { items: ListFooterItem[] }) {
  return (
    <div className="mt-0.5 flex flex-col gap-px text-xs md:text-sm leading-tight tabular-nums text-foreground-muted">
      {items.map((item, i) =>
        item.type === "row" ? (
          <div key={i} className="flex flex-row justify-between gap-2">
            {item.items.map((text) => (
              <span key={text}>{text}</span>
            ))}
          </div>
        ) : (
          <span key={i}>{item.text}</span>
        ),
      )}
    </div>
  );
}

export function SystemCharts({
  system,
  layout,
}: {
  system: PublicSystem;
  layout: "grid" | "list";
}) {
  const metrics = getSystemChartMetrics(system);

  if (layout === "list") {
    return (
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {metrics.map(({ key, listFooter, ...metric }) => (
          <ChartMetric
            key={key}
            {...metric}
            size="compact"
            footer={
              listFooter && listFooter.length > 0 ? (
                <ListChartFooter items={listFooter} />
              ) : undefined
            }
          />
        ))}
      </div>
    );
  }

  return (
    <>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {metrics.slice(0, 2).map(({ key, ...metric }) => (
          <ChartMetric key={key} {...metric} />
        ))}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {metrics.slice(2, 4).map(({ key, ...metric }) => (
          <ChartMetric key={key} {...metric} />
        ))}
      </div>
    </>
  );
}
