import DashboardLayout from "@/components/DashboardLayout";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/trpc";
import type { AppRouter } from "../../../server/routers";
import type { inferRouterOutputs } from "@trpc/server";
import { Bar, BarChart, Cell, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AlertTriangle, ArrowDown, ArrowUp, ArrowUpDown, BadgeCheck, Banknote, CalendarClock, ScrollText, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type BondSnapshot = inferRouterOutputs<AppRouter>["bonds"]["snapshot"];
type Bond = BondSnapshot["bonds"][number];
type StatusFilter = "all" | "active" | "matured";
type SelectedPeriod = { type: "year"; year: number } | { type: "month"; year: number; month: number };
type SortKey = "name" | "principal" | "interestRatePercent" | "maturityDate" | "totalInterestReceived";
type SortState = { key: SortKey; direction: "asc" | "desc" } | null;

const THAI_MONTH_LABELS = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
const thb = new Intl.NumberFormat("th-TH", { style: "currency", currency: "THB", maximumFractionDigits: 0 });
const compactThb = new Intl.NumberFormat("th-TH", { notation: "compact", maximumFractionDigits: 1 });
const dateFormatter = new Intl.DateTimeFormat("th-TH", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Bangkok" });

const SORT_COLUMNS: { key: SortKey; label: string }[] = [
  { key: "name", label: "บริษัท" },
  { key: "principal", label: "เงินต้น" },
  { key: "interestRatePercent", label: "ดอกเบี้ย %" },
  { key: "maturityDate", label: "ครบกำหนด" },
  { key: "totalInterestReceived", label: "ดอกเบี้ยสะสม" },
];

function formatMaturity(bond: Bond) {
  if (!bond.maturityDate) return bond.maturityNote ?? "ไม่ระบุ";
  const label = dateFormatter.format(new Date(bond.maturityDate));
  return bond.maturityNote ? `${label} (${bond.maturityNote})` : label;
}

function getMissedMonthsLabel(bond: Bond) {
  return bond.monthly
    .filter(entry => entry.status === "missed")
    .map(entry => `${THAI_MONTH_LABELS[entry.month - 1]} ${entry.year + 543}`)
    .join(", ");
}

function compareNullableNumbers(a: number | null, b: number | null, direction: 1 | -1) {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return (a - b) * direction;
}

function compareBonds(a: Bond, b: Bond, sort: SortState) {
  if (!sort) return 0;
  const direction = sort.direction === "asc" ? 1 : -1;
  switch (sort.key) {
    case "name":
      return a.name.localeCompare(b.name) * direction;
    case "principal":
      return compareNullableNumbers(a.principal, b.principal, direction);
    case "interestRatePercent":
      return compareNullableNumbers(a.interestRatePercent, b.interestRatePercent, direction);
    case "totalInterestReceived":
      return compareNullableNumbers(a.totalInterestReceived, b.totalInterestReceived, direction);
    case "maturityDate":
      return compareNullableNumbers(a.maturityDate ? new Date(a.maturityDate).getTime() : null, b.maturityDate ? new Date(b.maturityDate).getTime() : null, direction);
    default:
      return 0;
  }
}

export default function Bonds() {
  const snapshotQuery = trpc.bonds.snapshot.useQuery(undefined, { refetchOnWindowFocus: false });
  const [view, setView] = useState<"yearly" | "monthly">("monthly");
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("active");
  const [sort, setSort] = useState<SortState>(null);
  const [selectedPeriod, setSelectedPeriod] = useState<SelectedPeriod | null>(null);

  const snapshot = snapshotQuery.data;
  const years = useMemo(() => snapshot?.yearly.map(item => item.year) ?? [], [snapshot]);
  const activeYear = selectedYear ?? years[years.length - 1] ?? null;
  const monthlyForYear = useMemo(() => {
    if (!snapshot || activeYear === null) return [];
    return THAI_MONTH_LABELS.map((label, index) => {
      const match = snapshot.monthly.find(item => item.year === activeYear && item.month === index + 1);
      return { label, month: index + 1, total: match?.total ?? 0 };
    });
  }, [snapshot, activeYear]);

  const filteredBonds = useMemo(() => {
    if (!snapshot) return [];
    if (statusFilter === "all") return snapshot.bonds;
    return snapshot.bonds.filter(bond => (statusFilter === "active" ? !bond.isMatured : bond.isMatured));
  }, [snapshot, statusFilter]);

  const sortedBonds = useMemo(() => [...filteredBonds].sort((a, b) => compareBonds(a, b, sort)), [filteredBonds, sort]);

  const summary = useMemo(() => ({
    totalPrincipal: filteredBonds.reduce((sum, bond) => sum + (bond.principal ?? 0), 0),
    totalInterestReceived: filteredBonds.reduce((sum, bond) => sum + (bond.totalInterestReceived ?? 0), 0),
    activeCount: filteredBonds.filter(bond => !bond.isMatured).length,
    maturedCount: filteredBonds.filter(bond => bond.isMatured).length,
    missedPaymentCount: filteredBonds.filter(bond => bond.hasMissedPayment).length,
  }), [filteredBonds]);

  const toggleSort = (key: SortKey) => {
    setSort(prev => {
      if (!prev || prev.key !== key) return { key, direction: "asc" };
      if (prev.direction === "asc") return { key, direction: "desc" };
      return null;
    });
  };

  const upcomingMaturities = useMemo(() => {
    if (!snapshot) return [];
    return snapshot.bonds
      .filter(bond => !bond.isMatured && bond.maturityDate)
      .sort((a, b) => new Date(a.maturityDate!).getTime() - new Date(b.maturityDate!).getTime())
      .slice(0, 5);
  }, [snapshot]);

  const upcomingPaymentMonths = useMemo(() => {
    if (!snapshot) return [];
    const start = new Date(snapshot.syncedAt);
    const startIndex = start.getUTCFullYear() * 12 + start.getUTCMonth();
    return Array.from({ length: 6 }, (_, offset) => {
      const index = startIndex + offset;
      const year = Math.floor(index / 12);
      const month = (index % 12) + 1;
      const payments = snapshot.upcomingPayments.filter(payment => payment.year === year && payment.month === month);
      return {
        label: `${THAI_MONTH_LABELS[month - 1]} ${year + 543}`,
        payments,
        total: payments.reduce((sum, payment) => sum + (payment.estimatedAmount ?? 0), 0),
      };
    });
  }, [snapshot]);

  useEffect(() => setSelectedPeriod(null), [view, activeYear]);

  const periodBreakdown = useMemo(() => {
    if (!snapshot || !selectedPeriod) return null;

    const rows = snapshot.bonds
      .map(bond => {
        const amount = bond.monthly
          .filter(entry => entry.status === "received" && entry.year === selectedPeriod.year && (selectedPeriod.type === "year" || entry.month === selectedPeriod.month))
          .reduce((sum, entry) => sum + (entry.amount ?? 0), 0);
        return { id: bond.id, name: bond.name, amount };
      })
      .filter(row => row.amount > 0)
      .sort((a, b) => b.amount - a.amount);

    const label = selectedPeriod.type === "year"
      ? `ปี พ.ศ. ${selectedPeriod.year + 543}`
      : `${THAI_MONTH_LABELS[selectedPeriod.month - 1]} ${selectedPeriod.year + 543}`;

    return { label, rows, total: rows.reduce((sum, row) => sum + row.amount, 0) };
  }, [snapshot, selectedPeriod]);

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-[1320px] px-4 py-7 sm:px-7 lg:px-10 lg:py-10">
        <section className="flex flex-col gap-5 border-b border-[#E4DED2] pb-7 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#A17E37]">Fixed income</p>
            <h1 className="mt-2 font-serif text-3xl font-semibold tracking-[-0.035em] text-[#17342D]">หุ้นกู้</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[#68736D]">ติดตามเงินต้น ดอกเบี้ยที่ได้รับ และวันครบกำหนดของหุ้นกู้ทั้งหมด ข้อมูลดึงจาก Google Sheets · Bond</p>
          </div>
          <div className="flex rounded-xl border border-[#E7E0D4] bg-[#FDFCF8] p-1">
            {([{ value: "yearly", label: "รายปี" }, { value: "monthly", label: "รายเดือน" }] as const).map(option => (
              <button key={option.value} onClick={() => setView(option.value)} className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${view === option.value ? "bg-[#17342D] text-white" : "text-[#66736C] hover:bg-white"}`}>
                {option.label}
              </button>
            ))}
          </div>
        </section>

        {snapshotQuery.isLoading || !snapshot ? (
          <div className="mt-7 grid gap-4 lg:grid-cols-3">
            <Skeleton className="h-32 rounded-3xl" />
            <Skeleton className="h-32 rounded-3xl" />
            <Skeleton className="h-32 rounded-3xl" />
          </div>
        ) : (
          <>
            <div className="mt-7 flex flex-wrap items-center gap-1.5">
              {([{ value: "all", label: "ทั้งหมด" }, { value: "active", label: "ถืออยู่" }, { value: "matured", label: "ครบกำหนดแล้ว" }] as const).map(option => (
                <button key={option.value} onClick={() => setStatusFilter(option.value)} className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${statusFilter === option.value ? "bg-[#17342D] text-white" : "bg-[#F3F0E7] text-[#66736C] hover:bg-[#EAE5D8]"}`}>
                  {option.label}
                </button>
              ))}
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-3xl border border-[#E7E0D4] bg-white p-5"><p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[#78847E]">เงินต้นรวม</p><p className="mt-2 font-serif text-xl font-semibold text-[#17342D]">{thb.format(summary.totalPrincipal)}</p></div>
              <div className="rounded-3xl border border-[#E7E0D4] bg-white p-5"><p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[#78847E]">ดอกเบี้ยรับสะสม</p><p className="mt-2 font-serif text-xl font-semibold text-[#1C8B61]">{thb.format(summary.totalInterestReceived)}</p></div>
              <div className="rounded-3xl border border-[#E7E0D4] bg-white p-5"><p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[#78847E]">ถืออยู่ / ครบกำหนดแล้ว</p><p className="mt-2 font-serif text-xl font-semibold text-[#17342D]">{summary.activeCount} / {summary.maturedCount}</p></div>
              <div className={`rounded-3xl border p-5 ${summary.missedPaymentCount > 0 ? "border-[#E8C4C0] bg-[#FCF4F3]" : "border-[#E7E0D4] bg-white"}`}><p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[#78847E]">ตัวที่มีเดือนขาดดอกเบี้ย</p><p className={`mt-2 font-serif text-xl font-semibold ${summary.missedPaymentCount > 0 ? "text-[#C2413E]" : "text-[#17342D]"}`}>{summary.missedPaymentCount} รายการ</p></div>
            </div>

            <section className="mt-6 grid gap-4 lg:grid-cols-[1fr_1.4fr]">
              <div className="rounded-3xl border border-[#E7E0D4] bg-white p-5 shadow-[0_14px_30px_rgba(32,54,45,0.035)] sm:p-6">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-[#A17E37]"><CalendarClock className="h-3.5 w-3.5" />หุ้นกู้ที่ใกล้ครบกำหนดถัดไป</div>
                {upcomingMaturities.length === 0 ? (
                  <p className="mt-4 text-sm text-[#748079]">ไม่มีหุ้นกู้ที่ถืออยู่ระบุวันครบกำหนด</p>
                ) : (
                  <div className="mt-4 space-y-2.5">
                    {upcomingMaturities.map(bond => {
                      const daysLeft = Math.ceil((new Date(bond.maturityDate!).getTime() - Date.now()) / 86_400_000);
                      return (
                        <div key={bond.id} className="flex items-center justify-between gap-3 rounded-xl border border-[#F0ECE1] bg-[#FDFCF8] px-3 py-2.5">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-[#17342D]">{bond.name}</p>
                            <p className="mt-0.5 text-[11px] text-[#78847E]">{formatMaturity(bond)}</p>
                          </div>
                          <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${daysLeft <= 90 ? "bg-[#FCEDEC] text-[#C2413E]" : "bg-[#EEF5F0] text-[#176244]"}`}>
                            {daysLeft >= 0 ? `เหลือ ${daysLeft} วัน` : "เลยกำหนด"}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="rounded-3xl border border-[#E7E0D4] bg-white p-5 shadow-[0_14px_30px_rgba(32,54,45,0.035)] sm:p-6">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-[#A17E37]"><CalendarClock className="h-3.5 w-3.5" />ดอกเบี้ยที่คาดว่าจะได้รับใน 6 เดือนข้างหน้า</div>
                <p className="mt-1 text-[11px] text-[#78847E]">ประมาณจากรอบจ่ายจริงในอดีต ไม่ใช่ยอดยืนยัน</p>
                <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
                  {upcomingPaymentMonths.map(month => (
                    <div key={month.label} className="rounded-2xl border border-[#F0ECE1] bg-[#FDFCF8] p-3">
                      <p className="text-[11px] font-semibold text-[#17342D]">{month.label}</p>
                      {month.payments.length === 0 ? (
                        <p className="mt-2 text-[11px] text-[#A9B0AA]">ไม่มีรายการ</p>
                      ) : (
                        <>
                          <p className="mt-2 text-sm font-semibold text-[#1C8B61]">{thb.format(month.total)}</p>
                          <p className="mt-1 text-[11px] leading-4 text-[#748079]">{month.payments.map(payment => payment.bondName).join(", ")}</p>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </section>

            {view === "yearly" && (
              <section className="mt-6 rounded-3xl border border-[#E7E0D4] bg-white p-5 shadow-[0_14px_30px_rgba(32,54,45,0.035)] sm:p-6">
                <h2 className="font-serif text-xl font-semibold text-[#17342D]">ดอกเบี้ยรับรายปี</h2>
                <p className="mt-1 text-[11px] text-[#78847E]">คลิกที่แท่งกราฟเพื่อดูว่าปีนั้นได้ดอกเบี้ยจากหุ้นกู้บริษัทไหนบ้าง</p>
                <div className="mt-4 h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={snapshot.yearly.map(item => ({ ...item, label: item.year + 543 }))} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                      <CartesianGrid vertical={false} stroke="#E9E4DA" strokeDasharray="3 4" />
                      <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: "#748079", fontSize: 11 }} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fill: "#748079", fontSize: 11 }} tickFormatter={value => `฿${compactThb.format(Number(value))}`} width={64} />
                      <Tooltip formatter={value => thb.format(Number(value))} labelFormatter={label => `ปี พ.ศ. ${label}`} contentStyle={{ borderRadius: 14, border: "1px solid #E7E0D4", boxShadow: "0 10px 28px rgba(32,54,45,.09)", fontSize: 12 }} itemStyle={{ color: "#33413A", fontWeight: 600 }} labelStyle={{ color: "#17342D", fontWeight: 700 }} />
                      <Bar dataKey="total" radius={[8, 8, 0, 0]} maxBarSize={48} cursor="pointer" onClick={(data: { year: number }) => setSelectedPeriod({ type: "year", year: data.year })}>
                        {snapshot.yearly.map(item => <Cell key={item.year} fill={selectedPeriod?.type === "year" && selectedPeriod.year === item.year ? "#17342D" : "#1C8B61"} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </section>
            )}

            {view === "monthly" && (
              <section className="mt-6 rounded-3xl border border-[#E7E0D4] bg-white p-5 shadow-[0_14px_30px_rgba(32,54,45,0.035)] sm:p-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2 className="font-serif text-xl font-semibold text-[#17342D]">ดอกเบี้ยรับรายเดือน</h2>
                  <div className="flex flex-wrap gap-1.5">
                    {years.map(year => (
                      <button key={year} onClick={() => setSelectedYear(year)} className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors ${activeYear === year ? "bg-[#17342D] text-white" : "bg-[#F3F0E7] text-[#66736C] hover:bg-[#EAE5D8]"}`}>
                        {year + 543}
                      </button>
                    ))}
                  </div>
                </div>
                <p className="mt-1 text-[11px] text-[#78847E]">คลิกที่แท่งกราฟเพื่อดูว่าเดือนนั้นได้ดอกเบี้ยจากหุ้นกู้บริษัทไหนบ้าง</p>
                <div className="mt-4 h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={monthlyForYear} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                      <CartesianGrid vertical={false} stroke="#E9E4DA" strokeDasharray="3 4" />
                      <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: "#748079", fontSize: 11 }} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fill: "#748079", fontSize: 11 }} tickFormatter={value => `฿${compactThb.format(Number(value))}`} width={64} />
                      <Tooltip formatter={value => thb.format(Number(value))} contentStyle={{ borderRadius: 14, border: "1px solid #E7E0D4", boxShadow: "0 10px 28px rgba(32,54,45,.09)", fontSize: 12 }} itemStyle={{ color: "#33413A", fontWeight: 600 }} labelStyle={{ color: "#17342D", fontWeight: 700 }} />
                      <Bar dataKey="total" radius={[8, 8, 0, 0]} maxBarSize={40} cursor="pointer" onClick={(data: { month: number }) => activeYear !== null && setSelectedPeriod({ type: "month", year: activeYear, month: data.month })}>
                        {monthlyForYear.map(item => <Cell key={item.month} fill={selectedPeriod?.type === "month" && selectedPeriod.month === item.month ? "#17342D" : "#1C8B61"} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </section>
            )}

            {periodBreakdown && (
              <section className="mt-6 rounded-3xl border border-[#E7E0D4] bg-white p-5 shadow-[0_14px_30px_rgba(32,54,45,0.035)] sm:p-6">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-[#A17E37]"><ScrollText className="h-3.5 w-3.5" />รายละเอียดดอกเบี้ย · {periodBreakdown.label}</div>
                    <p className="mt-1 text-xs text-[#78847E]">รวม {thb.format(periodBreakdown.total)} จาก {periodBreakdown.rows.length} หุ้นกู้</p>
                  </div>
                  <button onClick={() => setSelectedPeriod(null)} className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-[#78847E] transition-colors hover:bg-[#F3F0E7] hover:text-[#17342D]" aria-label="ปิดรายละเอียด"><X className="h-4 w-4" /></button>
                </div>
                {periodBreakdown.rows.length === 0 ? (
                  <p className="mt-4 text-sm text-[#748079]">ไม่มีดอกเบี้ยที่ได้รับในช่วงนี้</p>
                ) : (
                  <div className="mt-4 space-y-1.5">
                    {periodBreakdown.rows.map(row => (
                      <div key={row.id} className="flex items-center justify-between gap-3 rounded-xl border border-[#F0ECE1] bg-[#FDFCF8] px-3 py-2.5">
                        <p className="text-sm font-semibold text-[#17342D]">{row.name}</p>
                        <p className="text-sm font-semibold text-[#1C8B61]">{thb.format(row.amount)}</p>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            )}

            <section className="mt-6 rounded-3xl border border-[#E7E0D4] bg-white p-5 shadow-[0_14px_30px_rgba(32,54,45,0.035)] sm:p-6">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-[#A17E37]"><ScrollText className="h-3.5 w-3.5" />รายการหุ้นกู้ทั้งหมด</div>
              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[860px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-[#E7E0D4] text-[11px] uppercase tracking-[0.06em] text-[#78847E]">
                      {SORT_COLUMNS.map((column, index) => (
                        <th key={column.key} className={`py-2 font-semibold ${index < SORT_COLUMNS.length - 1 ? "pr-4" : ""}`}>
                          <button onClick={() => toggleSort(column.key)} className="inline-flex items-center gap-1 hover:text-[#17342D]">
                            {column.label}
                            {sort?.key === column.key ? (sort.direction === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />) : <ArrowUpDown className="h-3 w-3 opacity-40" />}
                          </button>
                        </th>
                      ))}
                      <th className="py-2 pr-4 font-semibold">บัญชีที่เข้า</th>
                      <th className="py-2 pr-0 font-semibold">สถานะ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedBonds.map(bond => (
                      <tr key={bond.id} className="border-b border-[#F0ECE1] last:border-0">
                        <td className="py-3 pr-4 font-semibold text-[#17342D]">{bond.name}</td>
                        <td className="py-3 pr-4 text-[#3A453F]">{bond.principal !== null ? thb.format(bond.principal) : "—"}</td>
                        <td className="py-3 pr-4 text-[#3A453F]">{bond.interestRatePercent !== null ? `${bond.interestRatePercent}%` : "—"}</td>
                        <td className="py-3 pr-4 text-[#3A453F]">{formatMaturity(bond)}</td>
                        <td className="py-3 pr-4 font-semibold text-[#1C8B61]">{bond.totalInterestReceived !== null ? thb.format(bond.totalInterestReceived) : "—"}</td>
                        <td className="py-3 pr-4 text-[#3A453F]">{bond.depositAccount ?? "—"}</td>
                        <td className="py-3 pr-0">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-semibold ${bond.isMatured ? "bg-[#F3F0E7] text-[#66736C]" : "bg-[#EEF5F0] text-[#176244]"}`}>
                              <BadgeCheck className="h-3 w-3" />{bond.isMatured ? "ครบกำหนดแล้ว" : "ถืออยู่"}
                            </span>
                            {bond.hasMissedPayment && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-[#FCEDEC] px-2 py-1 text-[11px] font-semibold text-[#C2413E]">
                                <AlertTriangle className="h-3 w-3" />ขาดดอกเบี้ย
                              </span>
                            )}
                          </div>
                          {bond.hasMissedPayment && <p className="mt-1 max-w-[220px] text-[11px] leading-4 text-[#C2413E]">{getMissedMonthsLabel(bond)}</p>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {sortedBonds.length === 0 && (
                <div className="mt-6 rounded-2xl border border-dashed border-[#D9D2C6] bg-white/70 p-7 text-center">
                  <Banknote className="mx-auto h-7 w-7 text-[#A17E37]" />
                  <p className="mt-3 font-semibold text-[#17342D]">ไม่พบหุ้นกู้ที่ตรงกับตัวกรอง</p>
                  <p className="mt-1 text-xs leading-5 text-[#748079]">ลองเลือกตัวกรองสถานะอื่น หรือตรวจสอบว่าชีต Bond มีข้อมูล</p>
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
