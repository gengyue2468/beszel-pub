import { Sparkline } from "~/components/sparkline";

export function ChartMetric({
  label,
  used,
  total,
  data,
  colorClass,
  caption,
  tooltipFormatter,
}: {
  label: string;
  used: string;
  total: string;
  data: number[];
  colorClass: string;
  caption?: string | null;
  tooltipFormatter?: (value: number) => string;
}) {
  return (
    <div className="min-w-0">
      <div className="text-foreground-muted text-xs mb-1">{label}</div>
      <div className="text-sm tabular-nums mb-1">{used}</div>
      <Sparkline data={data} className={colorClass} valueFormatter={tooltipFormatter} />
      <div className="flex items-baseline justify-between gap-2 mt-1 text-xs text-foreground-muted tabular-nums">
        <span className="truncate min-w-0">{caption ?? ""}</span>
        <span className="shrink-0">{total}</span>
      </div>
    </div>
  );
}
