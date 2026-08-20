import DashboardLayout from "@/components/DashboardLayout";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/trpc";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CalendarDays, Landmark, LineChart as LineChartIcon, TrendingUp, WalletCards } from "lucide-react";
import { useState } from "react";

const thb = new Intl.NumberFormat("th-TH", { style: "currency", currency: "THB", maximumFractionDigits: 0 });
const compactThb = new Intl.NumberFormat("th-TH", { notation: "compact", maximumFractionDigits: 1 });
const percentage = new Intl.NumberFormat("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const dateFormatter = new Intl.DateTimeFormat("th-TH", { dateStyle: "medium", timeZone: "Asia/Bangkok" });
const shortDateFormatter = new Intl.DateTimeFormat("th-TH", { day: "numeric", month: "short", year: "2-digit", timeZone: "Asia/Bangkok" });

function formatSignedCurrency(value: number) {
  return `${value >= 0 ? "+" : "−"}${thb.format(Math.abs(value))}`;
}

function formatSignedPercent(value: number) {
  return `${value >= 0 ? "+" : ""}${percentage.format(value)}%`;
}

function ValueTone({ value, children }: { value: number; children: React.ReactNode }) {
  return <span className={value >= 0 ? "text-[#11865B]" : "text-[#C2413E]"}>{children}</span>;
}

export default function ProvidentFund() {
  const snapshotQuery = trpc.providentFund.snapshot.useQuery(undefined, { refetchOnWindowFocus: false });
  const [view, setView] = useState<"monthly" | "weekly">("monthly");
  const snapshot = snapshotQuery.data;
  const latest = snapshot?.latest;
  const monthly = snapshot?.monthly ?? [];
  const weekly = snapshot?.weekly ?? [];

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-[1320px] px-4 py-7 sm:px-7 lg:px-10 lg:py-10">
        <section className="flex flex-col gap-5 border-b border-[#E4DED2] pb-7 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#A17E37]">Retirement savings</p>
            <h1 className="mt-2 font-serif text-3xl font-semibold tracking-[-0.035em] text-[#17342D]">Provident Fund</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[#68736D]">ติดตามมูลค่า เงินสะสม/เงินสมทบ และผลตอบแทนของกองทุนสำรองเลี้ยงชีพ ข้อมูลดึงจาก Google Sheets · PVF_Weekly / PVF_Monthly</p>
          </div>
          <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center">
            {latest && <div className="inline-flex items-center gap-2 rounded-2xl border border-[#E6D7B9] bg-[#FFF9ED] px-3 py-2 text-xs text-[#8A6326]"><CalendarDays className="h-4 w-4" />ข้อมูล ณ วันที่ {dateFormatter.format(new Date(latest.asOfDate))}</div>}
            <div className="flex rounded-xl border border-[#E7E0D4] bg-[#FDFCF8] p-1">
              {([{ value: "monthly", label: "รายเดือน" }, { value: "weekly", label: "รายสัปดาห์" }] as const).map(option => (
                <button key={option.value} onClick={() => setView(option.value)} className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${view === option.value ? "bg-[#17342D] text-white" : "text-[#66736C] hover:bg-white"}`}>
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        </section>

        {snapshotQuery.isLoading || !snapshot ? (
          <div className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Skeleton className="h-32 rounded-3xl" />
            <Skeleton className="h-32 rounded-3xl" />
            <Skeleton className="h-32 rounded-3xl" />
            <Skeleton className="h-32 rounded-3xl" />
          </div>
        ) : !latest ? (
          <div className="mt-7 rounded-3xl border border-dashed border-[#D9D2C6] bg-white/70 p-12 text-center">
            <WalletCards className="mx-auto h-8 w-8 text-[#A17E37]" />
            <p className="mt-4 font-semibold text-[#17342D]">ยังไม่พบข้อมูล Provident Fund</p>
            <p className="mt-1 text-sm text-[#748079]">ตรวจสอบว่าชีต PVF_Monthly / PVF_Weekly มีข้อมูลและแชร์ให้ service account แล้ว</p>
          </div>
        ) : (
          <>
            <div className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <article className="rounded-3xl border border-[#E8E2D5] bg-white p-5"><p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[#7A857E]">มูลค่าปัจจุบัน</p><p className="mt-2 font-serif text-xl font-semibold text-[#17342D]">{thb.format(latest.value)}</p><p className="mt-1 text-[11px] text-[#78847E]">{latest.fundName}</p></article>
              <article className="rounded-3xl border border-[#E8E2D5] bg-white p-5"><p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[#7A857E]">เงินสะสม + เงินสมทบ</p><p className="mt-2 font-serif text-xl font-semibold text-[#17342D]">{thb.format(latest.capital)}</p><p className="mt-1 text-[11px] text-[#78847E]">ทุนสะสมตั้งแต่เริ่มต้น</p></article>
              <article className="rounded-3xl border border-[#E8E2D5] bg-white p-5"><p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[#7A857E]">กำไร/ขาดทุนสะสม (ตั้งแต่เริ่ม)</p><p className="mt-2 font-serif text-xl font-semibold"><ValueTone value={latest.lifetimePnl}>{formatSignedCurrency(latest.lifetimePnl)}</ValueTone></p><p className="mt-1 text-[11px] text-[#78847E]">{latest.lifetimePnlPercent !== null ? <ValueTone value={latest.lifetimePnlPercent}>{formatSignedPercent(latest.lifetimePnlPercent)}</ValueTone> : "—"}</p></article>
              <article className="rounded-3xl border border-[#E8E2D5] bg-white p-5"><p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[#7A857E]">ผลตอบแทน YTD (จากกองทุน)</p><p className="mt-2 font-serif text-xl font-semibold"><ValueTone value={latest.ytdPnl}>{formatSignedCurrency(latest.ytdPnl)}</ValueTone></p><p className="mt-1 text-[11px] text-[#78847E]">{latest.cumulativeReturnPercent !== null ? <ValueTone value={latest.cumulativeReturnPercent}>{formatSignedPercent(latest.cumulativeReturnPercent)}</ValueTone> : "—"}</p></article>
            </div>

            <div className="mt-4 flex flex-wrap gap-4 rounded-2xl border border-[#E7E0D4] bg-white/70 px-4 py-3 text-xs text-[#617069]">
              {latest.nav !== null && <span className="inline-flex items-center gap-1.5"><TrendingUp className="h-3.5 w-3.5 text-[#A17E37]" />NAV {latest.nav.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 4 })}</span>}
              {latest.memberUnits !== null && <span>หน่วยสมาชิก {latest.memberUnits.toLocaleString("th-TH", { maximumFractionDigits: 4 })}</span>}
              {latest.employerUnits !== null && <span>หน่วยนายจ้าง {latest.employerUnits.toLocaleString("th-TH", { maximumFractionDigits: 4 })}</span>}
            </div>

            {view === "monthly" ? (
              <>
                {monthly.length > 0 && (
                  <section className="mt-6 rounded-3xl border border-[#E7E0D4] bg-white p-5 shadow-[0_14px_30px_rgba(32,54,45,0.035)] sm:p-6">
                    <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-[#A17E37]"><Landmark className="h-3.5 w-3.5" />มูลค่ารายเดือน</div>
                    <div className="mt-4 h-[300px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={monthly.map(point => ({ label: point.label, capital: point.capital, pnl: point.pnl }))} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                          <CartesianGrid vertical={false} stroke="#E9E4DA" strokeDasharray="3 4" />
                          <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: "#748079", fontSize: 11 }} interval="preserveStartEnd" />
                          <YAxis axisLine={false} tickLine={false} tick={{ fill: "#748079", fontSize: 11 }} tickFormatter={value => `฿${compactThb.format(Number(value))}`} width={64} />
                          <Tooltip formatter={(value, name) => [thb.format(Number(value)), name === "capital" ? "เงินสะสม + เงินสมทบ" : "ผลประโยชน์"]} contentStyle={{ borderRadius: 14, border: "1px solid #E7E0D4", boxShadow: "0 10px 28px rgba(32,54,45,.09)", fontSize: 12 }} itemStyle={{ color: "#33413A", fontWeight: 600 }} labelStyle={{ color: "#17342D", fontWeight: 700 }} />
                          <Bar dataKey="capital" stackId="pvf" fill="#EADFC2" radius={[0, 0, 0, 0]} maxBarSize={36} />
                          <Bar dataKey="pnl" stackId="pvf" fill="#D8B76A" radius={[8, 8, 0, 0]} maxBarSize={36} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </section>
                )}

                <section className="mt-6 rounded-3xl border border-[#E7E0D4] bg-white p-5 shadow-[0_14px_30px_rgba(32,54,45,0.035)] sm:p-6">
                  <h2 className="font-serif text-xl font-semibold text-[#17342D]">ประวัติรายเดือน</h2>
                  <div className="mt-4 overflow-x-auto">
                    <table className="w-full min-w-[560px] text-left text-sm">
                      <thead>
                        <tr className="border-b border-[#E7E0D4] text-[11px] uppercase tracking-[0.06em] text-[#78847E]">
                          <th className="py-2 pr-4 font-semibold">เดือน</th>
                          <th className="py-2 pr-4 font-semibold">เงินสะสม + เงินสมทบ</th>
                          <th className="py-2 pr-4 font-semibold">ผลประโยชน์</th>
                          <th className="py-2 pr-0 font-semibold">รวม</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[...monthly].reverse().map(point => (
                          <tr key={point.label} className="border-b border-[#F0ECE1] last:border-0">
                            <td className="py-3 pr-4 font-semibold text-[#17342D]">{point.label}</td>
                            <td className="py-3 pr-4 text-[#3A453F]">{thb.format(point.capital)}</td>
                            <td className="py-3 pr-4 font-semibold"><ValueTone value={point.pnl}>{formatSignedCurrency(point.pnl)}</ValueTone></td>
                            <td className="py-3 pr-0 font-semibold text-[#17342D]">{thb.format(point.total)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              </>
            ) : (
              <>
                <section className="mt-6 rounded-3xl border border-[#E7E0D4] bg-white p-5 shadow-[0_14px_30px_rgba(32,54,45,0.035)] sm:p-6">
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-[#A17E37]"><LineChartIcon className="h-3.5 w-3.5" />แนวโน้มมูลค่า/NAV รายสัปดาห์</div>
                  {weekly.length < 2 ? (
                    <div className="mt-6 rounded-2xl border border-dashed border-[#D9D2C6] bg-white/70 p-8 text-center">
                      <LineChartIcon className="mx-auto h-7 w-7 text-[#A17E37]" />
                      <p className="mt-3 font-semibold text-[#17342D]">ยังมีข้อมูลรายสัปดาห์ไม่พอวาดกราฟแนวโน้ม</p>
                      <p className="mt-1 text-xs leading-5 text-[#748079]">เมื่อมีการอัปเดต PVF_Weekly เพิ่มในแต่ละสัปดาห์ กราฟแนวโน้มจะแสดงที่นี่โดยอัตโนมัติ</p>
                    </div>
                  ) : (
                    <div className="mt-4 h-[320px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={weekly.map(point => ({ dateLabel: shortDateFormatter.format(new Date(point.asOfDate)), value: point.value, nav: point.nav }))} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                          <CartesianGrid vertical={false} stroke="#E9E4DA" strokeDasharray="3 4" />
                          <XAxis dataKey="dateLabel" axisLine={false} tickLine={false} tick={{ fill: "#748079", fontSize: 11 }} minTickGap={24} />
                          <YAxis yAxisId="value" axisLine={false} tickLine={false} tick={{ fill: "#748079", fontSize: 11 }} tickFormatter={value => `฿${compactThb.format(Number(value))}`} width={64} />
                          <YAxis yAxisId="nav" orientation="right" axisLine={false} tickLine={false} tick={{ fill: "#A17E37", fontSize: 11 }} width={56} />
                          <Tooltip formatter={(value, name) => [name === "value" ? thb.format(Number(value)) : Number(value).toLocaleString("th-TH", { maximumFractionDigits: 4 }), name === "value" ? "มูลค่าสุทธิ" : "NAV"]} labelFormatter={label => `วันที่ ${label}`} contentStyle={{ borderRadius: 14, border: "1px solid #E7E0D4", boxShadow: "0 10px 28px rgba(32,54,45,.09)", fontSize: 12 }} itemStyle={{ color: "#33413A", fontWeight: 600 }} labelStyle={{ color: "#17342D", fontWeight: 700 }} />
                          <Line yAxisId="value" type="monotone" dataKey="value" stroke="#D8B76A" strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5, fill: "#17342D", stroke: "#fff", strokeWidth: 2 }} />
                          <Line yAxisId="nav" type="monotone" dataKey="nav" stroke="#5A63B8" strokeWidth={2} dot={{ r: 3 }} strokeDasharray="4 3" />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </section>

                <section className="mt-6 rounded-3xl border border-[#E7E0D4] bg-white p-5 shadow-[0_14px_30px_rgba(32,54,45,0.035)] sm:p-6">
                  <h2 className="font-serif text-xl font-semibold text-[#17342D]">ประวัติรายสัปดาห์</h2>
                  <div className="mt-4 overflow-x-auto">
                    <table className="w-full min-w-[640px] text-left text-sm">
                      <thead>
                        <tr className="border-b border-[#E7E0D4] text-[11px] uppercase tracking-[0.06em] text-[#78847E]">
                          <th className="py-2 pr-4 font-semibold">วันที่</th>
                          <th className="py-2 pr-4 font-semibold">มูลค่าสุทธิ</th>
                          <th className="py-2 pr-4 font-semibold">NAV</th>
                          <th className="py-2 pr-4 font-semibold">ผลตอบแทน YTD</th>
                          <th className="py-2 pr-0 font-semibold">หน่วยรวม</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[...weekly].reverse().map(point => (
                          <tr key={point.asOfDate.toString()} className="border-b border-[#F0ECE1] last:border-0">
                            <td className="py-3 pr-4 font-semibold text-[#17342D]">{dateFormatter.format(new Date(point.asOfDate))}</td>
                            <td className="py-3 pr-4 text-[#3A453F]">{thb.format(point.value)}</td>
                            <td className="py-3 pr-4 text-[#3A453F]">{point.nav !== null ? point.nav.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 4 }) : "—"}</td>
                            <td className="py-3 pr-4 font-semibold">{point.cumulativeReturnPercent !== null ? <ValueTone value={point.cumulativeReturnPercent}>{formatSignedPercent(point.cumulativeReturnPercent)}</ValueTone> : "—"}</td>
                            <td className="py-3 pr-0 text-[#3A453F]">{point.units !== null ? point.units.toLocaleString("th-TH", { maximumFractionDigits: 4 }) : "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              </>
            )}
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
