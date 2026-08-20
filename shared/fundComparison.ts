export type ComparableHistoryPoint = {
  assetKey: string;
  timestamp: number;
  value: number;
};

export type NormalizedComparisonRow = {
  timestamp: number;
  dateLabel: string;
  [assetKey: string]: number | string;
};

export type CompareRange = "all" | "30" | "90" | "180";

export function getComparisonRangeStart(range: CompareRange, now = Date.now()) {
  return range === "all" ? null : now - Number(range) * 86_400_000;
}

export function toggleComparisonSelection(selectedAssetKeys: string[], assetKey: string) {
  return selectedAssetKeys.includes(assetKey)
    ? selectedAssetKeys.filter(key => key !== assetKey)
    : [...selectedAssetKeys, assetKey];
}

export function buildNormalizedComparisonSeries(
  points: ComparableHistoryPoint[],
  selectedAssetKeys: string[],
) {
  const allowed = new Set(selectedAssetKeys);
  const sortedPoints = points
    .filter(point => allowed.has(point.assetKey))
    .sort((left, right) => left.timestamp - right.timestamp);
  const baselines = new Map<string, number>();
  const rowsByTimestamp = new Map<number, NormalizedComparisonRow>();

  sortedPoints.forEach(point => {
    if (!baselines.has(point.assetKey)) baselines.set(point.assetKey, point.value);
    const baseline = baselines.get(point.assetKey) ?? point.value;
    const row = rowsByTimestamp.get(point.timestamp) ?? {
      timestamp: point.timestamp,
      dateLabel: new Date(point.timestamp).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "2-digit", timeZone: "Asia/Bangkok" }),
    };
    row[point.assetKey] = baseline === 0 ? 0 : ((point.value / baseline) - 1) * 100;
    rowsByTimestamp.set(point.timestamp, row);
  });

  return Array.from(rowsByTimestamp.values()).sort((left, right) => left.timestamp - right.timestamp);
}

export function calculateNormalizedChange(points: ComparableHistoryPoint[]) {
  if (points.length < 2) return null;
  const sorted = [...points].sort((left, right) => left.timestamp - right.timestamp);
  const initial = sorted[0]?.value ?? 0;
  const latest = sorted.at(-1)?.value ?? initial;
  return initial === 0 ? null : ((latest / initial) - 1) * 100;
}
