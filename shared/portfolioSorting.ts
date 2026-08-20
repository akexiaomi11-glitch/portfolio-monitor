export const portfolioSortOptions = [
  { value: "attention", label: "รายการผิดปกติ" },
  { value: "name", label: "กองทุน / หุ้น" },
  { value: "currentValue", label: "มูลค่าปัจจุบัน" },
  { value: "cost", label: "ทุน" },
  { value: "pnl", label: "P&L" },
  { value: "pnlPercent", label: "%P&L" },
  { value: "dailyChangePercent", label: "%Change วันนี้" },
  { value: "updatedDate", label: "วันที่อัปเดต" },
] as const;

export type PortfolioSortField = (typeof portfolioSortOptions)[number]["value"];
export type PortfolioSortDirection = "asc" | "desc";

export type SortableHolding = {
  name: string;
  currentValue: number;
  cost: number;
  pnl: number;
  pnlPercent: number;
  dailyChangePercent: number;
  businessDaysOld: number | null;
  attentionReasons: string[];
};

export function sortPortfolioHoldings<T extends SortableHolding>(
  holdings: T[],
  field: PortfolioSortField,
  direction: PortfolioSortDirection,
): T[] {
  const multiplier = direction === "asc" ? 1 : -1;
  return [...holdings].sort((left, right) => {
    if (field === "name") return left.name.localeCompare(right.name, "th") * multiplier;

    const valueFor = (holding: T): number => {
      if (field === "attention") return holding.attentionReasons.length;
      if (field === "updatedDate") return holding.businessDaysOld ?? Number.POSITIVE_INFINITY;
      return holding[field];
    };

    const difference = valueFor(left) - valueFor(right);
    if (difference !== 0) return difference * multiplier;
    return right.currentValue - left.currentValue;
  });
}
