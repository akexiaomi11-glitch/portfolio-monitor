export type PortfolioChartHolding = {
  name: string;
  currentValue: number;
  cost: number;
  pnl: number;
  pnlPercent: number;
};

export type ProvidentFundForChart = {
  fundName: string;
  value: number;
  cost: number;
  pnl: number;
  pnlPercent: number | null;
};

export function combineHoldingsForChart(
  stockHoldings: PortfolioChartHolding[],
  providentFund?: ProvidentFundForChart | null,
): PortfolioChartHolding[] {
  if (!providentFund) return stockHoldings;

  return [{
    name: providentFund.fundName,
    currentValue: providentFund.value,
    cost: providentFund.cost,
    pnl: providentFund.pnl,
    pnlPercent: providentFund.pnlPercent ?? 0,
  }, ...stockHoldings];
}
