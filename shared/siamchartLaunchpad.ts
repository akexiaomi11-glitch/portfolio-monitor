export type LaunchpadCategory = "technology" | "us_equity" | "fixed_income" | "global_growth";

export type SiamchartLaunchpadFund = {
  symbol: string;
  provider: string;
  category: LaunchpadCategory;
  url: string;
};

export const siamchartLaunchpadFunds: SiamchartLaunchpadFund[] = [
  { symbol: "B-INNOTECHRMF", provider: "Bualuang", category: "technology", url: "https://siamchart.com/fund-chart/B-INNOTECHRMF/" },
  { symbol: "BFIXED", provider: "Bualuang", category: "fixed_income", url: "https://siamchart.com/fund-chart/BFIXED/" },
  { symbol: "SCBS&P500A", provider: "SCBAM", category: "us_equity", url: "https://siamchart.com/fund-chart/SCBS_26P500A/" },
  { symbol: "SCBS&P500E", provider: "SCBAM", category: "us_equity", url: "https://siamchart.com/fund-chart/SCBS_26P500E/" },
  { symbol: "SCBRMS&P500", provider: "SCBAM", category: "us_equity", url: "https://siamchart.com/fund-chart/SCBRMS_26P500/" },
  { symbol: "KFGTECHRMF", provider: "Krungsri", category: "technology", url: "https://siamchart.com/fund-chart/KFGTECHRMF/" },
  { symbol: "ES-GQGRMF", provider: "Eastspring", category: "global_growth", url: "https://siamchart.com/fund-chart/ES-GQGRMF/" },
];

export function filterSiamchartLaunchpadFunds(
  funds: SiamchartLaunchpadFund[],
  category: LaunchpadCategory | "all",
  searchTerm: string,
) {
  const normalizedSearch = searchTerm.trim().toLowerCase();
  return funds.filter(fund => {
    const categoryMatches = category === "all" || fund.category === category;
    const textMatches = !normalizedSearch || `${fund.symbol} ${fund.provider}`.toLowerCase().includes(normalizedSearch);
    return categoryMatches && textMatches;
  });
}

export function getSiamchartLaunchUrls(funds: SiamchartLaunchpadFund[]) {
  return funds.map(fund => fund.url);
}

export function buildSiamchartTabRequests(funds: SiamchartLaunchpadFund[]) {
  return funds.map(fund => ({
    url: fund.url,
    target: `siamchart-chart-${fund.symbol.replace(/[^a-zA-Z0-9]/g, "-").toLowerCase()}`,
  }));
}

export function getSiamchartLaunchStatusMessage(openedCount: number, requestedCount: number) {
  if (openedCount === requestedCount) return `เปิดกราฟครบ ${openedCount} แท็บแล้ว`;
  return `เปิดได้ ${openedCount} จาก ${requestedCount} แท็บ เบราว์เซอร์ยังบล็อกบางแท็บอยู่ โปรดอนุญาต pop-up สำหรับเว็บไซต์นี้แล้วลองใหม่`;
}
