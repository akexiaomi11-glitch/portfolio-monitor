import { describe, expect, it } from "vitest";
import { buildSiamchartTabRequests, filterSiamchartLaunchpadFunds, getSiamchartLaunchStatusMessage, getSiamchartLaunchUrls, siamchartLaunchpadFunds } from "./siamchartLaunchpad";

describe("Siamchart Launchpad fund selection", () => {
  it("returns only the requested category", () => {
    const results = filterSiamchartLaunchpadFunds(siamchartLaunchpadFunds, "us_equity", "");
    expect(results.map(fund => fund.symbol)).toEqual(["SCBS&P500A", "SCBS&P500E", "SCBRMS&P500"]);
  });

  it("filters by fund symbol or provider without changing the source URLs", () => {
    const results = filterSiamchartLaunchpadFunds(siamchartLaunchpadFunds, "all", "krungsri");
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      symbol: "KFGTECHRMF",
      url: "https://siamchart.com/fund-chart/KFGTECHRMF/",
    });
  });

  it("returns all launch URLs in the visible fund order", () => {
    const technologyFunds = filterSiamchartLaunchpadFunds(siamchartLaunchpadFunds, "technology", "");
    expect(getSiamchartLaunchUrls(technologyFunds)).toEqual([
      "https://siamchart.com/fund-chart/B-INNOTECHRMF/",
      "https://siamchart.com/fund-chart/KFGTECHRMF/",
    ]);
  });

  it("creates a stable, distinct browser target for every fund", () => {
    const requests = buildSiamchartTabRequests(siamchartLaunchpadFunds.slice(0, 2));
    expect(requests).toEqual([
      { url: "https://siamchart.com/fund-chart/B-INNOTECHRMF/", target: "siamchart-chart-b-innotechrmf" },
      { url: "https://siamchart.com/fund-chart/BFIXED/", target: "siamchart-chart-bfixed" },
    ]);
  });

  it("explains whether the browser opened every requested tab", () => {
    expect(getSiamchartLaunchStatusMessage(2, 2)).toBe("เปิดกราฟครบ 2 แท็บแล้ว");
    expect(getSiamchartLaunchStatusMessage(1, 2)).toContain("เปิดได้ 1 จาก 2 แท็บ");
    expect(getSiamchartLaunchStatusMessage(1, 2)).toContain("อนุญาต pop-up");
  });
});
