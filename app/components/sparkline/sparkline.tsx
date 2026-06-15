import { useEffect, useState } from "react";
import {
  Area,
  AreaChart,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  YAxis,
} from "recharts";

export type SparklineSeries = {
  key: string;
  data: number[];
  color: string;
  fill?: string;
  label: string;
};

type ChartPoint = { i: number; v?: number; [key: string]: number | undefined };

function SingleChartHoverCard({
  active,
  payload,
  total,
  valueFormatter,
  labelFormatter,
}: {
  active?: boolean;
  payload?: readonly { payload?: ChartPoint }[];
  total: number;
  valueFormatter: (value: number) => string;
  labelFormatter: (index: number, total: number) => string;
}) {
  if (!active || !payload?.length) return null;

  const point = payload[0]?.payload;
  if (!point || point.v == null) return null;

  return (
    <div className="rounded border border-border bg-background-subtle px-1.5 py-1 shadow-sm">
      <div className="text-foreground-muted text-xs md:text-sm">
        {labelFormatter(point.i, total)}
      </div>
      <div className="text-xs md:text-sm tabular-nums">{valueFormatter(point.v)}</div>
    </div>
  );
}

function MultiChartHoverCard({
  active,
  payload,
  total,
  series,
  valueFormatter,
  labelFormatter,
}: {
  active?: boolean;
  payload?: readonly { payload?: ChartPoint }[];
  total: number;
  series: SparklineSeries[];
  valueFormatter: (value: number) => string;
  labelFormatter: (index: number, total: number) => string;
}) {
  if (!active || !payload?.length) return null;

  const point = payload[0]?.payload;
  if (!point) return null;

  return (
    <div className="rounded border border-border bg-background-subtle px-1.5 py-1 shadow-sm">
      <div className="text-foreground-muted text-xs md:text-sm mb-0.5">
        {labelFormatter(point.i, total)}
      </div>
      {series.map((s) => (
        <div
          key={s.key}
          className="text-xs md:text-sm tabular-nums"
          style={{ color: s.color }}
        >
          {s.label} {valueFormatter(point[s.key] ?? 0)}
        </div>
      ))}
    </div>
  );
}

function defaultLabel(index: number, total: number) {
  const minutesAgo = total - 1 - index;
  return minutesAgo === 0 ? "now" : `${minutesAgo}m ago`;
}

export function Sparkline({
  data,
  series,
  className,
  fill,
  valueFormatter = (v) => `${v.toFixed(1)}%`,
  labelFormatter,
  size = "md",
}: {
  data?: number[];
  series?: SparklineSeries[];
  className?: string;
  fill?: string;
  valueFormatter?: (value: number) => string;
  labelFormatter?: (index: number, total: number) => string;
  size?: "sm" | "md";
}) {
  const heightClass = size === "sm" ? "h-6" : "h-10";
  const [mounted, setMounted] = useState(() => typeof document !== "undefined");
  const multi = series && series.length > 0;
  const single = !multi ? data : undefined;

  useEffect(() => {
    setMounted(true);
  }, []);

  const pointCount = multi
    ? Math.max(...series.map((s) => s.data.length))
    : (single?.length ?? 0);

  if (pointCount < 2) {
    return <div className={`${heightClass} min-w-0 bg-background-muted ${className ?? ""}`} />;
  }

  const formatLabel = labelFormatter ?? defaultLabel;

  let chartData: ChartPoint[];
  let yMax: number;

  if (multi) {
    chartData = Array.from({ length: pointCount }, (_, i) => {
      const point: ChartPoint = { i };
      for (const s of series) point[s.key] = s.data[i] ?? 0;
      return point;
    });
    yMax =
      Math.max(
        ...series.flatMap((s) => s.data),
        1,
      ) * 1.12;
  } else {
    chartData = single!.map((v, i) => ({ i, v }));
    yMax = Math.max(...single!, 1) * 1.12;
  }

  if (!mounted) {
    return <div className={`${heightClass} min-w-0 w-full bg-background-muted ${className ?? ""}`} />;
  }

  const margin = { top: 6, right: 2, left: 2, bottom: 4 };

  return (
    <div className={`${heightClass} min-w-0 w-full overflow-visible ${className ?? ""}`}>
      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
        {multi ? (
          <ComposedChart data={chartData} margin={margin} accessibilityLayer={false}>
            <YAxis domain={[0, yMax]} hide />
            <Tooltip
              cursor={{ stroke: "var(--foreground-muted)", strokeOpacity: 0.15, strokeWidth: 1 }}
              wrapperStyle={{ outline: "none", zIndex: 20 }}
              content={({ active, payload }) => (
                <MultiChartHoverCard
                  active={active}
                  payload={payload}
                  total={pointCount}
                  series={series}
                  valueFormatter={valueFormatter}
                  labelFormatter={formatLabel}
                />
              )}
            />
            {series.map((s) => (
              <Area
                key={`${s.key}-fill`}
                type="monotone"
                dataKey={s.key}
                stroke="none"
                fill={s.fill ?? s.color}
                fillOpacity={s.fill ? 1 : 0.15}
                isAnimationActive={false}
              />
            ))}
            {series.map((s) => (
              <Line
                key={s.key}
                type="monotone"
                dataKey={s.key}
                stroke={s.color}
                strokeWidth={1.5}
                dot={false}
                activeDot={{
                  r: 2.5,
                  stroke: s.color,
                  strokeWidth: 1.5,
                  fill: "var(--background)",
                }}
                isAnimationActive={false}
              />
            ))}
          </ComposedChart>
        ) : (
          <AreaChart data={chartData} margin={margin} accessibilityLayer={false}>
            <YAxis domain={[0, yMax]} hide />
            <Tooltip
              cursor={{ stroke: "currentColor", strokeOpacity: 0.15, strokeWidth: 1 }}
              wrapperStyle={{ outline: "none", zIndex: 20 }}
              content={({ active, payload }) => (
                <SingleChartHoverCard
                  active={active}
                  payload={payload}
                  total={pointCount}
                  valueFormatter={valueFormatter}
                  labelFormatter={formatLabel}
                />
              )}
            />
            <Area
              type="monotone"
              dataKey="v"
              stroke="currentColor"
              fill={fill ?? "currentColor"}
              fillOpacity={fill ? 1 : 0.12}
              strokeWidth={1.5}
              dot={false}
              activeDot={{
                r: 3,
                stroke: "currentColor",
                strokeWidth: 1.5,
                fill: "var(--background)",
              }}
              isAnimationActive={false}
            />
          </AreaChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}
