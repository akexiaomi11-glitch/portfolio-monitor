import { describe, expect, it } from "vitest";
import { isDataStaleForThreshold, matchesQuickFilter } from "./portfolioMonitoring";

const holdings = {
  positive: { pnl: 120, hasLargeDailyChange: false, businessDaysOld: 1 },
  negative: { pnl: -40, hasLargeDailyChange: true, businessDaysOld: 3 },
  missingDate: { pnl: 25, hasLargeDailyChange: false, businessDaysOld: null },
};

describe("stale data threshold", () => {
  it("only flags data older than the selected number of business days", () => {
    expect(isDataStaleForThreshold(2, 2)).toBe(false);
    expect(isDataStaleForThreshold(3, 2)).toBe(true);
    expect(isDataStaleForThreshold(null, 30)).toBe(true);
  });
});

describe("Quick Scan filters", () => {
  it("matches positive, negative, volatile, and stale holdings independently", () => {
    expect(matchesQuickFilter(holdings.positive, "positive", 2)).toBe(true);
    expect(matchesQuickFilter(holdings.negative, "negative", 2)).toBe(true);
    expect(matchesQuickFilter(holdings.negative, "volatile", 2)).toBe(true);
    expect(matchesQuickFilter(holdings.negative, "stale", 2)).toBe(true);
    expect(matchesQuickFilter(holdings.missingDate, "stale", 2)).toBe(true);
    expect(matchesQuickFilter(holdings.positive, "negative", 2)).toBe(false);
  });
});
