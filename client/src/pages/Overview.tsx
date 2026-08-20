import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/trpc";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ArrowDownRight, ArrowUpRight, BarChart3, RefreshCw, WalletCards } from "lucide-react";
import { useState } from "react";

const thb = new Intl.NumberFormat("th-TH", { style: "currency", currency: "THB", maximumFractionDigits: 0 });
const compactThb = new Intl.NumberFormat("th-TH", { notation: "compact", maximumFractionDigits: 1 });
const percentage = new Intl.NumberFormat("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

type PortfolioSummary = { key: string; label: string; caption: string; value: number; cost: number | null; pnl: number | null; pnlPercent: number | null; color: string };

function formatSignedCurrency(value: number) {
  return `${value >= 0 ? "+" : "−"}${thb.format(Math.abs(value))}`;
}

function formatSignedPercent(value: number) {
  return `${value >= 0 ? "+" : ""}${percentage.format(value)}%`;
}

function ValueTone({ value, children }: { value: number; children: React.ReactNode }) {
  return <span className={value >= 0 ? "text-[#11865B]" : "text-[#C2413E]"}>{children}</span>;
}

export default function Overview() {
  const [refreshVersion, setRefreshVersion] = useState(0);
  const snapshotQuery = trpc.portfolio.snapshot.useQuery({ forceRefresh: refreshVersion > 0 }, { staleTime: 0, refetchOnWindowFocus: false, refetchOnMount: "always" });
  const providentQuery = trpc.providentFund.snapshot.useQuery({ forceRefresh: refreshVersion > 0 }, { staleTime: 0, refetchOnWindowFocus: false, refetchOnMount: "always" });
  const bondsQuery = trpc.bonds.snapshot.useQuery({ forceRefresh: refreshVersion > 0 }, { staleTime: 0, refetchOnWindowFocus: false, refetchOnMount: "always" });

  const isLoading = snapshotQuery.isLoading || providentQuery.isLoading || bondsQuery.isLoading;
  const isFetching = snapshotQuery.isFetching || providentQuery.isFetching || bondsQuery.isFetching;
  const refresh = () => setRefreshVersion(version => version + 1);

  const snapshot = snapshotQuery.data;
  const latestProvident = providentQuery.data?.latest;
  const bondSnapshot = bondsQuery.data;

  // Return figure is YTD (matches Bond's convention below), sourced from the
  // fund's own official YTD % rather than a self-computed approximation —
  // simple pnl/capital math doesn't match a time-weighted fund return.
  const providentValue = latestProvident?.value ?? 0;
  const providentCapital = latestProvident?.capital ?? null;
  const providentPnl = latestProvident?.ytdPnl ?? null;
  const providentPnlPercent = latestProvident?.cumulativeReturnPercent ?? null;

  const currentYear = new Date().getUTCFullYear();
  const activeBonds = bondSnapshot?.bonds.filter(bond => !bond.isMatured) ?? [];
  const bondValue = activeBonds.reduce((sum, bond) => sum + (bond.principal ?? 0), 0);
  const bondPnl = activeBonds.reduce((sum, bond) => {
    const ytdInterest = bond.monthly
      .filter(entry => entry.year === currentYear && entry.status === "received")
      .reduce((entrySum, entry) => entrySum + (entry.amount ?? 0), 0);
    return sum + ytdInterest;
  }, 0);
  const bondPnlPercent = bondValue > 0 ? (bondPnl / bondValue) * 100 : null;

  const portfolios: PortfolioSummary[] = [
    { key: "rmf", label: "RMF + หุ้น", caption: `${snapshot?.holdings.length ?? 0} รายการ Active`, value: snapshot?.summary.totalValue ?? 0, cost: snapshot?.summary.totalCost ?? null, pnl: snapshot?.summary.totalPnl ?? null, pnlPercent: snapshot?.summary.totalPnlPercent ?? null, color: "#1C8B61" },
    { key: "provident", label: "Provident Fund", caption: latestProvident ? `${latestProvident.fundName} · ผลตอบแทนนับจากต้นปีนี้` : "ยังไม่มีข้อมูล", value: providentValue, cost: providentCapital, pnl: providentPnl, pnlPercent: providentPnlPercent, color: "#D8B76A" },
    { key: "bond", label: "หุ้นกู้", caption: `${activeBonds.length} รายการที่ถืออยู่ · ผลตอบแทนนับจากต้นปีนี้`, value: bondValue, cost: bondValue, pnl: bondPnl, pnlPercent: bondPnlPercent, color: "#5A63B8" },
  ];

  const totalValue = portfolios.reduce((sum, item) => sum + item.value, 0);
  const totalCost = portfolios.reduce((sum, item) => sum + (item.cost ?? 0), 0);
  const totalPnl = portfolios.reduce((sum, item) => sum + (item.pnl ?? 0), 0);
  const totalPnlPercent = totalCost === 0 ? 0 : (totalPnl / totalCost) * 100;

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-[1480px] px-4 py-6 sm:px-7 lg:px-10 lg:py-9">
        <section className="flex flex-col gap-5 border-b border-[#E4DED2] pb-7 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <div className="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#A17E37]"><span className="h-2 w-2 rounded-full bg-[#D8B76A]" />All portfolios</div>
            <h1 className="font-serif text-3xl font-semibold tracking-[-0.035em] text-[#17342D] sm:text-4xl">ภาพรวมทั้งหมด</h1>
            <p className="mt-2 text-sm leading-6 text-[#68736D]">สรุปมูลค่า ทุน กำไร/ขาดทุน และผลตอบแทนของทั้ง 3 พอร์ต ในหน้าเดียว</p>
          </div>
          <Button onClick={refresh} disabled={isFetching} className="h-10 w-fit rounded-xl bg-[#17342D] px-4 text-sm font-semibold text-white shadow-[0_8px_18px_rgba(23,52,45,0.18)] transition-all hover:bg-[#26483F] active:scale-[0.97]"><RefreshCw className={`mr-2 h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />รีเฟรชข้อมูล</Button>
        </section>

        {isLoading ? (
          <div className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Skeleton className="h-[154px] rounded-3xl" />
            <Skeleton className="h-[154px] rounded-3xl" />
            <Skeleton className="h-[154px] rounded-3xl" />
            <Skeleton className="h-[154px] rounded-3xl" />
          </div>
        ) : (
          <>
            <section className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <article className="rounded-3xl border border-[#E8E2D5] bg-white p-5 shadow-[0_14px_30px_rgba(32,54,45,0.04)]"><div className="flex items-start justify-between"><p className="text-xs font-semibold uppercase tracking-[0.1em] text-[#7A857E]">มูลค่ารวมทั้งหมด</p><span className="grid h-9 w-9 place-items-center rounded-xl bg-[#EAF3EC] text-[#176244]"><WalletCards className="h-4 w-4" /></span></div><p className="mt-6 font-serif text-3xl font-semibold tracking-[-0.035em] text-[#17342D]">{thb.format(totalValue)}</p><p className="mt-3 text-xs text-[#7A857E]">รวม 3 พอร์ต</p></article>
              <article className="rounded-3xl border border-[#E8E2D5] bg-white p-5 shadow-[0_14px_30px_rgba(32,54,45,0.04)]"><div className="flex items-start justify-between"><p className="text-xs font-semibold uppercase tracking-[0.1em] text-[#7A857E]">ทุนรวม</p><span className="grid h-9 w-9 place-items-center rounded-xl bg-[#F6F0DF] text-[#A17E37]"><BarChart3 className="h-4 w-4" /></span></div><p className="mt-6 font-serif text-3xl font-semibold tracking-[-0.035em] text-[#17342D]">{thb.format(totalCost)}</p><p className="mt-3 text-xs text-[#7A857E]">ไม่รวมส่วนที่ยังไม่ระบุทุน</p></article>
              <article className="rounded-3xl border border-[#E8E2D5] bg-white p-5 shadow-[0_14px_30px_rgba(32,54,45,0.04)]"><div className="flex items-start justify-between"><p className="text-xs font-semibold uppercase tracking-[0.1em] text-[#7A857E]">กำไร / ขาดทุนรวม</p><span className={`grid h-9 w-9 place-items-center rounded-xl ${totalPnl >= 0 ? "bg-[#EAF6EE] text-[#18734F]" : "bg-[#FFF0EF] text-[#C2413E]"}`}>{totalPnl >= 0 ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}</span></div><p className="mt-6 font-serif text-3xl font-semibold tracking-[-0.035em]"><ValueTone value={totalPnl}>{formatSignedCurrency(totalPnl)}</ValueTone></p><p className="mt-3 text-xs text-[#7A857E]">สุทธิจากทุนที่ระบุแล้ว</p></article>
              <article className="rounded-3xl border border-[#E8E2D5] bg-white p-5 shadow-[0_14px_30px_rgba(32,54,45,0.04)]"><div className="flex items-start justify-between"><p className="text-xs font-semibold uppercase tracking-[0.1em] text-[#7A857E]">ผลตอบแทนรวม</p><span className={`grid h-9 w-9 place-items-center rounded-xl ${totalPnlPercent >= 0 ? "bg-[#EAF6EE] text-[#18734F]" : "bg-[#FFF0EF] text-[#C2413E]"}`}>{totalPnlPercent >= 0 ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}</span></div><p className="mt-6 font-serif text-3xl font-semibold tracking-[-0.035em]"><ValueTone value={totalPnlPercent}>{formatSignedPercent(totalPnlPercent)}</ValueTone></p><p className="mt-3 text-xs text-[#7A857E]">เทียบกับทุนรวมที่ระบุแล้ว</p></article>
            </section>

            <section className="mt-6 rounded-3xl border border-[#E7E0D4] bg-white p-5 shadow-[0_14px_30px_rgba(32,54,45,0.035)] sm:p-6">
              <h2 className="font-serif text-xl font-semibold text-[#17342D]">แยกตามพอร์ต</h2>
              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[720px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-[#E7E0D4] text-[11px] uppercase tracking-[0.06em] text-[#78847E]">
                      <th className="py-2 pr-4 font-semibold">พอร์ต</th>
                      <th className="py-2 pr-4 font-semibold">มูลค่า</th>
                      <th className="py-2 pr-4 font-semibold">ทุน</th>
                      <th className="py-2 pr-4 font-semibold">กำไร/ขาดทุน</th>
                      <th className="py-2 pr-0 font-semibold">ผลตอบแทน</th>
                    </tr>
                  </thead>
                  <tbody>
                    {portfolios.map(item => (
                      <tr key={item.key} className="border-b border-[#F0ECE1] last:border-0">
                        <td className="py-3 pr-4"><div className="flex items-center gap-2"><span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: item.color }} /><div><p className="font-semibold text-[#17342D]">{item.label}</p><p className="text-[11px] text-[#78847E]">{item.caption}</p></div></div></td>
                        <td className="py-3 pr-4 font-semibold text-[#17342D]">{thb.format(item.value)}</td>
                        <td className="py-3 pr-4 text-[#3A453F]">{item.cost !== null ? thb.format(item.cost) : "—"}</td>
                        <td className="py-3 pr-4 font-semibold">{item.pnl !== null ? <ValueTone value={item.pnl}>{formatSignedCurrency(item.pnl)}</ValueTone> : "—"}</td>
                        <td className="py-3 pr-0 font-semibold">{item.pnlPercent !== null ? <ValueTone value={item.pnlPercent}>{formatSignedPercent(item.pnlPercent)}</ValueTone> : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="mt-6 grid gap-4 lg:grid-cols-2">
              <article className="rounded-3xl border border-[#E7E0D4] bg-white p-5 shadow-[0_14px_30px_rgba(32,54,45,0.035)] sm:p-6">
                <h2 className="font-serif text-xl font-semibold text-[#17342D]">ทุนแต่ละพอร์ต</h2>
                <div className="mt-4 h-[260px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={portfolios.map(item => ({ label: item.label, cost: item.cost ?? 0, color: item.color }))} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                      <CartesianGrid vertical={false} stroke="#E9E4DA" strokeDasharray="3 4" />
                      <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: "#748079", fontSize: 11 }} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fill: "#748079", fontSize: 11 }} tickFormatter={value => `฿${compactThb.format(Number(value))}`} width={64} />
                      <Tooltip formatter={value => thb.format(Number(value))} contentStyle={{ borderRadius: 14, border: "1px solid #E7E0D4", boxShadow: "0 10px 28px rgba(32,54,45,.09)", fontSize: 12 }} itemStyle={{ color: "#33413A", fontWeight: 600 }} labelStyle={{ color: "#17342D", fontWeight: 700 }} />
                      <Bar dataKey="cost" radius={[8, 8, 0, 0]} maxBarSize={64}>
                        {portfolios.map(item => <Cell key={item.key} fill={item.color} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </article>
              <article className="rounded-3xl border border-[#E7E0D4] bg-white p-5 shadow-[0_14px_30px_rgba(32,54,45,0.035)] sm:p-6">
                <h2 className="font-serif text-xl font-semibold text-[#17342D]">ผลตอบแทนแต่ละพอร์ต</h2>
                <div className="mt-4 h-[260px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={portfolios.map(item => ({ label: item.label, pnlPercent: item.pnlPercent ?? 0, color: item.color }))} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                      <CartesianGrid vertical={false} stroke="#E9E4DA" strokeDasharray="3 4" />
                      <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: "#748079", fontSize: 11 }} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fill: "#748079", fontSize: 11 }} tickFormatter={value => `${value}%`} width={48} />
                      <Tooltip formatter={value => formatSignedPercent(Number(value))} contentStyle={{ borderRadius: 14, border: "1px solid #E7E0D4", boxShadow: "0 10px 28px rgba(32,54,45,.09)", fontSize: 12 }} itemStyle={{ color: "#33413A", fontWeight: 600 }} labelStyle={{ color: "#17342D", fontWeight: 700 }} />
                      <Bar dataKey="pnlPercent" radius={[8, 8, 0, 0]} maxBarSize={64}>
                        {portfolios.map(item => <Cell key={item.key} fill={item.pnlPercent !== null && item.pnlPercent < 0 ? "#C2413E" : item.color} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </article>
            </section>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
