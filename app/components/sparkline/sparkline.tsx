import { useEffect, useState } from "react";
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  YAxis,
} from "recharts";

type ChartPoint = { i: number; v: number };

function ChartHoverCard({
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
  if (!point) return null;

  return (
    <div className="rounded border border-border bg-background-subtle px-1.5 py-1 shadow-sm">
      <div className="text-foreground-muted text-xs">
        {labelFormatter(point.i, total)}
      </div>
      <div className="text-xs tabular-nums">{valueFormatter(point.v)}</div>
    </div>
  );
}

export function Sparkline({
  data,
  className,
  valueFormatter = (v) => `${v.toFixed(1)}%`,
  labelFormatter,
}: {
  data: number[];
  className?: string;
  valueFormatter?: (value: number) => string;
  labelFormatter?: (index: number, total: number) => string;
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (data.length < 2) {
    return <div className={`h-10 min-w-0 bg-background-muted ${className ?? ""}`} />;
  }

  const chartData = data.map((v, i) => ({ i, v }));
  const max = Math.max(...data, 1);
  const yMax = max * 1.12;
  const formatLabel =
    labelFormatter ??
    ((index: number, total: number) => {
      const minutesAgo = total - 1 - index;
      return minutesAgo === 0 ? "now" : `${minutesAgo}m ago`;
    });

  if (!mounted) {
    return <div className={`h-10 min-w-0 w-full bg-background-muted ${className ?? ""}`} />;
  }

  return (
    <div className={`h-10 min-w-0 w-full overflow-visible ${className ?? ""}`}>
      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
        <AreaChart
          data={chartData}
          margin={{ top: 6, right: 2, left: 2, bottom: 4 }}
          accessibilityLayer={false}
        >
          <YAxis domain={[0, yMax]} hide />
          <Tooltip
            cursor={{ stroke: "currentColor", strokeOpacity: 0.15, strokeWidth: 1 }}
            wrapperStyle={{ outline: "none", zIndex: 20 }}
            content={({ active, payload }) => (
              <ChartHoverCard
                active={active}
                payload={payload}
                total={data.length}
                valueFormatter={valueFormatter}
                labelFormatter={formatLabel}
              />
            )}
          />
          <Area
            type="monotone"
            dataKey="v"
            stroke="currentColor"
            fill="currentColor"
            fillOpacity={0.1}
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
      </ResponsiveContainer>
    </div>
  );
}
