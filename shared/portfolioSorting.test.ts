import { describe, expect, it } from "vitest";
import { sortPortfolioHoldings } from "./portfolioSorting";

const holdings = [
  { name: "Safe", currentValue: 1000, cost: 900, pnl: 100, pnlPercent: 11.11, dailyChangePercent: 0.1, businessDaysOld: 1, attentionReasons: [] },
  { name: "Watch", currentValue: 500, cost: 600, pnl: -100, pnlPercent: -16.67, dailyChangePercent: -1.2, businessDaysOld: 3, attentionReasons: ["ผลตอบแทนติดลบ", "ความเคลื่อนไหวรายวันสูง"] },
  { name: "Stale", currentValue: 700, cost: 650, pnl: 50, pnlPercent: 7.69, dailyChangePercent: 0.2, businessDaysOld: 4, attentionReasons: ["ข้อมูลเกิน 2 วันทำการ"] },
];

describe("portfolio holdings sorting", () => {
  it("puts items requiring the most attention first by default", () => {
    const sorted = sortPortfolioHoldings(holdings, "attention", "desc");
    expect(sorted.map(holding => holding.name)).toEqual(["Watch", "Stale", "Safe"]);
  });

  it("sorts numerical values in both ascending and descending directions", () => {
    expect(sortPortfolioHoldings(holdings, "currentValue", "asc").map(holding => holding.name)).toEqual(["Watch", "Stale", "Safe"]);
    expect(sortPortfolioHoldings(holdings, "currentValue", "desc").map(holding => holding.name)).toEqual(["Safe", "Stale", "Watch"]);
  });
});
