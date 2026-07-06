import { useState } from "react";
import { Boxes, AlertTriangle, ArrowLeftRight, ClipboardList, Building2, TrendingUp, PackageX, Download, FileBarChart } from "lucide-react";
import { reportsApi } from "../lib/api";
import { fmtBaht, fmtNumber, fmtDate, fmtDateTime, statusLabel, todayISO } from "../lib/format";
import { Card, Button, inputClass, Spinner, EmptyState, PageHeader, useToast } from "../ui";

type Col = { key: string; label: string; align?: "left" | "right" | "center"; fmt?: (v: any, row?: any) => string };

const REPORTS = [
  { id: "inventory", name: "สต๊อกคงคลัง", icon: Boxes, color: "#5b4df6", dated: false },
  { id: "low-stock", name: "วัสดุต่ำกว่าจุดสั่งซื้อ", icon: AlertTriangle, color: "#f59e0b", dated: false },
  { id: "transactions", name: "ความเคลื่อนไหวสต๊อก", icon: ArrowLeftRight, color: "#0ea5e9", dated: true },
  { id: "requisitions", name: "การเบิกจ่าย", icon: ClipboardList, color: "#8b5cf6", dated: true },
  { id: "by-department", name: "มูลค่าเบิกตามแผนก", icon: Building2, color: "#16a34a", dated: true },
  { id: "top-items", name: "วัสดุที่ถูกเบิกมากสุด", icon: TrendingUp, color: "#e11d48", dated: true },
  { id: "backorders", name: "รายการค้างจ่าย", icon: PackageX, color: "#c026d3", dated: false },
] as const;

const COLUMNS: Record<string, Col[]> = {
  inventory: [
    { key: "code", label: "รหัส" }, { key: "name", label: "ชื่อวัสดุ" }, { key: "category", label: "หมวดหมู่" },
    { key: "quantity", label: "คงเหลือ", align: "center", fmt: (v, r) => `${fmtNumber(v)} ${r.unit}` },
    { key: "unitPrice", label: "ราคา/หน่วย", align: "right", fmt: (v) => fmtBaht(v) },
    { key: "totalValue", label: "มูลค่ารวม", align: "right", fmt: (v) => fmtBaht(v) },
    { key: "location", label: "ที่ตั้ง" },
  ],
  "low-stock": [
    { key: "code", label: "รหัส" }, { key: "name", label: "ชื่อวัสดุ" },
    { key: "quantity", label: "คงเหลือ", align: "center", fmt: (v, r) => `${fmtNumber(v)} ${r.unit}` },
    { key: "minQuantity", label: "ขั้นต่ำ", align: "center", fmt: (v) => fmtNumber(v) },
    { key: "shortfall", label: "ขาด", align: "center", fmt: (v) => fmtNumber(v) },
    { key: "location", label: "ที่ตั้ง" },
  ],
  transactions: [
    { key: "timestamp", label: "เวลา", fmt: (v) => fmtDateTime(v) }, { key: "type", label: "ประเภท" },
    { key: "itemName", label: "วัสดุ" }, { key: "quantityChange", label: "เปลี่ยนแปลง", align: "center", fmt: (v, r) => `${v > 0 ? "+" : ""}${fmtNumber(v)} ${r.unit}` },
    { key: "newStockQuantity", label: "คงเหลือ", align: "center", fmt: (v) => fmtNumber(v) },
    { key: "referenceNo", label: "อ้างอิง" }, { key: "receivedBy", label: "โดย" },
  ],
  requisitions: [
    { key: "id", label: "เลขที่" }, { key: "date", label: "วันที่", fmt: (v) => fmtDate(v) },
    { key: "requestorName", label: "ผู้เบิก" }, { key: "requestorDepartment", label: "แผนก" },
    { key: "status", label: "สถานะ", fmt: (v) => statusLabel(v) },
  ],
  "by-department": [
    { key: "department", label: "แผนก" }, { key: "count", label: "จำนวนใบเบิก", align: "center", fmt: (v) => fmtNumber(v) },
    { key: "value", label: "มูลค่ารวม (จ่ายจริง)", align: "right", fmt: (v) => fmtBaht(v) },
  ],
  "top-items": [
    { key: "itemName", label: "วัสดุ" }, { key: "totalRequested", label: "ขอเบิกรวม", align: "center", fmt: (v, r) => `${fmtNumber(v)} ${r.unit || ""}` },
    { key: "totalDispensed", label: "จ่ายจริงรวม", align: "center", fmt: (v, r) => `${fmtNumber(v)} ${r.unit || ""}` },
    { key: "totalValue", label: "มูลค่า", align: "right", fmt: (v) => fmtBaht(v) },
  ],
  backorders: [
    { key: "requisitionId", label: "เลขที่ใบเบิก" }, { key: "requestorName", label: "ผู้เบิก" }, { key: "department", label: "แผนก" },
    { key: "itemName", label: "วัสดุ" }, { key: "requested", label: "ขอเบิก", align: "center", fmt: (v, r) => `${fmtNumber(v)} ${r.unit}` },
    { key: "dispensed", label: "จ่ายแล้ว", align: "center", fmt: (v) => fmtNumber(v) },
    { key: "outstanding", label: "ค้าง", align: "center", fmt: (v) => fmtNumber(v) },
  ],
};

export default function Reports() {
  const toast = useToast();
  const [active, setActive] = useState<string | null>(null);
  const [rows, setRows] = useState<any[]>([]);
  const [extra, setExtra] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [range, setRange] = useState({ startDate: "", endDate: todayISO() });

  const run = async (id: string) => {
    setActive(id); setLoading(true); setRows([]); setExtra(null);
    try {
      const f = { startDate: range.startDate, endDate: range.endDate };
      let res: any;
      if (id === "inventory") res = await reportsApi.inventory();
      else if (id === "low-stock") res = await reportsApi.lowStock();
      else if (id === "transactions") res = await reportsApi.transactions(f);
      else if (id === "requisitions") res = await reportsApi.requisitions(f);
      else if (id === "by-department") res = await reportsApi.byDepartment(f);
      else if (id === "top-items") res = await reportsApi.topItems(f);
      else res = await reportsApi.backorders();
      setRows(res.rows || []);
      if (res.totalValue !== undefined) setExtra({ totalValue: res.totalValue });
    } catch (e: any) { toast.push({ type: "error", msg: e.message }); }
    finally { setLoading(false); }
  };

  const exportCsv = () => {
    if (!active || rows.length === 0) return;
    const cols = COLUMNS[active];
    const header = cols.map((c) => c.label).join(",");
    const body = rows.map((r) => cols.map((c) => `"${String(c.fmt ? c.fmt(r[c.key], r) : r[c.key] ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + header + "\n" + body], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `report-${active}-${todayISO()}.csv`;
    a.click();
  };

  const meta = REPORTS.find((r) => r.id === active);
  const cols = active ? COLUMNS[active] : [];

  return (
    <div>
      <PageHeader title="รายงาน" subtitle="เลือกประเภทรายงานเพื่อดูและส่งออกข้อมูล"
        action={active && rows.length > 0 && <Button variant="outline" onClick={exportCsv}><Download className="h-4 w-4" />ส่งออก CSV</Button>} />

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
        {REPORTS.map((r) => {
          const Icon = r.icon;
          return (
            <button key={r.id} onClick={() => run(r.id)} className={`flex cursor-pointer items-center gap-3 rounded-xl border bg-white p-4 text-left transition hover:shadow-md ${active === r.id ? "border-[#5b4df6] ring-2 ring-[#5b4df6]/20" : "border-slate-200"}`}>
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg" style={{ background: r.color + "1a", color: r.color }}><Icon className="h-5 w-5" /></div>
              <span className="text-sm font-semibold text-slate-700">{r.name}</span>
            </button>
          );
        })}
      </div>

      {meta?.dated && (
        <Card className="mb-4 p-4">
          <div className="flex flex-wrap items-end gap-3">
            <label className="block"><span className="mb-1.5 block text-xs font-semibold text-slate-600">ตั้งแต่วันที่</span><input type="date" className={inputClass + " w-44"} value={range.startDate} onChange={(e) => setRange({ ...range, startDate: e.target.value })} /></label>
            <label className="block"><span className="mb-1.5 block text-xs font-semibold text-slate-600">ถึงวันที่</span><input type="date" className={inputClass + " w-44"} value={range.endDate} onChange={(e) => setRange({ ...range, endDate: e.target.value })} /></label>
            <Button onClick={() => run(active!)}>อัปเดตรายงาน</Button>
          </div>
        </Card>
      )}

      <Card className="overflow-hidden">
        {!active ? (
          <EmptyState icon={<FileBarChart className="h-6 w-6" />} title="เลือกประเภทรายงานด้านบน" hint="รายงานจะแสดงข้อมูลจากฐานข้อมูล Supabase แบบเรียลไทม์" />
        ) : loading ? <Spinner label="กำลังประมวลผลรายงาน…" /> : rows.length === 0 ? (
          <EmptyState title="ไม่มีข้อมูลในรายงานนี้" />
        ) : (
          <>
            {extra?.totalValue !== undefined && (
              <div className="flex items-center justify-between border-b border-slate-100 bg-indigo-50/50 px-5 py-3">
                <span className="text-sm font-semibold text-slate-600">มูลค่ารวมทั้งหมด</span>
                <span className="text-lg font-bold text-[#5b4df6]">{fmtBaht(extra.totalValue)} บาท</span>
              </div>
            )}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-slate-100 bg-slate-50/70 text-xs font-semibold text-slate-500">
                  {cols.map((c) => <th key={c.key} className={`px-4 py-3 ${c.align === "right" ? "text-right" : c.align === "center" ? "text-center" : "text-left"}`}>{c.label}</th>)}
                </tr></thead>
                <tbody className="divide-y divide-slate-50">
                  {rows.map((r, i) => (
                    <tr key={i} className="hover:bg-slate-50/50">
                      {cols.map((c) => <td key={c.key} className={`px-4 py-2.5 ${c.align === "right" ? "text-right" : c.align === "center" ? "text-center" : "text-left"} text-slate-600`}>{c.fmt ? c.fmt(r[c.key], r) : (r[c.key] ?? "-")}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="border-t border-slate-100 px-5 py-2.5 text-xs text-slate-400">รวม {fmtNumber(rows.length)} รายการ</div>
          </>
        )}
      </Card>
    </div>
  );
}
