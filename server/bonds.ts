import { fetchSheetValues } from "./googleSheets";

export const GOOGLE_SHEET_BOND_RANGE = "Bond";

const THAI_MONTH_ORDER = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];

export type BondMonthEntry = {
  year: number;
  month: number;
  status: "received" | "missed" | "not-due";
  amount: number | null;
};

export type Bond = {
  id: string;
  name: string;
  principal: number | null;
  isMatured: boolean;
  interestRatePercent: number | null;
  paymentPerInstallment: number | null;
  depositAccount: string | null;
  interestDay: string | null;
  purchaseDate: Date | null;
  maturityDate: Date | null;
  maturityNote: string | null;
  totalInterestReceived: number | null;
  monthly: BondMonthEntry[];
  hasMissedPayment: boolean;
};

export type BondUpcomingPayment = {
  bondId: string;
  bondName: string;
  year: number;
  month: number;
  estimatedAmount: number | null;
};

export type BondSnapshot = {
  bonds: Bond[];
  summary: {
    totalPrincipal: number;
    totalInterestReceived: number;
    activeCount: number;
    maturedCount: number;
    missedPaymentCount: number;
  };
  yearly: { year: number; total: number }[];
  monthly: { year: number; month: number; total: number }[];
  upcomingPayments: BondUpcomingPayment[];
  syncedAt: Date;
};

const UPCOMING_PAYMENT_MONTHS_AHEAD = 6;

function parseNumber(value: string | undefined): number | null {
  if (!value) return null;
  const cleaned = value.replace(/[,\s]/g, "");
  if (!cleaned || cleaned === "-") return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseBuddhistDate(value: string | undefined): Date | null {
  if (!value) return null;
  const match = value.trim().match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (!match) return null;
  const year = Number(match[1]) - 543;
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return date;
}

function splitMaturityCell(value: string | undefined): { date: Date | null; note: string | null } {
  if (!value) return { date: null, note: null };
  const trimmed = value.trim();
  const noteMatch = trimmed.match(/\(([^)]+)\)\s*$/);
  const note = noteMatch ? noteMatch[1] : null;
  return { date: parseBuddhistDate(trimmed), note };
}

type MonthColumn = { columnIndex: number; year: number; month: number };

function buildMonthColumns(yearRow: string[], monthRow: string[]): MonthColumn[] {
  const columns: MonthColumn[] = [];
  let currentYear: number | null = null;

  for (let columnIndex = 0; columnIndex < monthRow.length; columnIndex += 1) {
    const monthLabel = monthRow[columnIndex]?.trim();
    const monthIndex = THAI_MONTH_ORDER.indexOf(monthLabel ?? "");
    if (monthIndex === -1) continue;

    const yearLabel = yearRow[columnIndex]?.trim();
    if (yearLabel) currentYear = Number(yearLabel) - 543;
    if (currentYear === null) continue;

    columns.push({ columnIndex, year: currentYear, month: monthIndex + 1 });
  }

  return columns;
}

export function parseBondRows(rows: string[][], referenceDate = new Date()): Bond[] {
  if (rows.length < 3) return [];

  const monthColumns = buildMonthColumns(rows[0] ?? [], rows[1] ?? []);

  const bonds = rows.slice(2).flatMap((row, rowIndex) => {
    const name = row[2]?.trim();
    if (!name) return [];

    const principalOutstanding = parseNumber(row[7]);
    const principalMatured = parseNumber(row[8]);
    const { date: maturityDate, note: maturityNote } = splitMaturityCell(row[0]);
    const isMatured = principalMatured !== null || (maturityDate !== null && maturityDate <= referenceDate);

    const referenceYear = referenceDate.getUTCFullYear();
    const referenceMonth = referenceDate.getUTCMonth() + 1;

    const monthly: BondMonthEntry[] = monthColumns.map(column => {
      const isFuture = column.year > referenceYear || (column.year === referenceYear && column.month > referenceMonth);
      if (isFuture) return { year: column.year, month: column.month, status: "not-due", amount: null };

      const raw = row[column.columnIndex]?.trim();
      if (!raw) return { year: column.year, month: column.month, status: "not-due", amount: null };
      if (raw === "-") return { year: column.year, month: column.month, status: "missed", amount: null };
      return { year: column.year, month: column.month, status: "received", amount: parseNumber(raw) };
    });

    const hasMissedPayment = monthly.some(entry => entry.status === "missed");

    return [
      {
        id: `${name}-${rowIndex}`,
        name,
        principal: principalOutstanding ?? principalMatured,
        isMatured,
        interestRatePercent: parseNumber(row[3]),
        paymentPerInstallment: parseNumber(row[4]),
        depositAccount: row[5]?.trim() || null,
        interestDay: row[6]?.trim() || null,
        purchaseDate: parseBuddhistDate(row[1]),
        maturityDate,
        maturityNote,
        totalInterestReceived: parseNumber(row[9]),
        monthly,
        hasMissedPayment,
      },
    ];
  });

  return bonds;
}

function absoluteMonthIndex(year: number, month: number): number {
  return year * 12 + (month - 1);
}

// Bonds don't publish a payment calendar, only actual receipts, so the forward
// schedule is inferred from the most recent gap between two real payments
// (steady-state cadence — quarterly/semi-annual/annual) rather than the
// possibly-irregular first payment.
export function computeUpcomingPayments(bonds: Bond[], referenceDate = new Date(), monthsAhead = UPCOMING_PAYMENT_MONTHS_AHEAD): BondUpcomingPayment[] {
  const currentIdx = absoluteMonthIndex(referenceDate.getUTCFullYear(), referenceDate.getUTCMonth() + 1);
  const windowEndIdx = currentIdx + monthsAhead - 1;

  const upcoming: BondUpcomingPayment[] = [];

  for (const bond of bonds) {
    if (bond.isMatured) continue;

    const received = bond.monthly
      .filter(entry => entry.status === "received")
      .map(entry => ({ idx: absoluteMonthIndex(entry.year, entry.month), amount: entry.amount }))
      .sort((left, right) => left.idx - right.idx);

    if (received.length < 2) continue;

    const last = received[received.length - 1]!;
    const secondLast = received[received.length - 2]!;
    const interval = last.idx - secondLast.idx;
    if (interval <= 0) continue;

    const recentAmounts = received.slice(-3).map(entry => entry.amount).filter((amount): amount is number => amount !== null);
    const averageAmount = recentAmounts.length > 0 ? recentAmounts.reduce((sum, amount) => sum + amount, 0) / recentAmounts.length : null;
    const estimatedAmount = bond.paymentPerInstallment ?? averageAmount;

    for (let projectedIdx = last.idx + interval; projectedIdx <= windowEndIdx; projectedIdx += interval) {
      if (projectedIdx < currentIdx) continue;
      upcoming.push({
        bondId: bond.id,
        bondName: bond.name,
        year: Math.floor(projectedIdx / 12),
        month: (projectedIdx % 12) + 1,
        estimatedAmount,
      });
    }
  }

  return upcoming.sort((left, right) => absoluteMonthIndex(left.year, left.month) - absoluteMonthIndex(right.year, right.month) || left.bondName.localeCompare(right.bondName));
}

export function buildBondSnapshot(rows: string[][], referenceDate = new Date()): BondSnapshot {
  const bonds = parseBondRows(rows, referenceDate);

  const yearlyTotals = new Map<number, number>();
  const monthlyTotals = new Map<string, { year: number; month: number; total: number }>();

  for (const bond of bonds) {
    for (const entry of bond.monthly) {
      if (entry.status !== "received" || entry.amount === null) continue;
      yearlyTotals.set(entry.year, (yearlyTotals.get(entry.year) ?? 0) + entry.amount);
      const key = `${entry.year}-${entry.month}`;
      const existing = monthlyTotals.get(key);
      if (existing) {
        existing.total += entry.amount;
      } else {
        monthlyTotals.set(key, { year: entry.year, month: entry.month, total: entry.amount });
      }
    }
  }

  return {
    bonds,
    summary: {
      totalPrincipal: bonds.reduce((sum, bond) => sum + (bond.principal ?? 0), 0),
      totalInterestReceived: bonds.reduce((sum, bond) => sum + (bond.totalInterestReceived ?? 0), 0),
      activeCount: bonds.filter(bond => !bond.isMatured).length,
      maturedCount: bonds.filter(bond => bond.isMatured).length,
      missedPaymentCount: bonds.filter(bond => bond.hasMissedPayment).length,
    },
    yearly: Array.from(yearlyTotals.entries(), ([year, total]) => ({ year, total })).sort((left, right) => left.year - right.year),
    monthly: Array.from(monthlyTotals.values()).sort((left, right) => left.year - right.year || left.month - right.month),
    upcomingPayments: computeUpcomingPayments(bonds, referenceDate),
    syncedAt: referenceDate,
  };
}

let snapshotCache: { snapshot: BondSnapshot; expiresAt: number } | null = null;
const SNAPSHOT_CACHE_TTL_MS = 300_000;

export async function fetchBondSnapshot(forceRefresh = false): Promise<BondSnapshot> {
  if (!forceRefresh && snapshotCache && snapshotCache.expiresAt > Date.now()) {
    return snapshotCache.snapshot;
  }

  const values = await fetchSheetValues(GOOGLE_SHEET_BOND_RANGE);
  const snapshot = buildBondSnapshot(values);
  snapshotCache = {
    snapshot,
    expiresAt: Date.now() + SNAPSHOT_CACHE_TTL_MS,
  };
  return snapshot;
}
