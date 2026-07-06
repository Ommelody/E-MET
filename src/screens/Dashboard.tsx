import { useEffect, useState } from "react";
import { Package, Wallet, AlertTriangle, ClipboardList, Clock, PackageCheck, CheckCircle2 } from "lucide-react";
import { dashboardApi } from "../lib/api";
import { fmtBaht, fmtNumber, fmtDateTime, statusLabel } from "../lib/format";
import { Card, Spinner, Badge, EmptyState } from "../ui";
import { STATUS_STYLES } from "../lib/format";
import type { User } from "../types";

function Stat({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: string; accent: string }) {
  return (
    <Card className="p-5">
      <div className="flex items-center gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl" style={{ background: accent + "1a", color: accent }}>{icon}</div>
        <div>
          <div className="text-xs font-medium text-slate-500">{label}</div>
          <div className="mt-0.5 text-2xl font-bold text-slate-800">{value}</div>
        </div>
      </div>
    </Card>
  );
}

export default function Dashboard({ user }: { user: User }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    dashboardApi.summary(user).then(setData).catch(() => setData(null)).finally(() => setLoading(false));
  }, [user]);

  if (loading) return <Spinner label="กำลังโหลดแดชบอร์ด…" />;
  if (!data) return <EmptyState title="โหลดข้อมูลไม่สำเร็จ" hint="ตรวจสอบการเชื่อมต่อเซิร์ฟเวอร์และ Supabase" icon={<AlertTriangle className="h-6 w-6" />} />;

  const isStaff = ["Admin", "Manager", "Staff"].includes(user.role);

  return (
    <div>
      <div className="mb-6">
        <h1 className="m-0 text-2xl font-bold tracking-tight text-slate-800">สวัสดี, {user.name}</h1>
        <p className="mt-1 text-sm text-slate-500">ภาพรวมระบบเบิกจ่ายพัสดุ · แผนก {user.department}</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {isStaff && <Stat icon={<Package className="h-6 w-6" />} label="รายการวัสดุทั้งหมด" value={fmtNumber(data.totalItems)} accent="#5b4df6" />}
        {isStaff && <Stat icon={<Wallet className="h-6 w-6" />} label="มูลค่าคงคลังรวม (บาท)" value={fmtBaht(data.totalValue)} accent="#0ea5e9" />}
        {isStaff && <Stat icon={<AlertTriangle className="h-6 w-6" />} label="วัสดุต่ำกว่าจุดสั่งซื้อ" value={fmtNumber(data.lowStockCount)} accent="#f59e0b" />}
        <Stat icon={<ClipboardList className="h-6 w-6" />} label="ใบเบิกทั้งหมด" value={fmtNumber(data.totalRequisitions)} accent="#8b5cf6" />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat icon={<Clock className="h-6 w-6" />} label="รออนุมัติ (หัวหน้างาน)" value={fmtNumber(data.pendingManager)} accent="#f59e0b" />
        <Stat icon={<PackageCheck className="h-6 w-6" />} label="รอจ่ายพัสดุ" value={fmtNumber(data.pendingStock)} accent="#3b82f6" />
        <Stat icon={<ClipboardList className="h-6 w-6" />} label="จ่ายบางส่วน" value={fmtNumber(data.partiallyCompleted)} accent="#c026d3" />
        <Stat icon={<CheckCircle2 className="h-6 w-6" />} label="เสร็จสิ้น" value={fmtNumber(data.completed)} accent="#16a34a" />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-2">
          <h3 className="m-0 mb-4 text-sm font-bold text-slate-700">ใบเบิกล่าสุด</h3>
          {data.recentRequisitions?.length ? (
            <div className="flex flex-col divide-y divide-slate-100">
              {data.recentRequisitions.map((r: any) => {
                const s = STATUS_STYLES[r.status] || { bg: "#f1f5f9", color: "#475569" };
                return (
                  <div key={r.id} className="flex items-center justify-between py-2.5">
                    <div>
                      <div className="font-mono text-xs font-semibold text-slate-700">{r.id}</div>
                      <div className="text-xs text-slate-400">{r.requestorName} · {fmtDateTime(r.createdAt)}</div>
                    </div>
                    <Badge bg={s.bg} color={s.color}>{statusLabel(r.status)}</Badge>
                  </div>
                );
              })}
            </div>
          ) : <EmptyState title="ยังไม่มีใบเบิก" />}
        </Card>

        {isStaff && (
          <Card className="p-5">
            <h3 className="m-0 mb-4 text-sm font-bold text-slate-700">วัสดุใกล้หมด</h3>
            {data.lowStockItems?.length ? (
              <div className="flex flex-col divide-y divide-slate-100">
                {data.lowStockItems.map((i: any) => (
                  <div key={i.id} className="flex items-center justify-between py-2.5">
                    <div>
                      <div className="text-sm font-medium text-slate-700">{i.name}</div>
                      <div className="font-mono text-[11px] text-slate-400">{i.code}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-bold text-amber-600">{fmtNumber(i.quantity)}</div>
                      <div className="text-[11px] text-slate-400">ขั้นต่ำ {fmtNumber(i.minQuantity)}</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : <EmptyState title="สต๊อกอยู่ในระดับปกติ" />}
          </Card>
        )}
      </div>
    </div>
  );
}
