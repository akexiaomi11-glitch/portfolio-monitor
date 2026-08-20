export type QuickFilter = "all" | "positive" | "negative" | "volatile" | "stale";

export type MonitorableHolding = {
  pnl: number;
  hasLargeDailyChange: boolean;
  businessDaysOld: number | null;
};

export function isDataStaleForThreshold(
  businessDaysOld: number | null,
  staleDays: number,
): boolean {
  return businessDaysOld === null || businessDaysOld > staleDays;
}

export function matchesQuickFilter(
  holding: MonitorableHolding,
  filter: QuickFilter,
  staleDays: number,
): boolean {
  if (filter === "all") return true;
  if (filter === "positive") return holding.pnl > 0;
  if (filter === "negative") return holding.pnl < 0;
  if (filter === "volatile") return holding.hasLargeDailyChange;
  return isDataStaleForThreshold(holding.businessDaysOld, staleDays);
}
