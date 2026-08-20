import { describe, expect, it } from "vitest";
import { buildBondSnapshot, computeUpcomingPayments, parseBondRows, type Bond } from "./bonds";

const yearRow = ["", "", "", "", "", "", "", "", "", "", "2568", "", "2569", "", "2570"];
const monthRow = [
  "ครบกำหนด", "วันที่ซื้อ", "บริษัท", "ดบ(%)", "จ่ายครั้งละ", "เข้า บ/ช", "วันที่ดบ.", "เงินต้น", "เงินต้นที่ครบกำหนด", "ดบ.รับมาแล้ว",
  "ม.ค.", "ก.พ.", "ม.ค.", "ก.พ.", "ม.ค.",
];
const bondA = [
  "2570-01-01 (5Y)", "2565-01-01", "Test Bond A", "4.5", "1,000", "01 SCB", "1", "100,000", "", "5,000",
  "", "1,000", "-", "1,200", "-",
];
const bondB = [
  "2567-01-01 (3Y)", "2564-01-01", "Test Bond B", "3.0", "-", "02 KTB", "15", "", "200,000", "8,000",
  "", "", "", "", "",
];
const footerRow = ["", "", "", "", "", "", "", "300,000", "", "13,000", "", "1,000", "-", "1,200", "-"];

const sampleRows = [yearRow, monthRow, bondA, bondB, footerRow];
const referenceDate = new Date(Date.UTC(2026, 2, 1));

describe("bond sheet parsing", () => {
  it("parses bond rows and skips the totals footer row", () => {
    const bonds = parseBondRows(sampleRows, referenceDate);

    expect(bonds).toHaveLength(2);
    expect(bonds[0]).toMatchObject({
      name: "Test Bond A",
      principal: 100000,
      isMatured: false,
      interestRatePercent: 4.5,
      totalInterestReceived: 5000,
      hasMissedPayment: true,
    });
    expect(bonds[0].monthly).toEqual([
      { year: 2025, month: 1, status: "not-due", amount: null },
      { year: 2025, month: 2, status: "received", amount: 1000 },
      { year: 2026, month: 1, status: "missed", amount: null },
      { year: 2026, month: 2, status: "received", amount: 1200 },
      { year: 2027, month: 1, status: "not-due", amount: null },
    ]);

    expect(bonds[1]).toMatchObject({
      name: "Test Bond B",
      principal: 200000,
      isMatured: true,
      hasMissedPayment: false,
    });
  });

  it("treats a dash in a future month as not-due instead of missed", () => {
    const bonds = parseBondRows(sampleRows, referenceDate);
    const futureEntry = bonds[0].monthly.find(entry => entry.year === 2027 && entry.month === 1);

    expect(futureEntry).toMatchObject({ status: "not-due", amount: null });
  });

  it("aggregates yearly and monthly interest totals across bonds", () => {
    const snapshot = buildBondSnapshot(sampleRows, referenceDate);

    expect(snapshot.summary).toMatchObject({
      totalPrincipal: 300000,
      totalInterestReceived: 13000,
      activeCount: 1,
      maturedCount: 1,
      missedPaymentCount: 1,
    });
    expect(snapshot.yearly).toEqual([
      { year: 2025, total: 1000 },
      { year: 2026, total: 1200 },
    ]);
    expect(snapshot.monthly).toEqual([
      { year: 2025, month: 2, total: 1000 },
      { year: 2026, month: 2, total: 1200 },
    ]);
  });
});

function buildBond(overrides: Partial<Bond>): Bond {
  return {
    id: "test",
    name: "Test",
    principal: 100000,
    isMatured: false,
    interestRatePercent: 4,
    paymentPerInstallment: null,
    depositAccount: null,
    interestDay: null,
    purchaseDate: null,
    maturityDate: null,
    maturityNote: null,
    totalInterestReceived: null,
    monthly: [],
    hasMissedPayment: false,
    ...overrides,
  };
}

describe("upcoming payment projection", () => {
  const referenceDate = new Date(Date.UTC(2026, 2, 1)); // March 2026

  it("projects a quarterly bond's next payments within the 6-month window", () => {
    const quarterlyBond = buildBond({
      id: "q-1",
      name: "Quarterly Bond",
      paymentPerInstallment: 1000,
      monthly: [
        { year: 2025, month: 9, status: "received", amount: 1000 },
        { year: 2025, month: 12, status: "received", amount: 1000 },
      ],
    });

    const upcoming = computeUpcomingPayments([quarterlyBond], referenceDate);

    expect(upcoming).toEqual([
      { bondId: "q-1", bondName: "Quarterly Bond", year: 2026, month: 3, estimatedAmount: 1000 },
      { bondId: "q-1", bondName: "Quarterly Bond", year: 2026, month: 6, estimatedAmount: 1000 },
    ]);
  });

  it("falls back to averaging recent amounts when paymentPerInstallment is unknown", () => {
    const bond = buildBond({
      id: "q-2",
      name: "No Fixed Amount",
      paymentPerInstallment: null,
      monthly: [
        { year: 2025, month: 9, status: "received", amount: 900 },
        { year: 2025, month: 12, status: "received", amount: 1100 },
      ],
    });

    const upcoming = computeUpcomingPayments([bond], referenceDate);

    expect(upcoming[0]).toMatchObject({ estimatedAmount: 1000 });
  });

  it("skips bonds with fewer than two historical payments, and skips matured bonds", () => {
    const oneVisit = buildBond({ id: "one", monthly: [{ year: 2025, month: 12, status: "received", amount: 1000 }] });
    const maturedQuarterly = buildBond({
      id: "matured",
      isMatured: true,
      monthly: [
        { year: 2025, month: 9, status: "received", amount: 1000 },
        { year: 2025, month: 12, status: "received", amount: 1000 },
      ],
    });

    expect(computeUpcomingPayments([oneVisit, maturedQuarterly], referenceDate)).toEqual([]);
  });
});
