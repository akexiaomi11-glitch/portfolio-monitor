export type StockHistoryCandidate = {
  name: string;
  currentValue: number;
  cost: number;
  pnl: number;
  dailyChangePercent: number;
  sourceDate: Date | null;
};

export type StockHistoryRecord = {
  assetName: string;
  currentValue: number;
  cost: number;
  pnl: number;
  pnlPercent: number;
  dailyChangePercent: number;
  sourceDate: Date;
};

function dayKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function stockHistoryKey(assetName: string, sourceDate: Date) {
  return `${assetName}::${dayKey(sourceDate)}`;
}

export function shouldInsertStockHistory(assetName: string, sourceDate: Date, existingKeys: Set<string>) {
  const key = stockHistoryKey(assetName, sourceDate);
  if (existingKeys.has(key)) return false;
  existingKeys.add(key);
  return true;
}

export function buildStockHistoryRecords(holdings: StockHistoryCandidate[]): StockHistoryRecord[] {
  const grouped = new Map<string, StockHistoryRecord & { weightedDailyChange: number }>();

  for (const holding of holdings) {
    if (!holding.sourceDate) continue;
    const key = stockHistoryKey(holding.name, holding.sourceDate);
    const existing = grouped.get(key);
    const weightedDailyChange = holding.dailyChangePercent * holding.currentValue;

    if (existing) {
      existing.currentValue += holding.currentValue;
      existing.cost += holding.cost;
      existing.pnl += holding.pnl;
      existing.weightedDailyChange += weightedDailyChange;
      continue;
    }

    grouped.set(key, {
      assetName: holding.name,
      currentValue: holding.currentValue,
      cost: holding.cost,
      pnl: holding.pnl,
      pnlPercent: 0,
      dailyChangePercent: 0,
      weightedDailyChange,
      sourceDate: holding.sourceDate,
    });
  }

  return Array.from(grouped.values()).map(({ weightedDailyChange, ...record }) => ({
    ...record,
    pnlPercent: record.cost === 0 ? 0 : (record.pnl / record.cost) * 100,
    dailyChangePercent: record.currentValue === 0 ? 0 : weightedDailyChange / record.currentValue,
  }));
}
