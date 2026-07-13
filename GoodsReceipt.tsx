import { useEffect, useState } from "react";
import { ScrollText, Search, Shield, LogIn, FilePlus2, CheckCircle2, XCircle, PackagePlus, Pencil, Trash2 } from "lucide-react";
import { auditApi } from "../lib/api";
import { fmtDateTime, todayISO } from "../lib/format";
import { Card, Button, inputClass, Spinner, EmptyState, PageHeader, useToast } from "../ui";
import type { User } from "../types";

const ACTION_META: Record<string, { label: string; icon: any; color: string; bg: string }> = {
  LOGIN: { label: "เข้าสู่ระบบ", icon: LogIn, color: "#0369a1", bg: "#e0f2fe" },
  CREATE_REQUISITION: { label: "สร้างใบเบิก", icon: FilePlus2, color: "#4338ca", bg: "#eef2ff" },
  APPROVE: { label: "อนุมัติ/จ่าย", icon: CheckCircle2, color: "#15803d", bg: "#dcfce7" },
  APPROVE_BATCH: { label: "อนุมัติเป็นชุด", icon: CheckCircle2, color: "#15803d", bg: "#dcfce7" },
  REJECT: { label: "ปฏิเสธ", icon: XCircle, color: "#b91c1c", bg: "#fee2e2" },
  REJECT_BATCH: { label: "ปฏิเสธเป็นชุด", icon: XCircle, color: "#b91c1c", bg: "#fee2e2" },
  GOODS_RECEIPT: { label: "รับเข้าคลัง", icon: PackagePlus, color: "#0d9488", bg: "#ccfbf1" },
  UPDATE_INVENTORY: { label: "แก้ไขวัสดุ", icon: Pencil, color: "#a16207", bg: "#fef9c3" },
  DELETE_INVENTORY: { label: "ลบวัสดุ", icon: Trash2, color: "#b91c1c", bg: "#fee2e2" },
};

const ACTIONS = ["-- All --", ...Object.keys(ACTION_META)];

export default function Audit({ user }: { user: User }) {
  const toast = useToast();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ action: "-- All --", actor: "", startDate: "", endDate: todayISO() });

  const load = () => {
    setLoading(true);
    auditApi.list(user, filters).then(setRows).catch((e) => toast.push({ type: "error", msg: e.message })).finally(() => setLoading(false));
  };
  useEffect(load, []);

  if (user.role !== "Admin") return <EmptyState icon={<Shield className="h-6 w-6" />} title="เฉพาะผู้ดูแลระบบ" hint="คุณไม่มีสิทธิ์เข้าถึงบันทึกการใช้งาน" />;

  return (
    <div>
      <PageHeader title="บันทึกการใช้งานระบบ (Audit Log)" subtitle="ตรวจสอบว่าใครทำอะไร เมื่อไหร่ เพื่อความโปร่งใสและตรวจสอบย้อนหลัง" />

      <Card className="mb-4 p-4">
        <div className="flex flex-wrap items-end gap-3">
          <label className="block"><span className="mb-1.5 block text-xs font-semibold text-slate-600">ประเภทการกระทำ</span>
            <select className={inputClass + " w-52"} value={filters.action} onChange={(e) => setFilters({ ...filters, action: e.target.value })}>
              {ACTIONS.map((a) => <option key={a} value={a}>{a === "-- All --" ? "ทั้งหมด" : (ACTION_META[a]?.label || a)}</option>)}
            </select>
          </label>
          <div className="relative"><span className="mb-1.5 block text-xs font-semibold text-slate-600">ผู้ใช้งาน</span>
            <input className={inputClass + " w-44"} placeholder="username" value={filters.actor} onChange={(e) => setFilters({ ...filters, actor: e.target.value })} />
          </div>
          <label className="block"><span className="mb-1.5 block text-xs font-semibold text-slate-600">จากวันที่</span><input type="date" className={inputClass + " w-40"} value={filters.startDate} onChange={(e) => setFilters({ ...filters, startDate: e.target.value })} /></label>
          <label className="block"><span className="mb-1.5 block text-xs font-semibold text-slate-600">ถึงวันที่</span><input type="date" className={inputClass + " w-40"} value={filters.endDate} onChange={(e) => setFilters({ ...filters, endDate: e.target.value })} /></label>
          <Button onClick={load}><Search className="h-4 w-4" />ค้นหา</Button>
        </div>
      </Card>

      <Card className="overflow-hidden">
        {loading ? <Spinner label="กำลังโหลด…" /> : rows.length === 0 ? (
          <EmptyState icon={<ScrollText className="h-6 w-6" />} title="ไม่พบบันทึกการใช้งาน" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-slate-100 bg-slate-50/70 text-left text-xs font-semibold text-slate-500">
                <th className="px-4 py-3">เวลา</th><th className="px-4 py-3">ผู้ใช้งาน</th><th className="px-4 py-3">การกระทำ</th><th className="px-4 py-3">รายละเอียด</th>
              </tr></thead>
              <tbody className="divide-y divide-slate-50">
                {rows.map((r) => {
                  const m = ACTION_META[r.action] || { label: r.action, icon: ScrollText, color: "#475569", bg: "#f1f5f9" };
                  const Icon = m.icon;
                  return (
                    <tr key={r.id} className="hover:bg-slate-50/50">
                      <td className="whitespace-nowrap px-4 py-3 text-slate-500">{fmtDateTime(r.timestamp)}</td>
                      <td className="px-4 py-3"><div className="font-medium text-slate-700">{r.actor_name || r.actor || "-"}</div><div className="font-mono text-[11px] text-slate-400">{r.actor || ""}{r.actor_role ? ` · ${r.actor_role}` : ""}</div></td>
                      <td className="px-4 py-3"><span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold" style={{ background: m.bg, color: m.color }}><Icon className="h-3 w-3" />{m.label}</span></td>
                      <td className="px-4 py-3 text-slate-600">{r.detail || "-"}{r.entity_id ? <span className="ml-1 font-mono text-[11px] text-slate-400">#{r.entity_id}</span> : null}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div className="border-t border-slate-100 px-4 py-2.5 text-xs text-slate-400">แสดง {rows.length} รายการล่าสุด</div>
          </div>
        )}
      </Card>
    </div>
  );
}
