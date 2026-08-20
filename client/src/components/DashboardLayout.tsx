import ChangePasswordDialog from "@/components/ChangePasswordDialog";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { useIsMobile } from "@/hooks/useMobile";
import { usePasswordGate } from "@/hooks/usePasswordGate";
import { BarChart3, BellRing, ChartNoAxesCombined, Landmark, LayoutGrid, LayoutList, LogOut, PanelsTopLeft, ScrollText, Settings } from "lucide-react";
import { useState } from "react";
import { useLocation } from "wouter";

const STOCKS_ROUTE = "/stocks";

const topLevelItems = [{ icon: LayoutGrid, label: "ภาพรวมทั้งหมด", path: "/" }];

const menuGroups = [
  {
    label: "RMF + หุ้น",
    items: [
      { icon: BarChart3, label: "ภาพรวมพอร์ต", anchor: "overview" },
      { icon: LayoutList, label: "รายการถือครอง", anchor: "holdings" },
      { icon: BellRing, label: "จุดที่ต้องติดตาม", path: "/attention" },
      { icon: ChartNoAxesCombined, label: "ประวัติราคา", path: "/price-history" },
      { icon: BarChart3, label: "เปรียบเทียบกองทุน", path: "/compare" },
      { icon: PanelsTopLeft, label: "External Chart", path: "/siamchart" },
    ],
  },
  {
    label: "Provident Fund",
    items: [{ icon: Landmark, label: "Provident Fund", path: "/provident-fund" }],
  },
  {
    label: "หุ้นกู้ (Bond)",
    items: [{ icon: ScrollText, label: "หุ้นกู้", path: "/bonds" }],
  },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider style={{ "--sidebar-width": "252px" } as React.CSSProperties}>
      <PortfolioSidebar>{children}</PortfolioSidebar>
    </SidebarProvider>
  );
}

function PortfolioSidebar({ children }: { children: React.ReactNode }) {
  const { lock } = usePasswordGate();
  const isMobile = useIsMobile();
  const [location, setLocation] = useLocation();
  const [activeAnchor, setActiveAnchor] = useState("overview");

  const navigateTo = (anchor: string) => {
    setActiveAnchor(anchor);
    if (location !== STOCKS_ROUTE) setLocation(STOCKS_ROUTE);
    window.setTimeout(() => {
      document.getElementById(anchor)?.scrollIntoView({ behavior: "smooth", block: "start" });
      window.history.replaceState(null, "", `#${anchor}`);
    }, 0);
  };

  return (
    <>
      <Sidebar className="border-0 bg-[#112C26] text-[#F4F1E7]">
        <SidebarHeader className="px-4 pt-6 pb-5">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-2xl bg-[#D8B76A] text-[#17342D] shadow-[0_10px_24px_rgba(216,183,106,0.22)]"><BarChart3 className="h-5 w-5" /></div>
            <div className="min-w-0"><p className="font-serif text-[17px] font-semibold tracking-[-0.02em]">Portfolio Monitor</p><p className="mt-0.5 text-[11px] font-medium uppercase tracking-[0.18em] text-[#D8B76A]">Daily investing</p></div>
          </div>
        </SidebarHeader>

        <SidebarContent className="px-3">
          <SidebarMenu>
            {topLevelItems.map(item => (
              <SidebarMenuItem key={item.path}>
                <SidebarMenuButton
                  isActive={location === item.path}
                  onClick={() => setLocation(item.path)}
                  tooltip={item.label}
                  className="h-11 rounded-xl text-[#C5D4CF] hover:bg-white/8 hover:text-white data-[active=true]:bg-[#D8B76A] data-[active=true]:text-[#16312A] data-[active=true]:shadow-sm"
                >
                  <item.icon className="h-4 w-4" />
                  <span className="font-medium">{item.label}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>

          {menuGroups.map(group => (
            <SidebarGroup key={group.label} className="px-0">
              <SidebarGroupLabel className="px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#91A9A1]">{group.label}</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {group.items.map(item => (
                    <SidebarMenuItem key={item.anchor ?? item.path}>
                      <SidebarMenuButton
                        isActive={item.path ? location === item.path : location === STOCKS_ROUTE && activeAnchor === item.anchor}
                        onClick={() => item.path ? setLocation(item.path) : navigateTo(item.anchor!)}
                        tooltip={item.label}
                        className="h-11 rounded-xl text-[#C5D4CF] hover:bg-white/8 hover:text-white data-[active=true]:bg-[#D8B76A] data-[active=true]:text-[#16312A] data-[active=true]:shadow-sm"
                      >
                        <item.icon className="h-4 w-4" />
                        <span className="font-medium">{item.label}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          ))}

          <SidebarGroup className="px-0">
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <ChangePasswordDialog
                    trigger={openDialog => (
                      <SidebarMenuButton
                        onClick={openDialog}
                        tooltip="ตั้งค่า"
                        className="h-11 rounded-xl text-[#C5D4CF] hover:bg-white/8 hover:text-white"
                      >
                        <Settings className="h-4 w-4" />
                        <span className="font-medium">ตั้งค่า</span>
                      </SidebarMenuButton>
                    )}
                  />
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        <SidebarFooter className="p-4">
          <button
            onClick={() => lock()}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/15 px-3 py-2.5 text-sm font-medium text-[#F4F1E7] transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D8B76A]"
          >
            <LogOut className="h-4 w-4" />ล็อกแอป
          </button>
        </SidebarFooter>
      </Sidebar>

      <SidebarInset className="bg-[#F7F6F1]">
        {isMobile && (
          <header className="sticky top-0 z-40 flex h-16 items-center gap-3 border-b border-[#E6E1D6] bg-[#F7F6F1]/95 px-4 backdrop-blur">
            <SidebarTrigger className="h-9 w-9 rounded-xl border border-[#E6E1D6] bg-white text-[#17342D]" />
            <div><p className="font-serif text-base font-semibold text-[#17342D]">Portfolio Monitor</p><p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#8A938C]">Daily snapshot</p></div>
          </header>
        )}
        <main className="min-h-screen flex-1">{children}</main>
      </SidebarInset>
    </>
  );
}
