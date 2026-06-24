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
import { formatHistoryTimeLabel } from "./history-time";

export type SparklineSeries = {
  key: string;
  data: (number | null)[];
  color: string;
  fill?: string;
  label: string;
};

type ChartPoint = {
  i: number;
  at?: string;
  v?: number;
  [key: string]: number | string | undefined;
};

function numericValues(values: (number | null | undefined)[]) {
  return values.filter((v): v is number => v != null);
}

function timelineAt(times: (string | undefined)[] | undefined, index: number) {
  return times?.[index];
}

function SingleChartHoverCard({
  active,
  payload,
  valueFormatter,
}: {
  active?: boolean;
  payload?: readonly { payload?: ChartPoint }[];
  valueFormatter: (value: number) => string;
}) {
  if (!active || !payload?.length) return null;

  const point = payload[0]?.payload;
  if (!point || point.v == null) return null;

  return (
    <div className="rounded border border-border bg-background-subtle px-1.5 py-1 shadow-sm">
      <div className="text-foreground-muted text-xs md:text-sm">
        {formatHistoryTimeLabel(point.at)}
      </div>
      <div className="text-xs md:text-sm tabular-nums">{valueFormatter(point.v)}</div>
    </div>
  );
}

function MultiChartHoverCard({
  active,
  payload,
  series,
  valueFormatter,
}: {
  active?: boolean;
  payload?: readonly { payload?: ChartPoint }[];
  series: SparklineSeries[];
  valueFormatter: (value: number) => string;
}) {
  if (!active || !payload?.length) return null;

  const point = payload[0]?.payload;
  if (!point) return null;

  const rows = series.filter((s) => point[s.key] != null);
  if (rows.length === 0) return null;

  return (
    <div className="rounded border border-border bg-background-subtle px-2 py-0.5 shadow-sm">
      <div className="text-foreground-muted text-xs md:text-sm mb-0">
        {formatHistoryTimeLabel(point.at)}
      </div>
      {rows.map((s) => (
        <div
          key={s.key}
          className="text-xs md:text-sm tabular-nums"
          style={{ color: s.color }}
        >
          {s.label} {valueFormatter(point[s.key] as number)}
        </div>
      ))}
    </div>
  );
}

export function Sparkline({
  data,
  series,
  times,
  className,
  fill,
  valueFormatter = (v) => `${v.toFixed(1)}%`,
  size = "md",
}: {
  data?: (number | null)[];
  series?: SparklineSeries[];
  times?: (string | undefined)[];
  className?: string;
  fill?: string;
  valueFormatter?: (value: number) => string;
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
    ? Math.max(...series.map((s) => s.data.length), times?.length ?? 0)
    : Math.max(single?.length ?? 0, times?.length ?? 0);

  if (pointCount < 2) {
    return <div className={`${heightClass} min-w-0 bg-background-muted ${className ?? ""}`} />;
  }

  let chartData: ChartPoint[];
  let yMax: number;

  if (multi) {
    chartData = Array.from({ length: pointCount }, (_, i) => {
      const point: ChartPoint = { i, at: timelineAt(times, i) };
      for (const s of series) {
        const v = s.data[i];
        if (v != null) point[s.key] = v;
      }
      return point;
    });
    yMax =
      Math.max(
        ...series.flatMap((s) => numericValues(s.data)),
        1,
      ) * 1.12;
  } else {
    chartData = single!.map((v, i) => ({
      i,
      at: timelineAt(times, i),
      v: v ?? undefined,
    }));
    yMax = Math.max(...numericValues(single!), 1) * 1.12;
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
                  series={series}
                  valueFormatter={valueFormatter}
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
                connectNulls={false}
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
                connectNulls={false}
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
                  valueFormatter={valueFormatter}
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
              connectNulls={false}
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
