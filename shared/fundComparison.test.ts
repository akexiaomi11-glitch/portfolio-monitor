import { describe, expect, it } from "vitest";
import { buildNormalizedComparisonSeries, calculateNormalizedChange, getComparisonRangeStart, toggleComparisonSelection } from "./fundComparison";

const points = [
  { assetKey: "a", timestamp: 1, value: 100 },
  { assetKey: "b", timestamp: 1, value: 200 },
  { assetKey: "a", timestamp: 2, value: 110 },
  { assetKey: "b", timestamp: 2, value: 180 },
];

describe("fund comparison normalization", () => {
  it("rebases each selected asset to zero percent at its first point", () => {
    const rows = buildNormalizedComparisonSeries(points, ["a", "b"]);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ a: 0, b: 0 });
    expect(Number(rows[1]?.a)).toBeCloseTo(10);
    expect(Number(rows[1]?.b)).toBeCloseTo(-10);
  });

  it("calculates a change from the first to the latest observed value", () => {
    expect(calculateNormalizedChange(points.filter(point => point.assetKey === "a"))).toBeCloseTo(10);
    expect(calculateNormalizedChange([points[0]!])).toBeNull();
  });

  it("toggles an asset without imposing a hidden selection limit", () => {
    expect(toggleComparisonSelection(["a", "b"], "a")).toEqual(["b"]);
    expect(toggleComparisonSelection(["a", "b"], "c")).toEqual(["a", "b", "c"]);
  });

  it("returns the correct cutoff for each chart time range", () => {
    const now = 1_000_000_000;
    expect(getComparisonRangeStart("30", now)).toBe(now - 30 * 86_400_000);
    expect(getComparisonRangeStart("180", now)).toBe(now - 180 * 86_400_000);
    expect(getComparisonRangeStart("all", now)).toBeNull();
  });
});
