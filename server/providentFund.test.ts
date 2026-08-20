import { describe, expect, it } from "vitest";
import { buildProvidentFundSnapshot, parseMonthlyRows } from "./providentFund";

const monthlyHeader = ["Month/เดือน", "เงินสะสม", "ผลประโยชน์ของเงินสะสม", "เงินสมทม", "ผลประโยชน์ของเงินสมทบ", "รวม"];
// Deliberately out of order, and using the sheet's misspelled "กรกฏาคม" for July.
const monthlyRows = [
  monthlyHeader,
  ["กรกฏาคม 2569", "950,000", "350,000", "950,000", "350,000", "2,600,000"],
  ["ธันวาคม 2568", "900,000", "300,000", "900,000", "300,000", "2,400,000"],
  ["มกราคม 2569", "910,000", "310,000", "910,000", "310,000", "2,440,000"],
];

const weeklyHeader = ["วันที่", "ชื่อกองทุน", "มูลค่าสุทธิ", "NAV ต่อหน่วย", "ผลตอบแทนสะสม (YTD) %", "หน่วย(สมาชิก)", "หน่วย(นายจ้าง)"];
// Earlier date listed first to prove the parser picks max(asOfDate), not the first row.
const weeklyRows = [
  weeklyHeader,
  ["13/07/2569", "PVDWorld", "2,600,000", "13.9", "12.0", "99,000", "99,000"],
  ["27/07/2569", "PVDWorld", "2,650,000", "14.05", "12.5", "100,000", "100,000"],
];

describe("provident fund sheet parsing", () => {
  it("parses monthly rows, resolves the July typo, converts Buddhist years, and sorts ascending", () => {
    const monthly = parseMonthlyRows(monthlyRows);

    expect(monthly.map(point => point.label)).toEqual(["ธันวาคม 2568", "มกราคม 2569", "กรกฏาคม 2569"]);
    expect(monthly[0].monthDate).toEqual(new Date(Date.UTC(2025, 11, 1)));
    expect(monthly[2].monthDate).toEqual(new Date(Date.UTC(2026, 6, 1)));
    expect(monthly[2]).toMatchObject({ capital: 1900000, pnl: 700000, total: 2600000 });
  });

  it("picks the weekly row with the latest date, not the first row, and derives capital/YTD from the matching month", () => {
    const snapshot = buildProvidentFundSnapshot(monthlyRows, weeklyRows);

    expect(snapshot.latest).toMatchObject({
      value: 2650000, // from the 27/07 weekly row, not the 13/07 row
      capital: 1900000, // July 2569 month's capital (monthDate <= asOfDate)
      lifetimePnl: 750000, // 2,650,000 - 1,900,000
      ytdPnl: 100000, // July pnl (700,000) - prior-year-end Dec 2568 pnl (600,000)
    });
    expect(snapshot.latest?.lifetimePnlPercent).toBeCloseTo((750000 / 1900000) * 100, 5);
  });

  it("returns the full weekly history sorted ascending, with units combined", () => {
    const snapshot = buildProvidentFundSnapshot(monthlyRows, weeklyRows);

    expect(snapshot.weekly).toHaveLength(2);
    expect(snapshot.weekly.map(point => point.value)).toEqual([2600000, 2650000]); // 13/07 before 27/07
    expect(snapshot.weekly[1]).toMatchObject({ nav: 14.05, cumulativeReturnPercent: 12.5, units: 200000 });
  });

  it("falls back to the latest monthly row when the weekly tab has no data", () => {
    const snapshot = buildProvidentFundSnapshot(monthlyRows, [weeklyHeader]);

    expect(snapshot.latest).toMatchObject({
      value: 2600000, // July 2569 month's total
      capital: 1900000,
      fundName: "Provident Fund",
      nav: null,
    });
  });
});
