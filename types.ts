import { useEffect, useState } from "react";
import { ShoppingCart, AlertTriangle, Settings2, FileSpreadsheet, Info, RefreshCw, Loader2 } from "lucide-react";
import * as XLSX from "xlsx";
import { purchasingApi, reportsApi } from "../lib/api";
import { fmtBaht, fmtNumber, todayISO } from "../lib/format";
import { Card, Button, inputClass, Spinner, EmptyState, PageHeader, Badge, Modal, Field, useToast } from "../ui";
import type { User } from "../types";

export default function Purchasing({ user }: { user: User }) {
  const toast = useToast();
  const canEdit = ["Admin", "Manager", "Staff"].includes(user.role);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState<string[]>([]);
  const [showManual, setShowManual] = useState(false);
  const [editItem, setEditItem] = useState<any | null>(null);
  const [editForm, setEditForm] = useState({ leadTimeDays: "", safetyStock: "", avgDailyUsage: "" });

  const [p, setP] = useState({ lookbackDays: "90", leadTimeDays: "7", safetyDays: "7", reviewDays: "30", category: "", onlyNeeded: "1" });

  useEffect(() => { reportsApi.categories().then(setCategories).catch(() => setCategories([])); }, []);

  const run = async () => {
    setLoading(true);
    try { setData(await purchasingApi.reorder(p)); }
    catch (e: any) { toast.push({ type: "error", msg: e.message }); }
    finally { setLoading(false); }
  };
  useEffect(() => { run(); /* eslint-disable-next-line */ }, []);

  const openEdit = (row: any) => {
    setEditItem(row);
    setEditForm({
      leadTimeDays: row.leadTimeDays != null ? String(row.leadTimeDays) : "",
      safetyStock: row.safetyStock != null ? String(row.safetyStock) : "",
      avgDailyUsage: "",
    });
  };
  const saveEdit = async () => {
    try {
      await purchasingApi.saveSettings(editItem.id, editForm);
      toast.push({ type: "success", msg: "บันทึกค่าพารามิเตอร์แล้ว" });
      setEditItem(null); run();
    } catch (e: any) { toast.push({ type: "error", msg: e.message }); }
  };

  const exportExcel = () => {
    if (!data?.rows?.length) return toast.push({ type: "error", msg: "ไม่มีข้อมูล" });
    const rows = data.rows.map((r: any) => ({
      "รหัสพัสดุ": r.code, "ชื่อวัสดุ": r.name, "หมวดหมู่": r.category, "ที่ตั้ง": r.location,
      "คงเหลือ": r.currentStock, "หน่วย": r.unit, "อัตราใช้/วัน": r.avgDailyUsage,
      "Lead time (วัน)": r.leadTimeDays, "Safety stock": r.safetyStock, "จุดสั่งซื้อ (ROP)": r.reorderPoint,
      "ปริมาณแนะนำสั่ง": r.suggestedQty, "ราคา/หน่วย": r.unitPrice, "มูลค่าประมาณ": r.estimatedCost,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "PurchaseSuggestion");
    XLSX.writeFile(wb, `THAMC_PurchaseSuggestion_${todayISO()}.xlsx`);
    toast.push({ type: "success", msg: "ส่งออกใบขอซื้อสำเร็จ" });
  };

  return (
    <div>
      <PageHeader title="จุดสั่งซื้ออัตโนมัติ" subtitle="คำนวณจุดสั่งซื้อจากอัตราการใช้จริง พร้อมแนะนำปริมาณสั่งและมูลค่า"
        action={<div className="flex gap-2"><Button variant="outline" onClick={() => setShowManual(true)}><Info className="h-4 w-4" />คู่มือ & สูตร</Button><Button variant="success" onClick={exportExcel}><FileSpreadsheet className="h-4 w-4" />ออกใบขอซื้อ (Excel)</Button></div>} />

      {/* พารามิเตอร์ที่ผู้ใช้ปรับได้ */}
      <Card className="mb-4 p-5">
        <div className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-700"><Settings2 className="h-4 w-4 text-[#5b4df6]" />พารามิเตอร์การคำนวณ (ปรับได้)</div>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
          <Field label="ย้อนหลังคำนวณ (วัน)"><input type="number" className={inputClass} value={p.lookbackDays} onChange={(e) => setP({ ...p, lookbackDays: e.target.value })} /></Field>
          <Field label="รอของ Lead time (วัน)"><input type="number" className={inputClass} value={p.leadTimeDays} onChange={(e) => setP({ ...p, leadTimeDays: e.target.value })} /></Field>
          <Field label="วันสำรอง Safety (วัน)"><input type="number" className={inputClass} value={p.safetyDays} onChange={(e) => setP({ ...p, safetyDays: e.target.value })} /></Field>
          <Field label="รอบสั่งซื้อ (วัน)"><input type="number" className={inputClass} value={p.reviewDays} onChange={(e) => setP({ ...p, reviewDays: e.target.value })} /></Field>
          <Field label="หมวดหมู่"><select className={inputClass} value={p.category} onChange={(e) => setP({ ...p, category: e.target.value })}><option value="">ทั้งหมด</option>{categories.map((c) => <option key={c} value={c}>{c}</option>)}</select></Field>
          <Field label="แสดงผล"><select className={inputClass} value={p.onlyNeeded} onChange={(e) => setP({ ...p, onlyNeeded: e.target.value })}><option value="1">เฉพาะที่ต้องสั่งซื้อ</option><option value="0">ทุกรายการ</option></select></Field>
        </div>
        <div className="mt-4 flex justify-end"><Button onClick={run} disabled={loading}>{loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}คำนวณใหม่</Button></div>
      </Card>

      {/* สรุป */}
      {data && (
        <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Card className="flex items-center gap-4 p-5"><div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-100 text-amber-600"><AlertTriangle className="h-6 w-6" /></div><div><div className="text-xs text-slate-500">ต้องสั่งซื้อ</div><div className="text-2xl font-bold text-slate-800">{fmtNumber(data.needCount)} <span className="text-sm font-normal text-slate-400">รายการ</span></div></div></Card>
          <Card className="flex items-center gap-4 p-5"><div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-100 text-indigo-600"><ShoppingCart className="h-6 w-6" /></div><div><div className="text-xs text-slate-500">มูลค่าจัดซื้อโดยประมาณ</div><div className="text-2xl font-bold text-slate-800">{fmtBaht(data.totalEstimatedCost)}</div></div></Card>
          <Card className="flex items-center gap-4 p-5"><div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-slate-600"><FileSpreadsheet className="h-6 w-6" /></div><div><div className="text-xs text-slate-500">ตรวจสอบทั้งหมด</div><div className="text-2xl font-bold text-slate-800">{fmtNumber(data.totalItems)} <span className="text-sm font-normal text-slate-400">รายการ</span></div></div></Card>
        </div>
      )}

      <Card className="overflow-hidden">
        {loading ? <Spinner label="กำลังคำนวณ…" /> : !data?.rows?.length ? (
          <EmptyState icon={<ShoppingCart className="h-6 w-6" />} title="ไม่มีรายการที่ต้องสั่งซื้อ" hint="สต๊อกทุกรายการยังสูงกว่าจุดสั่งซื้อ" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-slate-100 bg-slate-50/70 text-left text-xs font-semibold text-slate-500">
                <th className="px-4 py-3">วัสดุ</th><th className="px-4 py-3 text-center">คงเหลือ</th><th className="px-4 py-3 text-center">ใช้/วัน</th>
                <th className="px-4 py-3 text-center">จุดสั่งซื้อ</th><th className="px-4 py-3 text-center">แนะนำสั่ง</th><th className="px-4 py-3 text-right">มูลค่าประมาณ</th>
                <th className="px-4 py-3 text-center">สถานะ</th>{canEdit && <th className="px-4 py-3"></th>}
              </tr></thead>
              <tbody className="divide-y divide-slate-50">
                {data.rows.map((r: any) => (
                  <tr key={r.id} className={`hover:bg-slate-50/50 ${r.needToOrder ? "bg-amber-50/30" : ""}`}>
                    <td className="px-4 py-3"><div className="font-medium text-slate-700">{r.name}</div><div className="font-mono text-[11px] text-slate-400">{r.code} · {r.location}</div></td>
                    <td className="px-4 py-3 text-center"><span className={r.needToOrder ? "font-bold text-amber-600" : "text-slate-600"}>{fmtNumber(r.currentStock)}</span> <span className="text-slate-400">{r.unit}</span></td>
                    <td className="px-4 py-3 text-center text-slate-500">{r.avgDailyUsage}</td>
                    <td className="px-4 py-3 text-center text-slate-600">{fmtNumber(r.reorderPoint)}</td>
                    <td className="px-4 py-3 text-center font-bold text-indigo-600">{r.needToOrder ? fmtNumber(r.suggestedQty) : "-"}</td>
                    <td className="px-4 py-3 text-right text-slate-700">{r.needToOrder ? fmtBaht(r.estimatedCost) : "-"}</td>
                    <td className="px-4 py-3 text-center">{r.needToOrder ? <Badge bg="#fef3c7" color="#b45309">ต้องสั่งซื้อ</Badge> : <Badge bg="#dcfce7" color="#15803d">เพียงพอ</Badge>}</td>
                    {canEdit && <td className="px-4 py-3 text-right"><button onClick={() => openEdit(r)} className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border-none bg-transparent text-slate-400 hover:bg-indigo-50 hover:text-indigo-600" title="ตั้งค่ารายวัสดุ"><Settings2 className="h-4 w-4" /></button></td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* ตั้งค่ารายวัสดุ */}
      <Modal open={!!editItem} onClose={() => setEditItem(null)} title={`ตั้งค่าจุดสั่งซื้อ: ${editItem?.name || ""}`}>
        <p className="mb-4 text-xs text-slate-500">เว้นว่างเพื่อให้ระบบใช้ค่าเริ่มต้น/คำนวณจากประวัติจริงให้อัตโนมัติ</p>
        <div className="flex flex-col gap-4">
          <Field label="ระยะเวลารอของ Lead time (วัน)"><input type="number" className={inputClass} value={editForm.leadTimeDays} onChange={(e) => setEditForm({ ...editForm, leadTimeDays: e.target.value })} placeholder="ใช้ค่าเริ่มต้น" /></Field>
          <Field label="สต๊อกสำรอง Safety stock (หน่วย)"><input type="number" className={inputClass} value={editForm.safetyStock} onChange={(e) => setEditForm({ ...editForm, safetyStock: e.target.value })} placeholder="คำนวณจากวันสำรอง" /></Field>
          <Field label="กำหนดอัตราใช้/วันเอง (หน่วย)"><input type="number" step="0.01" className={inputClass} value={editForm.avgDailyUsage} onChange={(e) => setEditForm({ ...editForm, avgDailyUsage: e.target.value })} placeholder="คำนวณจากประวัติจ่ายจริง" /></Field>
        </div>
        <div className="mt-6 flex justify-end gap-2"><Button variant="outline" onClick={() => setEditItem(null)}>ยกเลิก</Button><Button onClick={saveEdit}>บันทึก</Button></div>
      </Modal>

      {/* คู่มือ & สูตร */}
      <Modal open={showManual} onClose={() => setShowManual(false)} title="คู่มือและสูตรคำนวณจุดสั่งซื้อ" width="max-w-2xl">
        <div className="space-y-4 text-sm text-slate-600">
          <div>
            <div className="mb-1 font-bold text-slate-700">แนวคิด</div>
            <p className="leading-relaxed">ระบบคำนวณ "จุดสั่งซื้อ (Reorder Point)" จากอัตราการใช้จริงย้อนหลัง เมื่อสต๊อกคงเหลือ ≤ จุดสั่งซื้อ ระบบจะแนะนำให้สั่งซื้อ พร้อมคำนวณปริมาณและมูลค่า</p>
          </div>
          <div className="rounded-xl bg-slate-50 p-4 font-mono text-xs leading-relaxed text-slate-700">
            อัตราใช้เฉลี่ย/วัน (ADU) = ยอดจ่ายจริงในช่วงที่ดู ÷ จำนวนวัน<br />
            จุดสั่งซื้อ (ROP) = (ADU × Lead time) + Safety stock<br />
            ระดับเติมเป้าหมาย = ROP + (ADU × รอบสั่งซื้อ)<br />
            ปริมาณแนะนำสั่ง = ระดับเติมเป้าหมาย − คงเหลือปัจจุบัน
          </div>
          <div>
            <div className="mb-1 font-bold text-slate-700">พารามิเตอร์ (ปรับได้)</div>
            <ul className="list-disc space-y-1 pl-5">
              <li><b>ย้อนหลังคำนวณ</b> — ช่วงเวลาที่ใช้หาอัตราการใช้เฉลี่ย (ยิ่งยาว ยิ่งนิ่ง)</li>
              <li><b>Lead time</b> — ระยะเวลาตั้งแต่สั่งจนของถึง</li>
              <li><b>วันสำรอง (Safety)</b> — เผื่อความไม่แน่นอน กันของขาด</li>
              <li><b>รอบสั่งซื้อ</b> — ความถี่ที่ทบทวนการสั่ง (เช่น 30 วัน = สั่งเดือนละครั้ง)</li>
            </ul>
          </div>
          <div>
            <div className="mb-1 font-bold text-slate-700">ขั้นตอนใช้งาน</div>
            <ol className="list-decimal space-y-1 pl-5">
              <li>ปรับพารามิเตอร์ให้เหมาะกับหน่วยงาน แล้วกด "คำนวณใหม่"</li>
              <li>ดูรายการที่ขึ้นสถานะ "ต้องสั่งซื้อ" (แถบสีเหลือง)</li>
              <li>ปรับค่ารายวัสดุเฉพาะตัวได้ที่ไอคอนตั้งค่า (เช่นของที่ Lead time ต่างจากปกติ)</li>
              <li>กด "ออกใบขอซื้อ (Excel)" เพื่อดึงรายการไปดำเนินการจัดซื้อ</li>
            </ol>
          </div>
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-700">
            <b>ตัวอย่าง:</b> วัสดุใช้เฉลี่ย 5 ชิ้น/วัน · Lead time 7 วัน · สำรอง 7 วัน → ROP = (5×7)+(5×7) = 70 ชิ้น เมื่อคงเหลือ ≤ 70 ควรสั่งซื้อ
          </div>
        </div>
      </Modal>
    </div>
  );
}
