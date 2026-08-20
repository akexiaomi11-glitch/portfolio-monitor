import { describe, expect, it } from "vitest";
import {
  LARGE_DAILY_CHANGE_THRESHOLD,
  buildPortfolioSnapshot,
  businessDaysSince,
  isStale,
  parsePortfolioCsv,
} from "./portfolio";

const sampleCsv = `" ","มูลค่าปัจจุบัน","P&L","%P&L","%Chg","วันอัพเดพ","Status"
"AAA","1,200","200","20.00%","0.200%","14 ส.ค. 2569","Active"
"BBB","800","-200","-20.00%","-1.250%","14/8/2026","ACTIVE"
"ARCHIVED","9,999","999","11.10%","2.000%","14/8/2026","Disable"
"ยอดรวม","2,000","","","","",""`;

describe("portfolio CSV parsing", () => {
  it("parses complete holding rows and derives the invested capital", () => {
    const holdings = parsePortfolioCsv(sampleCsv, new Date(Date.UTC(2026, 7, 18)));

    expect(holdings).toHaveLength(2);
    expect(holdings.find(holding => holding.name === "AAA")).toMatchObject({
      currentValue: 1200,
      pnl: 200,
      cost: 1000,
      isStale: false,
      status: "Active",
    });
    expect(holdings.find(holding => holding.name === "BBB")).toMatchObject({
      isNegativePnl: true,
      hasLargeDailyChange: true,
      attentionReasons: ["ผลตอบแทนติดลบ", "ความเคลื่อนไหวรายวันสูง"],
    });
    expect(holdings.some(holding => holding.name === "ARCHIVED")).toBe(false);
  });

  it("calculates summary KPIs only from valid holding rows", () => {
    const snapshot = buildPortfolioSnapshot(sampleCsv, new Date(Date.UTC(2026, 7, 18)));

    expect(snapshot.summary).toMatchObject({
      totalValue: 2000,
      totalCost: 2000,
      totalPnl: 0,
      totalPnlPercent: 0,
      positiveCount: 1,
      negativeCount: 1,
      largeMoveCount: 1,
    });
  });
});

describe("business-day stale data logic", () => {
  it("does not flag exactly two business days old data as stale, but flags more than two", () => {
    const friday = new Date(Date.UTC(2026, 7, 14));
    const tuesday = new Date(Date.UTC(2026, 7, 18));
    const wednesday = new Date(Date.UTC(2026, 7, 19));

    expect(businessDaysSince(friday, tuesday)).toBe(2);
    expect(isStale(friday, tuesday)).toBe(false);
    expect(isStale(friday, wednesday)).toBe(true);
  });

  it("uses a one percent daily-move threshold", () => {
    expect(LARGE_DAILY_CHANGE_THRESHOLD).toBe(1);
  });
});
