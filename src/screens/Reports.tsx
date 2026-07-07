import { useEffect, useState } from "react";
import { Play, FileSpreadsheet, FolderOpen, Loader2, ChevronLeft, ChevronRight, ArrowLeftRight, TrendingUp, Building2, Zap } from "lucide-react";
import * as XLSX from "xlsx";
import { reportsApi } from "../lib/api";
import { fmtBaht, fmtDate, fmtDateTime, todayISO } from "../lib/format";
import { Card, Button, inputClass, PageHeader, useToast } from "../ui";
import type { User } from "../types";

const REPORT_TYPES = [
  { id: "approvedIssued", name: "1. ใบจ่ายพัสดุสำเร็จ (Approved & Issued)", dated: true },
  { id: "cancelledRejected", name: "2. ใบเบิกที่ถูกปฏิเสธ/ไม่อนุมัติ", dated: true },
  { id: "potentialOverStock", name: "3. ใบอนุมัติเบิกเกินยอดสต๊อกคลัง", dated: true },
  { id: "backorderedItems", name: "4. รายการค้างจ่ายตกค้าง", dated: true },
  { id: "fulfilledBackorders", name: "5. จัดจ่ายค้างจ่ายแล้ว", dated: true },
  { id: "dailyRequisition", name: "6. สรุปใบเบิกจ่ายรายวัน (Daily Log)", dated: true },
  { id: "inventoryStock", name: "7. พัสดุในคลังทั้งหมด (Stock balance)", dated: false },
];

// นิยาม header + วิธี map แต่ละ row เป็น array cell ของแต่ละรายงาน
const SPEC: Record<string, { headers: string[]; map: (r: any) => any[] }> = {
  approvedIssued: {
    headers: ["ID ใบเบิก", "วันที่เบิก", "แผนก", "ผู้ยื่นขอเบิก", "รหัสพัสดุ", "ชื่อวัสดุ", "จน.จ่ายจริง", "หน่วย", "ราคา/หน่วย", "มูลค่าจ่าย", "ผู้อนุมัติจ่าย"],
    map: (r) => [r.requisitionId, fmtDate(r.requisitionDate), r.department, r.requestorName, r.itemCode, r.itemName, r.dispensedQuantity, r.unit, fmtBaht(r.unitPrice), fmtBaht(r.totalValue), r.approvedBy],
  },
  cancelledRejected: {
    headers: ["ID ใบเบิก", "วันที่ส่งเรื่อง", "แผนก", "ผู้เบิก", "รหัสพัสดุ", "ชื่อพัสดุ", "จน.ยื่น", "หน่วย", "ผู้ไม่อนุมัติ", "ขั้นตอนปฏิเสธ"],
    map: (r) => [r.requisitionId, fmtDate(r.requisitionDate), r.department, r.requestorName, r.itemCode, r.itemName, r.requestedQuantity, r.unit, r.rejectedBy, r.status],
  },
  potentialOverStock: {
    headers: ["ID ใบเบิก", "วันที่ส่งเบิก", "แผนก", "ผู้ร้องขอ", "รหัสพัสดุ", "ชื่อพัสดุ", "จน.ต้องการ", "สต๊อกคงเหลือ", "หน่วย", "สถานะ"],
    map: (r) => [r.requisitionId, fmtDate(r.requisitionDate), r.department, r.requestorName, r.itemCode, r.itemName, r.requestedQuantity, r.currentStock, r.unit, r.status],
  },
  backorderedItems: {
    headers: ["ID ใบเบิก", "วันที่ส่งเบิก", "แผนก", "ผู้เบิก", "รหัสพัสดุ", "ชื่อพัสดุค้างจ่าย", "จน.คงค้าง", "หน่วย", "หมายเหตุ"],
    map: (r) => [r.requisitionId, fmtDate(r.requisitionDate), r.department, r.requestorName, r.itemCode, r.itemName, r.backorderedQuantity, r.unit, r.itemNote],
  },
  fulfilledBackorders: {
    headers: ["ID ใบเบิก", "วันที่จ่ายค้าง", "แผนก", "ผู้เบิก", "รหัสพัสดุ", "ชื่อพัสดุ", "จน.จ่ายค้างออก", "หน่วย", "ผู้จ่าย", "หมายเหตุ"],
    map: (r) => [r.requisitionId, fmtDateTime(r.fulfillmentDate), r.department, r.requestorName, r.itemCode, r.itemName, r.fulfilledQuantity, r.unit, r.fulfilledBy, r.itemNote],
  },
  dailyRequisition: {
    headers: ["ID ใบเบิก", "เวลาออก", "แผนก", "ผู้ยื่นเบิก", "รหัสพัสดุ", "ชื่อพัสดุ", "จน.ต้องการ", "จน.จ่ายจริง", "ค้างจ่าย?", "สถานะ"],
    map: (r) => [r.requisitionId, r.creationTime, r.department, r.requestorName, r.itemCode, r.itemName, r.requestedQuantity, r.dispensedQuantity ?? "-", r.itemIsBackordered === "Yes" ? "ติดค้างจ่าย" : "-", r.status],
  },
  inventoryStock: {
    headers: ["ID", "รหัส", "ชื่อวัสดุ", "หมวดหมู่", "ที่ตั้ง", "คงเหลือ", "หน่วย", "Min Stock", "ราคา/หน่วย", "มูลค่ารวม", "อัปเดตล่าสุด"],
    map: (r) => [r["ID"], r["รหัส"], r["ชื่อวัสดุ"], r["หมวดหมู่"], r["ที่ตั้ง"], r["คงเหลือ"], r["หน่วย"], r["Min Stock"], fmtBaht(r["ราคา/หน่วย"]), fmtBaht(r["มูลค่ารวม"]), fmtDateTime(r["อัปเดตล่าสุด"])],
  },
};

const TIME_PRESETS = [
  { label: "☀️ ทั้งวัน", s: "00:00", e: "23:59" },
  { label: "🕛 ถึงเที่ยง", s: "00:00", e: "12:00" },
  { label: "🌙 หลังเที่ยง", s: "12:00", e: "23:59" },
];

export default function Reports({ user }: { user: User }) {
  const toast = useToast();
  const [type, setType] = useState("");
  const [department, setDepartment] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState(todayISO());
  const [startTime, setStartTime] = useState("00:00");
  const [endTime, setEndTime] = useState("23:59");
  const [category, setCategory] = useState("");
  const [location, setLocation] = useState("");
  const [rows, setRows] = useState<any[]>([]);
  const [raw, setRaw] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [ran, setRan] = useState(false);
  const [page, setPage] = useState(1);
  const pageSize = 12;
  const [quick, setQuick] = useState<any>(null);

  useEffect(() => { reportsApi.quick(30).then(setQuick).catch(() => setQuick(null)); }, []);

  useEffect(() => {
    const first = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);
    setStartDate(first);
  }, []);

  const meta = REPORT_TYPES.find((r) => r.id === type);
  const spec = type ? SPEC[type] : null;

  const run = async () => {
    if (!type) return toast.push({ type: "error", msg: "กรุณาเลือกประเภทรายงาน" });
    setLoading(true); setRan(true); setRows([]); setRaw([]);
    try {
      const filters: any = type === "inventoryStock"
        ? { category, location }
        : { department, startDate, endDate, startTime, endTime };
      const data = await reportsApi.run(type, filters);
      setRaw(data || []);
      setRows((data || []).map((r) => SPEC[type].map(r)));
      setPage(1);
    } catch (e: any) { toast.push({ type: "error", msg: e.message }); }
    finally { setLoading(false); }
  };

  const exportExcel = () => {
    if (raw.length === 0) return;
    const ws = XLSX.utils.json_to_sheet(raw);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Report");
    XLSX.writeFile(wb, `THAMC_Report_${type}_${todayISO()}.xlsx`);
    toast.push({ type: "success", msg: "ส่งออก Excel สำเร็จ" });
  };

  const totalPages = Math.ceil(rows.length / pageSize);
  const paged = rows.slice((page - 1) * pageSize, page * pageSize);

  return (
    <div>
      <PageHeader title="รายงาน" subtitle="รายงานด่วนด้านบน — หรือเลือกประเภทรายงานด้านล่างเพื่อกรองเอง" />

      {/* ── รายงานด่วน ── */}
      <div className="mb-6">
        <div className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-700"><Zap className="h-4 w-4 text-amber-500" />รายงานด่วน (30 วันล่าสุด)</div>
        {!quick ? (
          <Card className="p-6"><div className="flex items-center gap-2 text-sm text-slate-400"><Loader2 className="h-4 w-4 animate-spin" />กำลังโหลด…</div></Card>
        ) : (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <Card className="p-5">
              <div className="mb-3 flex items-center gap-2 text-xs font-bold text-slate-500"><ArrowLeftRight className="h-4 w-4 text-sky-500" />การเคลื่อนไหวล่าสุด</div>
              <div className="flex flex-col divide-y divide-slate-50">
                {quick.recentMovements.length === 0 ? <div className="py-4 text-center text-xs text-slate-400">ไม่มีข้อมูล</div> : quick.recentMovements.slice(0, 6).map((m: any, i: number) => (
                  <div key={i} className="flex items-center justify-between py-2">
                    <div className="min-w-0">
                      <div className="truncate text-xs font-medium text-slate-700">{m.itemName}</div>
                      <div className="text-[10px] text-slate-400">{fmtDateTime(m.timestamp)}</div>
                    </div>
                    <span className={`ml-2 shrink-0 text-xs font-bold ${m.isReceipt ? "text-emerald-600" : "text-rose-600"}`}>{m.quantityChange > 0 ? "+" : ""}{m.quantityChange} {m.unit}</span>
                  </div>
                ))}
              </div>
            </Card>
            <Card className="p-5">
              <div className="mb-3 flex items-center gap-2 text-xs font-bold text-slate-500"><TrendingUp className="h-4 w-4 text-indigo-500" />วัสดุเบิกบ่อย</div>
              <div className="flex flex-col divide-y divide-slate-50">
                {quick.topItems.length === 0 ? <div className="py-4 text-center text-xs text-slate-400">ไม่มีข้อมูล</div> : quick.topItems.slice(0, 6).map((it: any, i: number) => (
                  <div key={i} className="flex items-center justify-between py-2">
                    <div className="flex min-w-0 items-center gap-2"><span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-[10px] font-bold text-indigo-600">{i + 1}</span><span className="truncate text-xs font-medium text-slate-700">{it.itemName}</span></div>
                    <span className="ml-2 shrink-0 text-xs font-semibold text-slate-500">{it.count} ครั้ง</span>
                  </div>
                ))}
              </div>
            </Card>
            <Card className="p-5">
              <div className="mb-3 flex items-center gap-2 text-xs font-bold text-slate-500"><Building2 className="h-4 w-4 text-emerald-500" />หน่วยงานเบิกบ่อย</div>
              <div className="flex flex-col divide-y divide-slate-50">
                {quick.topDepartments.length === 0 ? <div className="py-4 text-center text-xs text-slate-400">ไม่มีข้อมูล</div> : quick.topDepartments.slice(0, 6).map((d: any, i: number) => (
                  <div key={i} className="flex items-center justify-between py-2">
                    <div className="flex min-w-0 items-center gap-2"><span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-[10px] font-bold text-emerald-600">{i + 1}</span><span className="truncate text-xs font-medium text-slate-700">{d.department}</span></div>
                    <span className="ml-2 shrink-0 text-xs font-semibold text-slate-500">{d.count} ใบ</span>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        )}
      </div>

      <div className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-700"><FileSpreadsheet className="h-4 w-4 text-slate-500" />รายงานแบบละเอียด (เลือกประเภทและกรอง)</div>

      <Card className="mb-4 p-5">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          <label className="block lg:col-span-2">
            <span className="mb-1.5 block text-xs font-semibold text-slate-600">ประเภทรายงาน *</span>
            <select className={inputClass} value={type} onChange={(e) => { setType(e.target.value); setRows([]); setRan(false); }}>
              <option value="">-- เลือกประเภทรายงาน --</option>
              {REPORT_TYPES.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </label>

          {meta && meta.dated && (
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold text-slate-600">กรองแผนก</span>
              <input className={inputClass} placeholder="เว้นว่าง = ทุกแผนก" value={department} onChange={(e) => setDepartment(e.target.value)} />
            </label>
          )}

          {meta && !meta.dated && (
            <>
              <label className="block"><span className="mb-1.5 block text-xs font-semibold text-slate-600">หมวดหมู่</span><input className={inputClass} value={category} onChange={(e) => setCategory(e.target.value)} /></label>
              <label className="block"><span className="mb-1.5 block text-xs font-semibold text-slate-600">ที่ตั้ง</span><input className={inputClass} value={location} onChange={(e) => setLocation(e.target.value)} /></label>
            </>
          )}

          {meta && meta.dated && (
            <>
              <label className="block"><span className="mb-1.5 block text-xs font-semibold text-slate-600">จากวันที่</span><input type="date" className={inputClass} value={startDate} onChange={(e) => setStartDate(e.target.value)} /></label>
              <label className="block"><span className="mb-1.5 block text-xs font-semibold text-slate-600">ถึงวันที่</span><input type="date" className={inputClass} value={endDate} onChange={(e) => setEndDate(e.target.value)} /></label>
              <div className="md:col-span-2 lg:col-span-4 border-t border-slate-100 pt-3">
                <span className="mb-2 block text-[11px] font-bold uppercase text-slate-500">⏰ ช่วงเวลาในวัน</span>
                <div className="flex flex-wrap items-end gap-2">
                  {TIME_PRESETS.map((p) => (
                    <button key={p.label} type="button" onClick={() => { setStartTime(p.s); setEndTime(p.e); }}
                      className={`cursor-pointer rounded-full border px-3 py-1 text-xs font-semibold transition ${startTime === p.s && endTime === p.e ? "border-[#5b4df6] bg-[#5b4df6] text-white" : "border-slate-200 bg-white text-slate-600"}`}>{p.label}</button>
                  ))}
                  <input type="time" className={inputClass + " w-32"} value={startTime} onChange={(e) => setStartTime(e.target.value)} />
                  <input type="time" className={inputClass + " w-32"} value={endTime} onChange={(e) => setEndTime(e.target.value)} />
                </div>
              </div>
            </>
          )}
        </div>

        <div className="mt-4 flex justify-end gap-2 border-t border-slate-100 pt-4">
          <Button onClick={run} disabled={loading}><Play className="h-4 w-4" />{loading ? "กำลังประมวลผล…" : "สร้างรายงาน"}</Button>
          <Button variant="success" onClick={exportExcel} disabled={rows.length === 0}><FileSpreadsheet className="h-4 w-4" />Export Excel</Button>
        </div>
      </Card>

      <Card className="overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center justify-center gap-3 py-20 text-slate-400"><Loader2 className="h-7 w-7 animate-spin" />กำลังคำนวณ…</div>
        ) : !ran ? (
          <div className="flex flex-col items-center justify-center gap-3 py-20 text-slate-400"><FolderOpen className="h-8 w-8" /><span className="text-sm">เลือกเงื่อนไขแล้วกด "สร้างรายงาน"</span></div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-20 text-slate-400"><FolderOpen className="h-8 w-8" /><span className="text-sm">ไม่พบข้อมูลตามเงื่อนไข</span></div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead><tr className="border-b border-slate-100 bg-slate-50/70 text-left font-semibold text-slate-500">
                  {spec!.headers.map((h, i) => <th key={i} className="whitespace-nowrap px-3 py-3">{h}</th>)}
                </tr></thead>
                <tbody className="divide-y divide-slate-50">
                  {paged.map((cells, ri) => (
                    <tr key={ri} className="hover:bg-slate-50/50">
                      {cells.map((c: any, ci: number) => <td key={ci} className="max-w-[200px] truncate px-3 py-2.5 text-slate-600" title={String(c)}>{c}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-xs text-slate-500">
              <span>รวม {rows.length} รายการ</span>
              <div className="flex items-center gap-2">
                <span>หน้า {page}/{totalPages || 1}</span>
                <button disabled={page === 1} onClick={() => setPage(page - 1)} className="rounded-lg border border-slate-200 p-1.5 disabled:opacity-40"><ChevronLeft className="h-4 w-4" /></button>
                <button disabled={page >= totalPages} onClick={() => setPage(page + 1)} className="rounded-lg border border-slate-200 p-1.5 disabled:opacity-40"><ChevronRight className="h-4 w-4" /></button>
              </div>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
