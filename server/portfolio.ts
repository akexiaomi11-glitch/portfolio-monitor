import { GOOGLE_SHEET_VIEW_URL, fetchSheetValues, rowsToCsv } from "./googleSheets";

export const GOOGLE_SHEET_RANGE = "Stock";

export const LARGE_DAILY_CHANGE_THRESHOLD = 1;

export type Holding = {
  id: string;
  name: string;
  status: "Active";
  currentValue: number;
  cost: number;
  pnl: number;
  pnlPercent: number;
  dailyChangePercent: number;
  updatedDate: string | null;
  sourceDate: Date | null;
  businessDaysOld: number | null;
  isStale: boolean;
  isNegativePnl: boolean;
  hasLargeDailyChange: boolean;
  attentionReasons: string[];
};

export type PortfolioSnapshot = {
  holdings: Holding[];
  summary: {
    totalValue: number;
    totalCost: number;
    totalPnl: number;
    totalPnlPercent: number;
    positiveCount: number;
    negativeCount: number;
    largeMoveCount: number;
    staleCount: number;
  };
  syncedAt: Date;
  source: {
    sheetName: string;
    url: string;
  };
};

let snapshotCache: { snapshot: PortfolioSnapshot; expiresAt: number } | null = null;
const SNAPSHOT_CACHE_TTL_MS = 300_000;

function parseCsvLine(line: string): string[] {
  const values: string[] = [];
  let value = "";
  let isInsideQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    const nextCharacter = line[index + 1];

    if (character === '"') {
      if (isInsideQuotes && nextCharacter === '"') {
        value += '"';
        index += 1;
      } else {
        isInsideQuotes = !isInsideQuotes;
      }
    } else if (character === "," && !isInsideQuotes) {
      values.push(value.trim());
      value = "";
    } else {
      value += character;
    }
  }

  values.push(value.trim());
  return values;
}

function parseNumber(value: string | undefined): number | null {
  if (!value) return null;
  const cleaned = value.replace(/[,%฿\s]/g, "");
  if (!cleaned) return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseSheetDate(value: string | undefined): Date | null {
  if (!value) return null;
  const normalizedValue = value.trim();
  const dateMatch = normalizedValue.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  const thaiDateMatch = normalizedValue.match(/^(\d{1,2})\s+([ก-๙.]+)\s+(\d{4})$/);
  if (!dateMatch && !thaiDateMatch) return null;

  const thaiMonthIndexes: Record<string, number> = {
    "ม.ค.": 0,
    "ก.พ.": 1,
    "มี.ค.": 2,
    "เม.ย.": 3,
    "พ.ค.": 4,
    "มิ.ย.": 5,
    "ก.ค.": 6,
    "ส.ค.": 7,
    "ก.ย.": 8,
    "ต.ค.": 9,
    "พ.ย.": 10,
    "ธ.ค.": 11,
  };

  const dayString = dateMatch?.[1] ?? thaiDateMatch?.[1];
  const monthString = dateMatch?.[2];
  const thaiMonthString = thaiDateMatch?.[2];
  const yearString = dateMatch?.[3] ?? thaiDateMatch?.[3];
  const day = Number(dayString);
  const month = monthString ? Number(monthString) : (thaiMonthIndexes[thaiMonthString ?? ""] ?? -1) + 1;
  let year = Number(yearString);
  if (year > 2400) year -= 543;

  const parsedDate = new Date(Date.UTC(year, month - 1, day));
  if (
    parsedDate.getUTCFullYear() !== year ||
    parsedDate.getUTCMonth() !== month - 1 ||
    parsedDate.getUTCDate() !== day
  ) {
    return null;
  }

  return parsedDate;
}

function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export function businessDaysSince(updatedAt: Date, referenceDate: Date): number {
  const start = startOfUtcDay(updatedAt);
  const end = startOfUtcDay(referenceDate);
  if (start >= end) return 0;

  let count = 0;
  const cursor = new Date(start);
  cursor.setUTCDate(cursor.getUTCDate() + 1);

  while (cursor <= end) {
    const dayOfWeek = cursor.getUTCDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) count += 1;
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return count;
}

export function isStale(updatedAt: Date | null, referenceDate: Date): boolean {
  return updatedAt === null || businessDaysSince(updatedAt, referenceDate) > 2;
}

export function parsePortfolioCsv(csv: string, referenceDate = new Date()): Holding[] {
  const rows = csv
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .filter(row => row.trim().length > 0)
    .map(parseCsvLine);

  if (rows.length < 2) return [];

  const header = rows[0].map(cell => cell.trim());
  const indexFor = (label: string) => header.findIndex(cell => cell === label);
  const nameIndex = 0;
  const valueIndex = indexFor("มูลค่าปัจจุบัน");
  const pnlIndex = indexFor("P&L");
  const pnlPercentIndex = indexFor("%P&L");
  const dailyChangeIndex = indexFor("%Chg");
  const updatedIndex = indexFor("วันอัพเดพ");
  const statusIndex = indexFor("Status");

  if ([valueIndex, pnlIndex, pnlPercentIndex, dailyChangeIndex, updatedIndex, statusIndex].some(index => index < 0)) {
    throw new Error("ไม่พบคอลัมน์หลักที่ต้องใช้ในชีต Stock");
  }

  const holdings = rows.slice(1).flatMap((row, rowIndex) => {
    const name = row[nameIndex]?.trim();
    const currentValue = parseNumber(row[valueIndex]);
    const pnl = parseNumber(row[pnlIndex]);
    const pnlPercent = parseNumber(row[pnlPercentIndex]);
    const dailyChangePercent = parseNumber(row[dailyChangeIndex]);
    const status = row[statusIndex]?.trim().toLowerCase();

    if (
      !name ||
      status !== "active" ||
      currentValue === null ||
      pnl === null ||
      pnlPercent === null ||
      dailyChangePercent === null
    ) {
      return [];
    }

    const parsedDate = parseSheetDate(row[updatedIndex]);
    const businessDaysOld = parsedDate ? businessDaysSince(parsedDate, referenceDate) : null;
    const negativePnl = pnl < 0;
    const largeDailyChange = Math.abs(dailyChangePercent) >= LARGE_DAILY_CHANGE_THRESHOLD;
    const stale = isStale(parsedDate, referenceDate);
    const attentionReasons = [
      ...(negativePnl ? ["ผลตอบแทนติดลบ"] : []),
      ...(largeDailyChange ? ["ความเคลื่อนไหวรายวันสูง"] : []),
      ...(stale ? [parsedDate ? "ข้อมูลเกิน 2 วันทำการ" : "ไม่พบวันที่อัปเดต"] : []),
    ];

    return [
      {
        id: `${name}-${rowIndex}`,
        name,
        status: "Active" as const,
        currentValue,
        cost: currentValue - pnl,
        pnl,
        pnlPercent,
        dailyChangePercent,
        updatedDate: row[updatedIndex]?.trim() || null,
        sourceDate: parsedDate,
        businessDaysOld,
        isStale: stale,
        isNegativePnl: negativePnl,
        hasLargeDailyChange: largeDailyChange,
        attentionReasons,
      },
    ];
  });

  return holdings.sort((left, right) => {
    const leftNeedsAttention = left.attentionReasons.length > 0 ? 1 : 0;
    const rightNeedsAttention = right.attentionReasons.length > 0 ? 1 : 0;
    if (leftNeedsAttention !== rightNeedsAttention) return rightNeedsAttention - leftNeedsAttention;
    return right.currentValue - left.currentValue;
  });
}

export function buildPortfolioSnapshot(csv: string, referenceDate = new Date()): PortfolioSnapshot {
  const holdings = parsePortfolioCsv(csv, referenceDate);
  const totalValue = holdings.reduce((sum, holding) => sum + holding.currentValue, 0);
  const totalCost = holdings.reduce((sum, holding) => sum + holding.cost, 0);
  const totalPnl = holdings.reduce((sum, holding) => sum + holding.pnl, 0);

  return {
    holdings,
    summary: {
      totalValue,
      totalCost,
      totalPnl,
      totalPnlPercent: totalCost === 0 ? 0 : (totalPnl / totalCost) * 100,
      positiveCount: holdings.filter(holding => holding.pnl >= 0).length,
      negativeCount: holdings.filter(holding => holding.isNegativePnl).length,
      largeMoveCount: holdings.filter(holding => holding.hasLargeDailyChange).length,
      staleCount: holdings.filter(holding => holding.isStale).length,
    },
    syncedAt: referenceDate,
    source: {
      sheetName: "Stock",
      url: GOOGLE_SHEET_VIEW_URL,
    },
  };
}

export async function fetchPortfolioSnapshot(forceRefresh = false): Promise<PortfolioSnapshot> {
  if (!forceRefresh && snapshotCache && snapshotCache.expiresAt > Date.now()) {
    return snapshotCache.snapshot;
  }

  const values = await fetchSheetValues(GOOGLE_SHEET_RANGE);
  const snapshot = buildPortfolioSnapshot(rowsToCsv(values));
  snapshotCache = {
    snapshot,
    expiresAt: Date.now() + SNAPSHOT_CACHE_TTL_MS,
  };
  return snapshot;
}
