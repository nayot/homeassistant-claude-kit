export interface TimeSeriesPoint {
  time: number;
  value: number;
}

// Merges multiple sorted time series into one sorted, deduplicated series.
export function mergeTimeSeries(
  ...series: TimeSeriesPoint[][]
): TimeSeriesPoint[] {
  const merged: TimeSeriesPoint[] = [];
  for (const s of series) {
    merged.push(...s);
  }
  const seen = new Set<number>();
  const unique = merged.filter((p) => {
    if (seen.has(p.time)) return false;
    seen.add(p.time);
    return true;
  });
  unique.sort((a, b) => a.time - b.time);
  return unique;
}
