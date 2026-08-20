import { describe, expect, it } from "vitest";
import { combineHoldingsForChart } from "./portfolioComposition";

const stockHolding = {
  name: "Stock Fund",
  currentValue: 12000,
  cost: 10000,
  pnl: 2000,
  pnlPercent: 20,
};

describe("portfolio chart composition", () => {
  it("adds the latest Provident Fund with cost, P&L, and %P&L when data is available", () => {
    const result = combineHoldingsForChart([stockHolding], {
      fundName: "SCB Provident Fund",
      value: 30000,
      cost: 24000,
      pnl: 6000,
      pnlPercent: 25,
    });

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      name: "SCB Provident Fund",
      currentValue: 30000,
      cost: 24000,
      pnl: 6000,
      pnlPercent: 25,
    });
  });

  it("keeps stock holdings unchanged when there is no Provident Fund data yet", () => {
    expect(combineHoldingsForChart([stockHolding], null)).toEqual([stockHolding]);
    expect(combineHoldingsForChart([stockHolding])).toEqual([stockHolding]);
  });
});
