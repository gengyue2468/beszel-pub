import type { SystemStatsPayload } from "~/lib/beszel.server";

export type ChartSample = {
  t: number | null;
  stats: SystemStatsPayload | null;
};

export const CHART_1M_INTERVAL_MS = 60_000;
export const CHART_GAP_THRESHOLD_MS = CHART_1M_INTERVAL_MS + CHART_1M_INTERVAL_MS / 2;
export const MAX_CHART_SAMPLES = 30;

export function pbTimestamp(ms: number) {
  return new Date(ms).toISOString().slice(0, 19).replace("T", " ");
}

export function addEmptyValues(
  records: ChartSample[],
  expectedIntervalMs: number,
): ChartSample[] {
  if (records.length < 2) return records;

  const threshold = expectedIntervalMs / 2 + expectedIntervalMs;
  const out: ChartSample[] = [records[0]!];

  for (let i = 1; i < records.length; i++) {
    const prev = records[i - 1]!;
    const curr = records[i]!;
    if (prev.t != null && curr.t != null && curr.t - prev.t > threshold) {
      out.push({ t: null, stats: null });
    }
    out.push(curr);
  }

  return out;
}

export function chartFromStatRecords(
  items: Array<{ created?: string; stats?: SystemStatsPayload }>,
): ChartSample[] {
  const records = items
    .map((item) => ({
      t: item.created ? new Date(item.created).getTime() : null,
      stats: item.stats ?? null,
    }))
    .filter((item): item is ChartSample => item.t != null && item.stats != null);

  return trimChart(addEmptyValues(records, CHART_1M_INTERVAL_MS));
}

export function chartNeedsReload(chart: ChartSample[], created: string) {
  const t = new Date(created).getTime();
  if (Number.isNaN(t)) return false;

  const last = chart[chart.length - 1];
  return last?.t != null && t - last.t > CHART_GAP_THRESHOLD_MS;
}

export function appendStatSample(
  chart: ChartSample[],
  created: string,
  stats: SystemStatsPayload,
): ChartSample[] {
  const t = new Date(created).getTime();
  if (Number.isNaN(t)) return chart;

  const last = chart[chart.length - 1];
  if (last?.t === t) {
    const next = [...chart];
    next[next.length - 1] = { t, stats };
    return next;
  }

  if (last?.t != null && t - last.t > CHART_GAP_THRESHOLD_MS) {
    return chart;
  }

  let next = [...chart, { t, stats }];
  if (next.length > 1) {
    next = addEmptyValues(next, CHART_1M_INTERVAL_MS);
  }
  return trimChart(next);
}

export function trimChart(chart: ChartSample[]) {
  if (chart.length <= MAX_CHART_SAMPLES) return chart;
  return chart.slice(-MAX_CHART_SAMPLES);
}

export function chartSeries(
  chart: ChartSample[],
  pick: (stats: SystemStatsPayload) => number | null,
) {
  return chart.map((sample) => (sample.stats ? pick(sample.stats) : null));
}

export function chartTimes(chart: ChartSample[]) {
  return chart.map((sample) =>
    sample.t != null ? new Date(sample.t).toISOString() : undefined,
  );
}
