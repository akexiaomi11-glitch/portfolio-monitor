import { Bar, BarChart, Cell, LabelList, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { BarChart3, DatabaseZap, PieChart as PieChartIcon, TrendingDown, TrendingUp } from "lucide-react";

export type PortfolioVisualHolding = {
  name: string;
  currentValue: number;
  cost: number;
  pnl: number;
  pnlPercent: number;
};

type ChartHolding = PortfolioVisualHolding & { chartName: string };

const thb = new Intl.NumberFormat("th-TH", { style: "currency", currency: "THB", maximumFractionDigits: 0 });
const percentage = new Intl.NumberFormat("th-TH", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const statusColors = ["#1C8B61", "#D65A55"];

function PnlPercentLabel({ x = 0, y = 0, width = 0, height = 0, value }: { x?: string | number; y?: string | number; width?: string | number; height?: string | number; value?: string | number }) {
  if (value === undefined || value === null) return null;
  const percentValue = Number(value);
  const label = `${percentValue >= 0 ? "+" : ""}${percentage.format(percentValue)}%`;
  const labelX = Number(x) + Number(width) + 8;
  const labelY = Number(y) + Number(height) / 2 + 4;
  return <text x={labelX} y={labelY} fill={percentValue >= 0 ? "#19734F" : "#C2413E"} fontSize={11} fontWeight={700}>{label}</text>;
}

export default function PortfolioVisuals({ holdings }: { holdings: PortfolioVisualHolding[] }) {
  const largestHoldings: ChartHolding[] = [...holdings]
    .sort((left, right) => right.currentValue - left.currentValue)
    .slice(0, 5)
    .map(holding => ({
      ...holding,
      chartName: holding.name.length > 14 ? `${holding.name.slice(0, 14)}…` : holding.name,
    }));

  const positiveCount = holdings.filter(holding => holding.pnl >= 0).length;
  const negativeCount = holdings.filter(holding => holding.pnl < 0).length;
  const statusData = [
    { name: "ผลตอบแทนบวก", value: positiveCount },
    { name: "ติดลบ", value: negativeCount },
  ].filter(item => item.value > 0);

  return (
    <section className="mt-6 grid gap-4 xl:grid-cols-[1.45fr_1fr]">
      <article className="rounded-3xl border border-[#E7E0D4] bg-white p-5 shadow-[0_14px_30px_rgba(32,54,45,0.035)] sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-[#A17E37]"><BarChart3 className="h-3.5 w-3.5" />Portfolio lens</div>
            <h2 className="mt-1 font-serif text-xl font-semibold text-[#17342D]">ทุนและผลตอบแทนของรายการหลัก</h2>
            <p className="mt-1 text-xs leading-5 text-[#748079]">แถบสีเทาแทนทุน ส่วนสีเขียว/แดงแทน P&L และตัวเลขท้ายแถบคือ %P&L</p>
          </div>
          <span className="rounded-xl bg-[#EEF5F0] px-2.5 py-1.5 text-xs font-semibold text-[#176244]">Top 5</span>
        </div>
        <div className="mt-4 h-[258px]" aria-label="กราฟแท่งทุนและกำไรขาดทุนของรายการถือครอง">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={largestHoldings} layout="vertical" margin={{ top: 4, right: 58, left: 0, bottom: 2 }} barCategoryGap="26%">
              <XAxis type="number" hide />
              <YAxis type="category" dataKey="chartName" width={108} tickLine={false} axisLine={false} tick={{ fill: "#64716B", fontSize: 11, fontWeight: 600 }} />
              <Tooltip
                cursor={{ fill: "#F7F6F1" }}
                formatter={(value, name) => [thb.format(Number(value)), name === "cost" ? "ทุน" : "P&L"]}
                contentStyle={{ borderRadius: 14, border: "1px solid #E7E0D4", boxShadow: "0 10px 28px rgba(32,54,45,.09)", fontSize: 12 }}
                labelStyle={{ color: "#17342D", fontWeight: 700, marginBottom: 4 }}
                itemStyle={{ color: "#33413A", fontWeight: 600 }}
              />
              <Bar dataKey="cost" stackId="capital" fill="#C3D1C9" radius={[0, 0, 0, 0]} maxBarSize={22} />
              <Bar dataKey="pnl" stackId="capital" radius={[0, 8, 8, 0]} maxBarSize={22}>
                {largestHoldings.map(holding => <Cell key={holding.name} fill={holding.pnl >= 0 ? "#1C8B61" : "#D65A55"} />)}
                <LabelList dataKey="pnlPercent" content={PnlPercentLabel} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-[#748079]"><span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-sm bg-[#C3D1C9]" />ทุน</span><span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-sm bg-[#1C8B61]" />กำไร</span><span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-sm bg-[#D65A55]" />ขาดทุน</span></div>
      </article>

      <article className="rounded-3xl border border-[#E7E0D4] bg-[#FDFCF8] p-5 sm:p-6">
        <div className="flex items-start gap-3"><div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#F6F0DF] text-[#A17E37]"><PieChartIcon className="h-4 w-4" /></div><div><p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#A17E37]">Health mix</p><h2 className="mt-1 font-serif text-xl font-semibold text-[#17342D]">สถานะผลตอบแทน</h2><p className="mt-1 text-xs leading-5 text-[#748079]">มองภาพรวมของรายการในพอร์ต</p></div></div>
        <div className="mt-2 grid grid-cols-[132px_1fr] items-center gap-2"><div className="h-[142px]" aria-label="กราฟโดนัทสถานะผลตอบแทน"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={statusData} dataKey="value" nameKey="name" innerRadius={42} outerRadius={62} paddingAngle={5} stroke="none">{statusData.map((entry, index) => <Cell key={entry.name} fill={statusColors[index]} />)}</Pie><Tooltip formatter={value => `${value} รายการ`} contentStyle={{ borderRadius: 12, border: "1px solid #E7E0D4", fontSize: 12 }} /></PieChart></ResponsiveContainer></div><div className="space-y-3"><div className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-[#1C8B61]" /><div><p className="text-sm font-semibold text-[#17342D]">{positiveCount} รายการ</p><p className="text-[11px] text-[#748079]">ผลตอบแทนเป็นบวก</p></div><TrendingUp className="ml-auto h-4 w-4 text-[#1C8B61]" /></div><div className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-[#D65A55]" /><div><p className="text-sm font-semibold text-[#17342D]">{negativeCount} รายการ</p><p className="text-[11px] text-[#748079]">ต้องติดตามผลตอบแทน</p></div><TrendingDown className="ml-auto h-4 w-4 text-[#D65A55]" /></div></div></div>
        <div className="mt-4 flex items-center gap-2 rounded-2xl border border-[#E7E0D4] bg-white/80 px-3 py-2.5 text-xs text-[#617069]"><DatabaseZap className="h-4 w-4 shrink-0 text-[#A17E37]" />ข้อมูลจาก Google Sheets · Stock · Status = Active</div>
      </article>
    </section>
  );
}
