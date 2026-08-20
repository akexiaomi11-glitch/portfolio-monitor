import { fetchSheetValues } from "./googleSheets";

export const GOOGLE_SHEET_PVF_MONTHLY_RANGE = "PVF_Monthly";
export const GOOGLE_SHEET_PVF_WEEKLY_RANGE = "PVF_Weekly";

const THAI_FULL_MONTHS: Record<string, number> = {
  "มกราคม": 1,
  "กุมภาพันธ์": 2,
  "มีนาคม": 3,
  "เมษายน": 4,
  "พฤษภาคม": 5,
  "มิถุนายน": 6,
  "กรกฎาคม": 7,
  "กรกฏาคม": 7, // sheet has this misspelling for July
  "สิงหาคม": 8,
  "กันยายน": 9,
  "ตุลาคม": 10,
  "พฤศจิกายน": 11,
  "ธันวาคม": 12,
};

export type ProvidentFundMonthlyPoint = {
  label: string;
  monthDate: Date;
  memberContribution: number;
  memberReturn: number;
  employerContribution: number;
  employerReturn: number;
  capital: number;
  pnl: number;
  total: number;
};

export type ProvidentFundLatest = {
  asOfDate: Date;
  fundName: string;
  value: number;
  nav: number | null;
  memberUnits: number | null;
  employerUnits: number | null;
  units: number | null;
  cumulativeReturnPercent: number | null;
  capital: number;
  lifetimePnl: number;
  lifetimePnlPercent: number | null;
  ytdPnl: number;
};

export type ProvidentFundWeeklyPoint = {
  asOfDate: Date;
  fundName: string;
  value: number;
  nav: number | null;
  cumulativeReturnPercent: number | null;
  memberUnits: number | null;
  employerUnits: number | null;
  units: number | null;
};

export type ProvidentFundSnapshot = {
  latest: ProvidentFundLatest | null;
  monthly: ProvidentFundMonthlyPoint[];
  weekly: ProvidentFundWeeklyPoint[];
  syncedAt: Date;
};

function parseNumber(value: string | undefined): number | null {
  if (!value) return null;
  const cleaned = value.replace(/[,\s]/g, "");
  if (!cleaned || cleaned === "-") return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseThaiMonthLabel(value: string | undefined): Date | null {
  if (!value) return null;
  const match = value.trim().match(/^([ก-๙]+)\s+(\d{4})$/);
  if (!match) return null;
  const month = THAI_FULL_MONTHS[match[1]];
  if (!month) return null;
  const year = Number(match[2]) - 543;
  return new Date(Date.UTC(year, month - 1, 1));
}

function parseThaiShortDate(value: string | undefined): Date | null {
  if (!value) return null;
  const match = value.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return null;
  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]) - 543;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return date;
}

export function parseMonthlyRows(rows: string[][]): ProvidentFundMonthlyPoint[] {
  if (rows.length < 2) return [];

  const points = rows.slice(1).flatMap(row => {
    const monthDate = parseThaiMonthLabel(row[0]);
    const memberContribution = parseNumber(row[1]);
    const memberReturn = parseNumber(row[2]);
    const employerContribution = parseNumber(row[3]);
    const employerReturn = parseNumber(row[4]);
    const total = parseNumber(row[5]);

    if (
      !monthDate ||
      memberContribution === null ||
      memberReturn === null ||
      employerContribution === null ||
      employerReturn === null ||
      total === null
    ) {
      return [];
    }

    return [
      {
        label: row[0]!.trim(),
        monthDate,
        memberContribution,
        memberReturn,
        employerContribution,
        employerReturn,
        capital: memberContribution + employerContribution,
        pnl: memberReturn + employerReturn,
        total,
      },
    ];
  });

  return points.sort((left, right) => left.monthDate.getTime() - right.monthDate.getTime());
}

export function parseWeeklyRows(rows: string[][]): ProvidentFundWeeklyPoint[] {
  if (rows.length < 2) return [];

  const points = rows.slice(1).flatMap(row => {
    const asOfDate = parseThaiShortDate(row[0]);
    const fundName = row[1]?.trim();
    const value = parseNumber(row[2]);
    if (!asOfDate || !fundName || value === null) return [];

    const memberUnits = parseNumber(row[5]);
    const employerUnits = parseNumber(row[6]);

    return [
      {
        asOfDate,
        fundName,
        value,
        nav: parseNumber(row[3]),
        cumulativeReturnPercent: parseNumber(row[4]),
        memberUnits,
        employerUnits,
        units: memberUnits !== null && employerUnits !== null ? memberUnits + employerUnits : null,
      },
    ];
  });

  return points.sort((left, right) => left.asOfDate.getTime() - right.asOfDate.getTime());
}

export function buildProvidentFundSnapshot(monthlyRows: string[][], weeklyRows: string[][]): ProvidentFundSnapshot {
  const monthly = parseMonthlyRows(monthlyRows);
  const weekly = parseWeeklyRows(weeklyRows);
  const latestWeekly = weekly.length > 0 ? weekly[weekly.length - 1] : null;
  const latestMonth = monthly.length > 0 ? monthly[monthly.length - 1] : null;

  if (!latestWeekly && !latestMonth) {
    return { latest: null, monthly, weekly, syncedAt: new Date() };
  }

  const asOfDate = latestWeekly?.asOfDate ?? latestMonth!.monthDate;
  const value = latestWeekly?.value ?? latestMonth!.total;
  const capitalMonth = [...monthly].reverse().find(month => month.monthDate <= asOfDate) ?? latestMonth;
  const capital = capitalMonth?.capital ?? 0;
  const lifetimePnl = value - capital;
  const lifetimePnlPercent = capital > 0 ? (lifetimePnl / capital) * 100 : null;

  const currentYear = asOfDate.getUTCFullYear();
  const priorYearEnd = [...monthly].reverse().find(month => month.monthDate.getUTCFullYear() < currentYear);
  const ytdPnl = (capitalMonth?.pnl ?? lifetimePnl) - (priorYearEnd?.pnl ?? 0);

  return {
    latest: {
      asOfDate,
      fundName: latestWeekly?.fundName ?? "Provident Fund",
      value,
      nav: latestWeekly?.nav ?? null,
      memberUnits: latestWeekly?.memberUnits ?? null,
      employerUnits: latestWeekly?.employerUnits ?? null,
      units: latestWeekly?.units ?? null,
      cumulativeReturnPercent: latestWeekly?.cumulativeReturnPercent ?? null,
      capital,
      lifetimePnl,
      lifetimePnlPercent,
      ytdPnl,
    },
    monthly,
    weekly,
    syncedAt: new Date(),
  };
}

let snapshotCache: { snapshot: ProvidentFundSnapshot; expiresAt: number } | null = null;
const SNAPSHOT_CACHE_TTL_MS = 300_000;

export async function fetchProvidentFundSnapshot(forceRefresh = false): Promise<ProvidentFundSnapshot> {
  if (!forceRefresh && snapshotCache && snapshotCache.expiresAt > Date.now()) {
    return snapshotCache.snapshot;
  }

  const [monthlyRows, weeklyRows] = await Promise.all([
    fetchSheetValues(GOOGLE_SHEET_PVF_MONTHLY_RANGE),
    fetchSheetValues(GOOGLE_SHEET_PVF_WEEKLY_RANGE),
  ]);

  const snapshot = buildProvidentFundSnapshot(monthlyRows, weeklyRows);
  snapshotCache = { snapshot, expiresAt: Date.now() + SNAPSHOT_CACHE_TTL_MS };
  return snapshot;
}
