import { useMemo, useState } from "react";
import {
  LayoutDashboard, Package, FilePlus2, ClipboardCheck, PackagePlus,
  History as HistoryIcon, BarChart3, Shield, UserCog, LogOut, Boxes, Menu, X, Megaphone, ArrowLeftRight, FileSpreadsheet,
} from "lucide-react";
import Login from "./screens/Login";
import Announcements from "./screens/Announcements";
import Movement from "./screens/Movement";
import GoodIssueSAP from "./screens/GoodIssueSAP";
import Dashboard from "./screens/Dashboard";
import Inventory from "./screens/Inventory";
import Requisition from "./screens/Requisition";
import History from "./screens/History";
import Approvals from "./screens/Approvals";
import GoodsReceipt from "./screens/GoodsReceipt";
import Reports from "./screens/Reports";
import Admin from "./screens/Admin";
import Profile from "./screens/Profile";
import { ToastProvider } from "./ui";
import type { User } from "./types";

const STORAGE_KEY = "thamc_user";

type TabId = "announcements" | "dashboard" | "inventory" | "movement" | "requisition" | "approvals" | "goods-receipt" | "history" | "reports" | "good-issue-sap" | "admin" | "profile";

interface NavItem { id: TabId; label: string; icon: React.ComponentType<any>; roles?: string[]; }

const NAV: NavItem[] = [
  { id: "announcements", label: "ประกาศข่าวสาร", icon: Megaphone },
  { id: "dashboard", label: "แดชบอร์ด", icon: LayoutDashboard },
  { id: "requisition", label: "สร้างใบเบิก", icon: FilePlus2 },
  { id: "history", label: "ประวัติใบเบิก", icon: HistoryIcon },
  { id: "approvals", label: "อนุมัติใบเบิก", icon: ClipboardCheck, roles: ["Admin", "Manager", "Staff"] },
  { id: "inventory", label: "คลังพัสดุ", icon: Package },
  { id: "goods-receipt", label: "รับวัสดุเข้าคลัง", icon: PackagePlus, roles: ["Admin", "Manager", "Staff"] },
  { id: "movement", label: "การเคลื่อนไหวพัสดุ", icon: ArrowLeftRight, roles: ["Admin", "Manager", "Staff"] },
  { id: "reports", label: "รายงาน", icon: BarChart3, roles: ["Admin", "Manager", "Staff"] },
  { id: "good-issue-sap", label: "Good Issue SAP", icon: FileSpreadsheet, roles: ["Admin", "Manager", "Staff"] },
  { id: "admin", label: "ผู้ดูแลระบบ", icon: Shield, roles: ["Admin"] },
];

export default function App() {
  const [user, setUser] = useState<User | null>(() => {
    try { const s = localStorage.getItem(STORAGE_KEY); return s ? (JSON.parse(s) as User) : null; } catch { return null; }
  });
  const [tab, setTab] = useState<TabId>("announcements");
  const [mobileOpen, setMobileOpen] = useState(false);

  const setAndStore = (u: User | null) => {
    if (u) localStorage.setItem(STORAGE_KEY, JSON.stringify(u));
    else localStorage.removeItem(STORAGE_KEY);
    setUser(u);
  };

  const visibleNav = useMemo(
    () => NAV.filter((n) => !n.roles || (user && n.roles.includes(user.role))),
    [user]
  );

  if (!user) return <ToastProvider><Login onLogin={(u) => { setAndStore(u); setTab("dashboard"); }} /></ToastProvider>;

  const go = (t: TabId) => { setTab(t); setMobileOpen(false); };

  // เมนูล่างมือถือ: 4 เมนูหลักตามสิทธิ์ + ปุ่ม "เพิ่มเติม" เปิด drawer
  const bottomPriority = ["announcements", "requisition", "history", "approvals", "inventory"];
  const bottomMain = bottomPriority
    .map((id) => visibleNav.find((n) => n.id === id))
    .filter(Boolean)
    .slice(0, 4) as typeof NAV;
  const bottomNav = [...bottomMain, { id: "__more", label: "เพิ่มเติม", icon: Menu } as any];

  const SidebarInner = (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2.5 px-5 py-5">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#5b4df6] shadow-[0_8px_20px_-6px_rgba(91,77,246,.6)]"><Boxes className="h-5 w-5 text-white" /></div>
        <div>
          <div className="text-sm font-bold text-white">THAMC e-Material</div>
          <div className="text-[10px] text-slate-400">Inventory Management</div>
        </div>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-2">
        {visibleNav.map((n) => {
          const Icon = n.icon;
          const active = tab === n.id;
          return (
            <button key={n.id} onClick={() => go(n.id)}
              className={`flex w-full cursor-pointer items-center gap-3 rounded-xl border-none px-3.5 py-2.5 text-left text-sm font-medium transition ${active ? "bg-[#5b4df6] text-white shadow-[0_6px_18px_-8px_rgba(91,77,246,.8)]" : "bg-transparent text-slate-300 hover:bg-white/5 hover:text-white"}`}>
              <Icon className="h-[18px] w-[18px] shrink-0" />{n.label}
            </button>
          );
        })}
      </nav>

      <div className="border-t border-white/10 p-3">
        <button onClick={() => go("profile")} className={`flex w-full cursor-pointer items-center gap-3 rounded-xl border-none px-3 py-2.5 text-left transition ${tab === "profile" ? "bg-white/10" : "bg-transparent hover:bg-white/5"}`}>
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#5b4df6] text-sm font-bold text-white">{user.name.charAt(0)}</div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-xs font-semibold text-white">{user.name}</div>
            <div className="truncate text-[10px] text-slate-400">{user.role} · {user.department}</div>
          </div>
        </button>
        <button onClick={() => { setAndStore(null); setTab("dashboard"); }} className="mt-1 flex w-full cursor-pointer items-center gap-3 rounded-xl border-none bg-transparent px-3.5 py-2.5 text-left text-sm font-medium text-slate-400 transition hover:bg-rose-500/10 hover:text-rose-300">
          <LogOut className="h-[18px] w-[18px]" />ออกจากระบบ
        </button>
      </div>
    </div>
  );

  const render = () => {
    switch (tab) {
      case "announcements": return <Announcements user={user} />;
      case "dashboard": return <Dashboard user={user} />;
      case "inventory": return <Inventory user={user} />;
      case "requisition": return <Requisition user={user} onDone={() => setTab("history")} />;
      case "history": return <History user={user} />;
      case "approvals": return <Approvals user={user} />;
      case "goods-receipt": return <GoodsReceipt user={user} />;
      case "movement": return <Movement />;
      case "reports": return <Reports user={user} />;
      case "good-issue-sap": return <GoodIssueSAP />;
      case "admin": return <Admin user={user} />;
      case "profile": return <Profile user={user} onUpdate={setAndStore} />;
      default: return <Dashboard user={user} />;
    }
  };

  return (
    <ToastProvider>
      <div className="flex min-h-screen bg-[#f6f7fb] font-sans">
        {/* Sidebar (desktop) */}
        <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col bg-[#141034] lg:flex">{SidebarInner}</aside>

        {/* Sidebar (mobile drawer) */}
        {mobileOpen && (
          <div className="fixed inset-0 z-40 lg:hidden">
            <div className="absolute inset-0 bg-slate-900/50" onClick={() => setMobileOpen(false)} />
            <aside className="absolute left-0 top-0 h-full w-64 bg-[#141034]">{SidebarInner}</aside>
          </div>
        )}

        {/* Main */}
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-slate-200 bg-white/90 px-4 pb-3 backdrop-blur lg:hidden" style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 12px)" }}>
            <button onClick={() => setMobileOpen(true)} className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-lg border-none bg-slate-100 text-slate-600"><Menu className="h-5 w-5" /></button>
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#5b4df6]"><Boxes className="h-4 w-4 text-white" /></div>
              <span className="text-sm font-bold text-slate-700">THAMC e-Material</span>
            </div>
          </header>
          <main className="mx-auto w-full max-w-7xl flex-1 p-5 pb-24 sm:p-8 lg:pb-8">{render()}</main>
        </div>

        {/* Bottom nav (mobile) */}
        <nav className="fixed inset-x-0 bottom-0 z-30 flex items-stretch justify-around border-t border-slate-200 bg-white/95 backdrop-blur lg:hidden" style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
          {bottomNav.map((n) => {
            const Icon = n.icon;
            const active = tab === n.id;
            return (
              <button key={n.id} onClick={() => n.id === "__more" ? setMobileOpen(true) : go(n.id as TabId)}
                className={`flex flex-1 cursor-pointer flex-col items-center gap-0.5 border-none bg-transparent py-2 text-[10px] font-medium transition ${active ? "text-[#5b4df6]" : "text-slate-400"}`}>
                <Icon className="h-[22px] w-[22px]" strokeWidth={active ? 2.5 : 2} />
                <span className="leading-tight">{n.label}</span>
              </button>
            );
          })}
        </nav>
      </div>
    </ToastProvider>
  );
}
