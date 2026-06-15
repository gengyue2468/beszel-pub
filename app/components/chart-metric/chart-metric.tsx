import type { ReactNode } from "react";
import { Sparkline } from "~/components/sparkline";

const labelClass = "text-foreground-muted text-xs md:text-sm";
const metaClass = "text-foreground-muted text-xs md:text-sm tabular-nums";

export function ChartMetric({
  label,
  used,
  total,
  data,
  colorClass,
  caption,
  tooltipFormatter,
  size = "default",
  footer,
}: {
  label: string;
  used: string;
  total: string;
  data: number[];
  colorClass: string;
  caption?: string | null;
  tooltipFormatter?: (value: number) => string;
  size?: "default" | "compact";
  footer?: ReactNode;
}) {
  if (size === "compact") {
    return (
      <div className="min-w-0">
        <div className="mb-0.5 flex items-baseline justify-between gap-1">
          <span className={labelClass}>{label}</span>
          <span className="tabular-nums">{used}</span>
        </div>
        <Sparkline
          data={data}
          className={colorClass}
          valueFormatter={tooltipFormatter}
          size="sm"
        />
        <div className={`mt-0.5 truncate text-right ${metaClass}`}>{total}</div>
        {footer}
      </div>
    );
  }

  return (
    <div className="min-w-0">
      <div className={`${labelClass} mb-1`}>{label}</div>
      <div className="tabular-nums mb-1">{used}</div>
      <Sparkline data={data} className={colorClass} valueFormatter={tooltipFormatter} />
      <div className={`flex items-baseline justify-between gap-2 mt-1 ${metaClass}`}>
        <span className="truncate min-w-0">{caption ?? ""}</span>
        <span className="shrink-0">{total}</span>
      </div>
    </div>
  );
}
