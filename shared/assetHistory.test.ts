import { describe, expect, it } from "vitest";
import { buildStockHistoryRecords, shouldInsertStockHistory } from "./assetHistory";

describe("stock history record building", () => {
  it("only records holdings with a source date and groups duplicate names on the same date", () => {
    const records = buildStockHistoryRecords([
      { name: "Fund A", currentValue: 1200, cost: 1000, pnl: 200, dailyChangePercent: 1, sourceDate: new Date("2026-08-18T00:00:00Z") },
      { name: "Fund A", currentValue: 800, cost: 700, pnl: 100, dailyChangePercent: -0.5, sourceDate: new Date("2026-08-18T00:00:00Z") },
      { name: "Fund B", currentValue: 300, cost: 300, pnl: 0, dailyChangePercent: 0, sourceDate: null },
    ]);

    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({
      assetName: "Fund A",
      currentValue: 2000,
      cost: 1700,
      pnl: 300,
      pnlPercent: expect.closeTo(17.647, 2),
      dailyChangePercent: expect.closeTo(0.4, 2),
    });
  });
});

describe("stock history duplicate prevention", () => {
  it("inserts once for the same asset and source date, then permits the next source date", () => {
    const knownHistory = new Set<string>();
    const august13 = new Date("2026-08-13T00:00:00Z");
    const august14 = new Date("2026-08-14T00:00:00Z");

    expect(shouldInsertStockHistory("Fund A", august13, knownHistory)).toBe(true);
    expect(shouldInsertStockHistory("Fund A", august13, knownHistory)).toBe(false);
    expect(shouldInsertStockHistory("Fund A", august14, knownHistory)).toBe(true);
  });
});
