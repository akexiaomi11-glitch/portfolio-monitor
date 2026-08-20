import DashboardLayout from "@/components/DashboardLayout";
import { useStaleThreshold } from "@/hooks/useStaleThreshold";
import PortfolioVisuals from "@/components/PortfolioVisuals";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/trpc";
import {
  portfolioSortOptions,
  sortPortfolioHoldings,
  type PortfolioSortDirection,
  type PortfolioSortField,
} from "@shared/portfolioSorting";
import { isDataStaleForThreshold, matchesQuickFilter, type QuickFilter } from "@shared/portfolioMonitoring";
import { combineHoldingsForChart } from "@shared/portfolioComposition";
import {
  AlertTriangle,
  ArrowDownAZ,
  ArrowDownRight,
  ArrowUpAZ,
  ArrowUpDown,
  ArrowUpRight,
  BarChart3,
  CalendarClock,
  CheckCircle2,
  CircleAlert,
  Clock3,
  Filter,
  Minus,
  Plus,
  ShieldAlert,
  TrendingDown,
  TrendingUp,
  WalletCards,
  X,
  Zap,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

const thb = new Intl.NumberFormat("th-TH", { style: "currency", currency: "THB", maximumFractionDigits: 0 });
const percentage = new Intl.NumberFormat("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const dateTime = new Intl.DateTimeFormat("th-TH", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Bangkok" });
const MIN_STALE_DAYS = 1;
const MAX_STALE_DAYS = 30;

type Holding = {
  id: string;
  name: string;
  status: "Active";
  currentValue: number;
  cost: number;
  pnl: number;
  pnlPercent: number;
  dailyChangePercent: number;
  updatedDate: string | null;
  businessDaysOld: number | null;
  isStale: boolean;
  isNegativePnl: boolean;
  hasLargeDailyChange: boolean;
  attentionReasons: string[];
};

function formatSignedCurrency(value: number) {
  return `${value >= 0 ? "+" : "−"}${thb.format(Math.abs(value))}`;
}

function formatSignedPercent(value: number) {
  return `${value >= 0 ? "+" : "−"}${percentage.format(Math.abs(value))}%`;
}

function ValueTone({ value, children }: { value: number; children: React.ReactNode }) {
  return <span className={value >= 0 ? "text-[#11865B]" : "text-[#C2413E]"}>{children}</span>;
}

function AttentionBadges({ reasons }: { reasons: string[] }) {
  if (reasons.length === 0) {
    return <span className="inline-flex items-center gap-1 rounded-full bg-[#EAF6EE] px-2 py-1 text-[11px] font-semibold text-[#18734F]"><CheckCircle2 className="h-3 w-3" />ปกติ</span>;
  }

  return <div className="flex flex-wrap gap-1.5">{reasons.map(reason => <span key={reason} className="rounded-full bg-[#FFF0E7] px-2 py-1 text-[10px] font-semibold text-[#A94A25]">{reason}</span>)}</div>;
}

function MetricSkeleton() {
  return <div className="h-[154px] rounded-3xl border border-[#E8E2D5] bg-white p-5"><Skeleton className="h-3 w-24" /><Skeleton className="mt-6 h-9 w-36" /><Skeleton className="mt-5 h-3 w-20" /></div>;
}

function SortHead({ field, label, align = "right", activeField, direction, onSort }: { field: PortfolioSortField; label: string; align?: "left" | "right"; activeField: PortfolioSortField; direction: PortfolioSortDirection; onSort: (field: PortfolioSortField) => void }) {
  const isActive = field === activeField;
  return <th className={`px-5 py-4 ${align === "right" ? "text-right" : "text-left"}`}><button onClick={() => onSort(field)} className={`inline-flex items-center gap-1.5 transition-colors hover:text-[#17342D] ${align === "right" ? "ml-auto" : ""} ${isActive ? "text-[#176244]" : ""}`}>{label}<ArrowUpDown className={`h-3 w-3 ${isActive ? "text-[#A17E37]" : "text-[#A9B0AA]"}`} />{isActive && <span className="sr-only">{direction === "asc" ? "น้อยไปมาก" : "มากไปน้อย"}</span>}</button></th>;
}

function QuickMetric({ filter, activeFilter, count, label, caption, icon, tone, onSelect }: { filter: Exclude<QuickFilter, "all">; activeFilter: QuickFilter; count: number; label: string; caption: string; icon: React.ReactNode; tone: "green" | "red" | "amber"; onSelect: (filter: QuickFilter) => void }) {
  const colors = {
    green: "border-[#D8ECDD] bg-[#F6FCF7] text-[#176244] hover:bg-[#EDF8EF]",
    red: "border-[#F0D1CD] bg-[#FFF8F7] text-[#C2413E] hover:bg-[#FFF0EF]",
    amber: "border-[#F0DDAE] bg-[#FFFDF7] text-[#A06C21] hover:bg-[#FFF8EA]",
  };
  const active = activeFilter === filter;
  return <button onClick={() => onSelect(filter)} className={`rounded-2xl border p-4 text-left transition-all active:scale-[0.98] ${colors[tone]} ${active ? "ring-2 ring-[#D8B76A] ring-offset-2" : ""}`}><div className="flex items-center justify-between"><p className="text-2xl font-semibold">{count}</p><span className="grid h-7 w-7 place-items-center rounded-lg bg-white/80">{icon}</span></div><p className="mt-2 text-xs font-semibold text-[#17342D]">{label}</p><p className="mt-1 text-[11px] leading-4 text-[#748079]">{caption}</p></button>;
}

export default function Stocks() {
  const snapshotQuery = trpc.portfolio.snapshot.useQuery(undefined, { refetchOnWindowFocus: false });
  const providentQuery = trpc.providentFund.snapshot.useQuery(undefined, { refetchOnWindowFocus: false });
  const [lastSynced, setLastSynced] = useState<Date | null>(null);
  const [sortField, setSortField] = useState<PortfolioSortField>("attention");
  const [sortDirection, setSortDirection] = useState<PortfolioSortDirection>("desc");
  const [staleDays, setStaleDays] = useStaleThreshold();
  const [quickFilter, setQuickFilter] = useState<QuickFilter>("all");

  useEffect(() => {
    if (snapshotQuery.data?.syncedAt) setLastSynced(new Date(snapshotQuery.data.syncedAt));
  }, [snapshotQuery.data?.syncedAt]);

  const snapshot = snapshotQuery.data;
  const holdings = snapshot?.holdings ?? [];
  const latestProvident = providentQuery.data?.latest;
  const providentValue = latestProvident?.value ?? 0;
  const providentCapital = latestProvident?.capital ?? 0;
  const providentPnl = latestProvident?.lifetimePnl ?? 0;
  const totalValue = (snapshot?.summary.totalValue ?? 0) + providentValue;
  const totalCost = (snapshot?.summary.totalCost ?? 0) + providentCapital;
  const totalPnl = (snapshot?.summary.totalPnl ?? 0) + providentPnl;
  const totalPnlPercent = totalCost === 0 ? 0 : (totalPnl / totalCost) * 100;
  const isHoldingStale = (holding: Holding) => isDataStaleForThreshold(holding.businessDaysOld, staleDays);
  const dashboardHoldings = useMemo(() => holdings.map(holding => {
    const stale = isHoldingStale(holding);
    return {
      ...holding,
      isStale: stale,
      attentionReasons: [
        ...(holding.isNegativePnl ? ["ผลตอบแทนติดลบ"] : []),
        ...(holding.hasLargeDailyChange ? ["ความเคลื่อนไหวรายวันสูง"] : []),
        ...(stale ? [holding.businessDaysOld === null ? "ไม่พบวันที่อัปเดต" : `ข้อมูลเกิน ${staleDays} วันทำการ`] : []),
      ],
    };
  }), [holdings, staleDays]);
  const providentForChart = latestProvident ? { fundName: latestProvident.fundName, value: latestProvident.value, cost: latestProvident.capital, pnl: latestProvident.lifetimePnl, pnlPercent: latestProvident.lifetimePnlPercent } : null;
  const chartHoldings = useMemo(() => combineHoldingsForChart(dashboardHoldings, providentForChart), [dashboardHoldings, providentForChart]);
  const quickCounts = {
    positive: dashboardHoldings.filter(holding => holding.pnl > 0).length,
    negative: dashboardHoldings.filter(holding => holding.pnl < 0).length,
    volatile: dashboardHoldings.filter(holding => holding.hasLargeDailyChange).length,
    stale: dashboardHoldings.filter(isHoldingStale).length,
  };
  const quickFilteredHoldings = dashboardHoldings.filter(holding => matchesQuickFilter(holding, quickFilter, staleDays));
  const displayedHoldings = useMemo(() => sortPortfolioHoldings(quickFilteredHoldings, sortField, sortDirection), [quickFilteredHoldings, sortField, sortDirection]);
  const staleHoldings = dashboardHoldings.filter(isHoldingStale);
  const sortLabel = portfolioSortOptions.find(option => option.value === sortField)?.label ?? "รายการผิดปกติ";
  const filterLabels: Record<QuickFilter, string> = { all: "ทุกรายการ Active", positive: "ผลตอบแทนบวก", negative: "ผลตอบแทนติดลบ", volatile: "ผันผวนรายวันสูง", stale: "ข้อมูลค้าง" };

  const chooseSort = (field: PortfolioSortField) => { setSortField(field); setSortDirection(field === "name" ? "asc" : "desc"); };
  const toggleHeaderSort = (field: PortfolioSortField) => { if (field === sortField) setSortDirection(direction => direction === "asc" ? "desc" : "asc"); else chooseSort(field); };
  const selectQuickFilter = (filter: QuickFilter) => {
    setQuickFilter(current => current === filter ? "all" : filter);
    window.setTimeout(() => document.getElementById("holdings")?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
  };

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-[1480px] px-4 py-6 sm:px-7 lg:px-10 lg:py-9">
        <section id="overview" className="scroll-mt-24 flex flex-col gap-5 border-b border-[#E4DED2] pb-7 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl"><div className="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#A17E37]"><span className="h-2 w-2 rounded-full bg-[#D8B76A]" />Active portfolio view</div><h1 className="font-serif text-3xl font-semibold tracking-[-0.035em] text-[#17342D] sm:text-4xl">ภาพรวมพอร์ตของคุณ</h1><p className="mt-2 text-sm leading-6 text-[#68736D]">สรุปเฉพาะรายการที่มีสถานะ <strong className="font-semibold text-[#176244]">Active</strong> พร้อมสัญญาณที่ควรติดตามก่อนตัดสินใจ</p></div>
          <div className="flex items-center gap-2 text-xs text-[#68736D]"><Clock3 className="h-4 w-4 text-[#A17E37]" />{lastSynced ? <>ซิงก์ล่าสุด {dateTime.format(lastSynced)}</> : "กำลังเชื่อมต่อข้อมูล"}</div>
        </section>

        {snapshotQuery.isError && <div className="mt-6 flex items-start gap-3 rounded-2xl border border-[#F2C6C1] bg-[#FFF3F1] p-4 text-sm text-[#9B2F2C]"><CircleAlert className="mt-0.5 h-5 w-5 shrink-0" /><div><p className="font-semibold">ไม่สามารถซิงก์ข้อมูลได้</p><p className="mt-1 text-[#B25450]">โปรดตรวจสอบว่า Google Sheets ยังตั้งค่าแชร์แบบสาธารณะ และลองรีเฟรชอีกครั้ง</p></div></div>}

        <section className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {snapshotQuery.isLoading || !snapshot ? Array.from({ length: 4 }).map((_, index) => <MetricSkeleton key={index} />) : <>
            <article className="rounded-3xl border border-[#E8E2D5] bg-white p-5 shadow-[0_14px_30px_rgba(32,54,45,0.04)]"><div className="flex items-start justify-between"><p className="text-xs font-semibold uppercase tracking-[0.1em] text-[#7A857E]">มูลค่าพอร์ตรวม</p><span className="grid h-9 w-9 place-items-center rounded-xl bg-[#EAF3EC] text-[#176244]"><WalletCards className="h-4 w-4" /></span></div><p className="mt-6 font-serif text-3xl font-semibold tracking-[-0.035em] text-[#17342D]">{thb.format(totalValue)}</p><p className="mt-3 text-xs text-[#7A857E]">{holdings.length} รายการ Active{latestProvident ? " + Provident Fund" : ""}</p></article>
            <article className="rounded-3xl border border-[#E8E2D5] bg-white p-5 shadow-[0_14px_30px_rgba(32,54,45,0.04)]"><div className="flex items-start justify-between"><p className="text-xs font-semibold uppercase tracking-[0.1em] text-[#7A857E]">ทุนรวม</p><span className="grid h-9 w-9 place-items-center rounded-xl bg-[#F6F0DF] text-[#A17E37]"><BarChart3 className="h-4 w-4" /></span></div><p className="mt-6 font-serif text-3xl font-semibold tracking-[-0.035em] text-[#17342D]">{thb.format(totalCost)}</p><p className="mt-3 text-xs text-[#7A857E]">{!latestProvident ? "ยังไม่มีข้อมูล Provident Fund" : "คำนวณจากมูลค่าปัจจุบันและ P&L"}</p></article>
            <article className="rounded-3xl border border-[#E8E2D5] bg-white p-5 shadow-[0_14px_30px_rgba(32,54,45,0.04)]"><div className="flex items-start justify-between"><p className="text-xs font-semibold uppercase tracking-[0.1em] text-[#7A857E]">กำไร / ขาดทุนรวม</p><span className={`grid h-9 w-9 place-items-center rounded-xl ${totalPnl >= 0 ? "bg-[#EAF6EE] text-[#18734F]" : "bg-[#FFF0EF] text-[#C2413E]"}`}>{totalPnl >= 0 ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}</span></div><p className="mt-6 font-serif text-3xl font-semibold tracking-[-0.035em]"><ValueTone value={totalPnl}>{formatSignedCurrency(totalPnl)}</ValueTone></p><p className="mt-3 text-xs text-[#7A857E]">{!latestProvident ? "ไม่รวม P&L Provident Fund จนกว่าจะมีข้อมูล" : "สุทธิจากต้นทุนทั้งหมดในพอร์ต"}</p></article>
            <article className="rounded-3xl border border-[#E8E2D5] bg-white p-5 shadow-[0_14px_30px_rgba(32,54,45,0.04)]"><div className="flex items-start justify-between"><p className="text-xs font-semibold uppercase tracking-[0.1em] text-[#7A857E]">ผลตอบแทนรวม</p><span className={`grid h-9 w-9 place-items-center rounded-xl ${totalPnlPercent >= 0 ? "bg-[#EAF6EE] text-[#18734F]" : "bg-[#FFF0EF] text-[#C2413E]"}`}>{totalPnlPercent >= 0 ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}</span></div><p className="mt-6 font-serif text-3xl font-semibold tracking-[-0.035em]"><ValueTone value={totalPnlPercent}>{formatSignedPercent(totalPnlPercent)}</ValueTone></p><p className="mt-3 text-xs text-[#7A857E]">เทียบกับทุนรวมที่บันทึกแล้ว</p></article>
          </>}
        </section>

        {snapshot && <section id="attention" className="scroll-mt-24 mt-6 grid gap-4 xl:grid-cols-[1.5fr_1fr]">
          <div className="rounded-3xl border border-[#E7E0D4] bg-[#FDFCF8] p-5 sm:p-6"><div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#A17E37]">Quick scan</p><h2 className="mt-1 font-serif text-xl font-semibold text-[#17342D]">สแกนพอร์ตใน 10 วินาที</h2><p className="mt-1 text-xs text-[#748079]">คลิกกล่องเพื่อดูรายการที่ตรงเงื่อนไข</p></div><span className="rounded-full bg-[#EAF3EC] px-3 py-1.5 text-xs font-semibold text-[#176244]">Stock · Active only</span></div><div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4"><QuickMetric filter="positive" activeFilter={quickFilter} count={quickCounts.positive} label="ผลตอบแทนบวก" caption="กดเพื่อดูเฉพาะรายการ" icon={<TrendingUp className="h-3.5 w-3.5" />} tone="green" onSelect={selectQuickFilter} /><QuickMetric filter="negative" activeFilter={quickFilter} count={quickCounts.negative} label="ยังติดลบ" caption="กดเพื่อตรวจจุดเสี่ยง" icon={<TrendingDown className="h-3.5 w-3.5" />} tone="red" onSelect={selectQuickFilter} /><QuickMetric filter="volatile" activeFilter={quickFilter} count={quickCounts.volatile} label="ผันผวน ≥ 1%" caption="ความเคลื่อนไหวรายวัน" icon={<Zap className="h-3.5 w-3.5" />} tone="amber" onSelect={selectQuickFilter} /><QuickMetric filter="stale" activeFilter={quickFilter} count={quickCounts.stale} label="ข้อมูลค้าง" caption={`เกิน ${staleDays} วันทำการ`} icon={<CalendarClock className="h-3.5 w-3.5" />} tone="amber" onSelect={selectQuickFilter} /></div></div>
          <div className="rounded-3xl border border-[#E7E0D4] bg-white p-5 sm:p-6"><div className="flex items-center gap-3"><div className="grid h-9 w-9 place-items-center rounded-xl bg-[#FFF0E7] text-[#A94A25]"><ShieldAlert className="h-4 w-4" /></div><div><p className="font-semibold text-[#17342D]">เกณฑ์ติดตาม</p><p className="text-xs text-[#748079]">ปรับระดับการเตือนข้อมูลค้างได้ทันที</p></div></div><div className="mt-4 rounded-2xl border border-[#E7E0D4] bg-[#FDFCF8] p-3"><div className="flex items-center justify-between gap-3"><div><p className="text-xs font-semibold text-[#17342D]">ข้อมูลค้างเมื่อเก่ากว่า</p><p className="mt-1 text-[11px] text-[#748079]">นับเฉพาะวันทำการ จันทร์–ศุกร์</p></div><div className="flex items-center rounded-xl border border-[#E1DBCF] bg-white p-1"><button onClick={() => setStaleDays(days => Math.max(MIN_STALE_DAYS, days - 1))} disabled={staleDays <= MIN_STALE_DAYS} aria-label="ลดจำนวนวันข้อมูลค้าง" className="grid h-8 w-8 place-items-center rounded-lg text-[#52635C] transition-colors hover:bg-[#F3F1EA] disabled:cursor-not-allowed disabled:opacity-35"><Minus className="h-4 w-4" /></button><span className="w-9 text-center text-sm font-bold text-[#17342D]">{staleDays}</span><button onClick={() => setStaleDays(days => Math.min(MAX_STALE_DAYS, days + 1))} disabled={staleDays >= MAX_STALE_DAYS} aria-label="เพิ่มจำนวนวันข้อมูลค้าง" className="grid h-8 w-8 place-items-center rounded-lg bg-[#17342D] text-white transition-colors hover:bg-[#26483F] disabled:cursor-not-allowed disabled:opacity-35"><Plus className="h-4 w-4" /></button></div></div></div><div className="mt-4 space-y-2 text-xs leading-5 text-[#68736D]"><p>ไฮไลต์เมื่อ P&L ติดลบ หรือ %Change รายวันตั้งแต่ ±1.00%</p><p>ขณะนี้ถือว่าข้อมูลค้างเมื่อเก่ากว่า <strong className="font-semibold text-[#A06C21]">{staleDays} วันทำการ</strong></p></div></div>
        </section>}

        {snapshot && <PortfolioVisuals holdings={chartHoldings} />}

        {staleHoldings.length > 0 && <section className="mt-6 rounded-3xl border border-[#F0D2A2] bg-[#FFF8EA] p-5 sm:p-6"><div className="flex gap-3"><AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-[#B26E18]" /><div><h2 className="font-semibold text-[#754A12]">ข้อมูลค้างเกิน {staleDays} วันทำการ</h2><p className="mt-1 text-sm leading-6 text-[#8C642A]">กรุณาตรวจสอบ NAV หรือราคาของรายการต่อไปนี้ก่อนใช้ประกอบการตัดสินใจ</p><div className="mt-3 flex flex-wrap gap-2">{staleHoldings.map(holding => <span key={holding.id} className="rounded-full border border-[#F0D2A2] bg-white/70 px-3 py-1.5 text-xs font-semibold text-[#86571C]">{holding.name} · {holding.updatedDate ?? "ไม่พบวันที่"}</span>)}</div></div></div></section>}

        <section id="holdings" className="scroll-mt-24 mt-7">
          <div className="mb-4 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between"><div><p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#A17E37]">Holdings</p><h2 className="mt-1 font-serif text-2xl font-semibold tracking-[-0.025em] text-[#17342D]">รายการถือครอง</h2><p className="mt-1 text-xs text-[#7A857E]">{quickFilter === "all" ? (sortField === "attention" ? "ค่าเริ่มต้น: รายการผิดปกติอยู่ก่อน" : `เรียงตาม ${sortLabel}`) : `กรอง: ${filterLabels[quickFilter]} · ${displayedHoldings.length} รายการ`}</p></div><div className="flex flex-col gap-2 sm:flex-row sm:items-center">{quickFilter !== "all" && <Button onClick={() => setQuickFilter("all")} variant="ghost" className="h-10 rounded-xl px-3 text-xs font-semibold text-[#9A5B38] hover:bg-[#FFF1E8] hover:text-[#914A25]"><X className="mr-1.5 h-4 w-4" />ล้างตัวกรอง</Button>}<Select value={sortField} onValueChange={value => chooseSort(value as PortfolioSortField)}><SelectTrigger aria-label="เลือกหัวข้อเรียงข้อมูล" className="h-10 min-w-[190px] rounded-xl border-[#DED8CC] bg-white text-sm"><SelectValue /></SelectTrigger><SelectContent>{portfolioSortOptions.map(option => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent></Select><Button onClick={() => setSortDirection(direction => direction === "asc" ? "desc" : "asc")} variant="outline" className="h-10 rounded-xl border-[#DED8CC] bg-white px-3 text-xs font-semibold text-[#365148] hover:bg-[#F4F7F4]"><span className="mr-2">{sortDirection === "desc" ? <ArrowDownAZ className="h-4 w-4" /> : <ArrowUpAZ className="h-4 w-4" />}</span>{sortDirection === "desc" ? "มาก → น้อย" : "น้อย → มาก"}</Button></div></div>

          {snapshotQuery.isLoading ? <div className="space-y-3"><Skeleton className="h-20 w-full rounded-2xl" /><Skeleton className="h-20 w-full rounded-2xl" /><Skeleton className="h-20 w-full rounded-2xl" /></div> : displayedHoldings.length === 0 ? <div className="rounded-3xl border border-dashed border-[#D9D2C6] bg-white p-12 text-center"><Filter className="mx-auto h-8 w-8 text-[#A17E37]" /><p className="mt-4 font-semibold text-[#17342D]">ไม่พบรายการที่ตรงกับตัวกรอง</p><p className="mt-1 text-sm text-[#748079]">ลองเลือก Quick Scan กล่องอื่น หรือล้างตัวกรองเพื่อดูทุก Active holding</p><Button onClick={() => setQuickFilter("all")} variant="outline" className="mt-4 rounded-xl">แสดงทุกรายการ</Button></div> : <><div className="hidden overflow-hidden rounded-3xl border border-[#E7E0D4] bg-white shadow-[0_14px_30px_rgba(32,54,45,0.035)] md:block"><div className="overflow-x-auto"><table className="w-full min-w-[930px] border-collapse text-left"><thead className="bg-[#F8F6F0]"><tr className="text-[10px] font-semibold uppercase tracking-[0.11em] text-[#768079]"><SortHead field="name" label="กองทุน / หุ้น" align="left" activeField={sortField} direction={sortDirection} onSort={toggleHeaderSort} /><SortHead field="currentValue" label="มูลค่าปัจจุบัน" activeField={sortField} direction={sortDirection} onSort={toggleHeaderSort} /><SortHead field="cost" label="ทุน" activeField={sortField} direction={sortDirection} onSort={toggleHeaderSort} /><SortHead field="pnl" label="P&L" activeField={sortField} direction={sortDirection} onSort={toggleHeaderSort} /><SortHead field="pnlPercent" label="%P&L" activeField={sortField} direction={sortDirection} onSort={toggleHeaderSort} /><SortHead field="dailyChangePercent" label="%Change วันนี้" activeField={sortField} direction={sortDirection} onSort={toggleHeaderSort} /><SortHead field="updatedDate" label="อัปเดต" align="left" activeField={sortField} direction={sortDirection} onSort={toggleHeaderSort} /></tr></thead><tbody>{displayedHoldings.map(holding => <tr key={holding.id} className={`border-t border-[#EEE9DF] transition-colors hover:bg-[#FBFAF6] ${holding.attentionReasons.length > 0 ? "bg-[#FFFCF7]" : ""}`}><td className="border-l-4 border-transparent px-6 py-4 align-top"><div className="flex items-start gap-3"><span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${holding.attentionReasons.length > 0 ? "bg-[#D17A3E]" : "bg-[#39A36E]"}`} /><div><p className="font-semibold tracking-tight text-[#17342D]">{holding.name}</p><div className="mt-2"><AttentionBadges reasons={holding.attentionReasons} /></div></div></div></td><td className="px-5 py-4 text-right text-sm font-semibold text-[#17342D]">{thb.format(holding.currentValue)}</td><td className="px-5 py-4 text-right text-sm text-[#62706A]">{thb.format(holding.cost)}</td><td className="px-5 py-4 text-right text-sm font-semibold"><ValueTone value={holding.pnl}>{formatSignedCurrency(holding.pnl)}</ValueTone></td><td className="px-5 py-4 text-right text-sm font-semibold"><ValueTone value={holding.pnlPercent}>{formatSignedPercent(holding.pnlPercent)}</ValueTone></td><td className="px-5 py-4 text-right text-sm font-semibold"><ValueTone value={holding.dailyChangePercent}>{formatSignedPercent(holding.dailyChangePercent)}</ValueTone></td><td className="px-6 py-4 align-top text-sm"><p className={isHoldingStale(holding) ? "font-semibold text-[#B26E18]" : "text-[#62706A]"}>{holding.updatedDate ?? "ไม่พบวันที่"}</p>{holding.businessDaysOld !== null && <p className="mt-1 text-[11px] text-[#8A938C]">{holding.businessDaysOld} วันทำการ</p>}</td></tr>)}</tbody></table></div></div><div className="space-y-3 md:hidden">{displayedHoldings.map(holding => <article key={holding.id} className={`rounded-3xl border p-5 shadow-[0_10px_22px_rgba(32,54,45,0.035)] ${holding.attentionReasons.length > 0 ? "border-[#F0D2A2] bg-[#FFFCF7]" : "border-[#E7E0D4] bg-white"}`}><div className="flex items-start justify-between gap-3"><div><p className="font-semibold text-[#17342D]">{holding.name}</p><div className="mt-2"><AttentionBadges reasons={holding.attentionReasons} /></div></div><p className="text-right text-sm font-semibold text-[#17342D]">{thb.format(holding.currentValue)}<span className="mt-1 block text-[10px] font-medium uppercase tracking-[0.1em] text-[#87918B]">มูลค่าปัจจุบัน</span></p></div><div className="mt-5 grid grid-cols-3 gap-2 border-y border-[#EEE9DF] py-4 text-center"><div><p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#87918B]">ทุน</p><p className="mt-1 text-xs font-semibold text-[#56645E]">{thb.format(holding.cost)}</p></div><div><p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#87918B]">P&L</p><p className="mt-1 text-xs font-semibold"><ValueTone value={holding.pnl}>{formatSignedCurrency(holding.pnl)}</ValueTone></p></div><div><p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#87918B]">%P&L</p><p className="mt-1 text-xs font-semibold"><ValueTone value={holding.pnlPercent}>{formatSignedPercent(holding.pnlPercent)}</ValueTone></p></div></div><div className="mt-4 flex items-center justify-between"><div><p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#87918B]">%Change วันนี้</p><p className="mt-1 text-sm font-semibold"><ValueTone value={holding.dailyChangePercent}>{formatSignedPercent(holding.dailyChangePercent)}</ValueTone></p></div><div className="text-right"><p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#87918B]">อัปเดตล่าสุด</p><p className={`mt-1 text-xs font-semibold ${isHoldingStale(holding) ? "text-[#B26E18]" : "text-[#56645E]"}`}>{holding.updatedDate ?? "ไม่พบวันที่"}</p></div></div></article>)}</div></>}
        </section>
      </div>
    </DashboardLayout>
  );
}
