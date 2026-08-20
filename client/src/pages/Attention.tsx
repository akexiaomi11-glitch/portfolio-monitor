import DashboardLayout from "@/components/DashboardLayout";
import { useStaleThreshold } from "@/hooks/useStaleThreshold";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/trpc";
import { isDataStaleForThreshold } from "@shared/portfolioMonitoring";
import { AlertTriangle, ArrowDownRight, CalendarClock, ShieldAlert, Zap } from "lucide-react";

const thb = new Intl.NumberFormat("th-TH", { style: "currency", currency: "THB", maximumFractionDigits: 0 });

export default function Attention() {
  const snapshotQuery = trpc.portfolio.snapshot.useQuery(undefined, { refetchOnWindowFocus: false });
  const [staleDays] = useStaleThreshold();
  const holdings = snapshotQuery.data?.holdings ?? [];
  const attentionHoldings = holdings.map(holding => {
    const stale = isDataStaleForThreshold(holding.businessDaysOld, staleDays);
    return {
      ...holding,
      attentionReasons: [
        ...(holding.isNegativePnl ? ["ผลตอบแทนติดลบ"] : []),
        ...(holding.hasLargeDailyChange ? ["ความเคลื่อนไหวรายวันสูง"] : []),
        ...(stale ? [holding.businessDaysOld === null ? "ไม่พบวันที่อัปเดต" : `ข้อมูลเกิน ${staleDays} วันทำการ`] : []),
      ],
    };
  }).filter(holding => holding.attentionReasons.length > 0);

  return <DashboardLayout><div className="mx-auto max-w-[1180px] px-4 py-7 sm:px-7 lg:px-10 lg:py-10"><div className="border-b border-[#E4DED2] pb-7"><p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#A17E37]">Action queue</p><h1 className="mt-2 font-serif text-3xl font-semibold tracking-[-0.035em] text-[#17342D]">จุดที่ต้องติดตาม</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-[#68736D]">รายการ Active ที่มีผลตอบแทนติดลบ ความเคลื่อนไหวรายวันสูง หรือข้อมูลเกินเกณฑ์ {staleDays} วันทำการที่คุณเลือกไว้</p></div>{snapshotQuery.isLoading ? <div className="mt-7 space-y-3"><Skeleton className="h-28 w-full rounded-3xl" /><Skeleton className="h-28 w-full rounded-3xl" /></div> : attentionHoldings.length === 0 ? <div className="mt-7 rounded-3xl border border-[#D7E7DC] bg-[#F4FBF6] p-10 text-center"><ShieldAlert className="mx-auto h-8 w-8 text-[#1C8B61]" /><p className="mt-4 font-semibold text-[#17342D]">ยังไม่มีสัญญาณที่ต้องติดตาม</p><p className="mt-1 text-sm text-[#617069]">ทุกรายการ Active ผ่านเกณฑ์การติดตามปัจจุบัน</p></div> : <div className="mt-7 grid gap-4">{attentionHoldings.map(holding => <article key={holding.id} className="rounded-3xl border border-[#F0D7C0] bg-[#FFFDF8] p-5 shadow-[0_12px_28px_rgba(70,48,18,0.035)] sm:p-6"><div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div><div className="flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-[#B26E18]" /><h2 className="font-semibold text-[#17342D]">{holding.name}</h2></div><div className="mt-3 flex flex-wrap gap-2">{holding.attentionReasons.map(reason => <Badge key={reason} variant="outline" className="border-[#E7C296] bg-[#FFF7E8] text-[#9A5D11]">{reason}</Badge>)}</div></div><div className="grid grid-cols-3 gap-5 text-right"><div><p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#87918B]">P&L</p><p className={`mt-1 text-sm font-bold ${holding.pnl >= 0 ? "text-[#1C8B61]" : "text-[#C2413E]"}`}>{holding.pnl >= 0 ? "+" : "−"}{thb.format(Math.abs(holding.pnl))}</p></div><div><p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#87918B]">%Change</p><p className={`mt-1 text-sm font-bold ${holding.dailyChangePercent >= 0 ? "text-[#1C8B61]" : "text-[#C2413E]"}`}>{holding.dailyChangePercent >= 0 ? "+" : ""}{holding.dailyChangePercent.toFixed(2)}%</p></div><div><p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#87918B]">อัปเดต</p><p className="mt-1 text-sm font-bold text-[#55645E]">{holding.updatedDate ?? "ไม่พบวันที่"}</p></div></div></div></article>)}</div>}</div></DashboardLayout>;
}
