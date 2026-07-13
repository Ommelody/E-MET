import { useEffect, useState } from "react";
import { FileSpreadsheet, Play, Loader2, FolderOpen, PackageCheck } from "lucide-react";
import * as XLSX from "xlsx";
import { reportsApi } from "../lib/api";
import { fmtBaht, fmtNumber, todayISO } from "../lib/format";
import { Card, Button, inputClass, PageHeader, useToast } from "../ui";

// ลำดับคอลัมน์ตรงกับเทมเพลต SAP (A–N)
const SAP_COLS = [
  "Item No.", "Item Description", "Bar Code", "Vendor Catalog No.", "Quantity",
  "UoM Code", "UoM Name", "Info Price", "Total", "Whse",
  "Inventory Offset - Decrease Account", "Project", "Business Type", "Department",
];

export default function GoodIssueSAP() {
  const toast = useToast();
  const [categories, setCategories] = useState<string[]>([]);
  const [category, setCategory] = useState("-- ทั้งหมด --");
  const [startDate, setStartDate] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState(todayISO());
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [ran, setRan] = useState(false);

  useEffect(() => { reportsApi.categories().then(setCategories).catch(() => setCategories([])); }, []);

  const run = async () => {
    setLoading(true); setRan(true);
    try {
      const res = await reportsApi.goodIssueSAP({ category, startDate, endDate });
      setRows(res.rows || []);
    } catch (e: any) { toast.push({ type: "error", msg: e.message }); }
    finally { setLoading(false); }
  };

  const exportExcel = () => {
    if (rows.length === 0) return toast.push({ type: "error", msg: "ไม่มีข้อมูลให้ส่งออก" });
    // สร้าง rows เรียงคอลัมน์ตรงเทมเพลต (ตัด field ภายในที่ขึ้นต้นด้วย _ ออก)
    const clean = rows.map((r) => {
      const o: any = {};
      SAP_COLS.forEach((c) => (o[c] = r[c] ?? ""));
      return o;
    });
    const ws = XLSX.utils.json_to_sheet(clean, { header: SAP_COLS });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
    XLSX.writeFile(wb, `GoodIssue_SAP_${todayISO()}.xlsx`);
    toast.push({ type: "success", msg: "ส่งออกไฟล์ SAP สำเร็จ" });
  };

  const totalQty = rows.reduce((s, r) => s + (r["Quantity"] || 0), 0);
  const totalValue = rows.reduce((s, r) => s + (r["Total"] || 0), 0);

  return (
    <div>
      <PageHeader title="Good Issue SAP" subtitle="สรุปเฉพาะรายการที่จ่ายออก ตามหมวดวัสดุ — ส่งออกไฟล์ตามรูปแบบ SAP (คลัง 17OSS)" />

      <Card className="mb-4 p-5">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-[1fr_auto_auto_auto] md:items-end">
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-slate-600">หมวดวัสดุ</span>
            <select className={inputClass} value={category} onChange={(e) => setCategory(e.target.value)}>
              <option>-- ทั้งหมด --</option>
              {categories.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
          <label className="block"><span className="mb-1.5 block text-xs font-semibold text-slate-600">จากวันที่จ่าย</span><input type="date" className={inputClass} value={startDate} onChange={(e) => setStartDate(e.target.value)} /></label>
          <label className="block"><span className="mb-1.5 block text-xs font-semibold text-slate-600">ถึงวันที่จ่าย</span><input type="date" className={inputClass} value={endDate} onChange={(e) => setEndDate(e.target.value)} /></label>
          <Button onClick={run} disabled={loading}><Play className="h-4 w-4" />{loading ? "กำลังประมวลผล…" : "สร้างรายงาน"}</Button>
        </div>
        <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-4">
          <div className="flex gap-5 text-xs">
            <span className="text-slate-500">จำนวนรายการ <b className="text-slate-700">{fmtNumber(rows.length)}</b></span>
            <span className="text-slate-500">จำนวนจ่ายรวม <b className="text-indigo-600">{fmtNumber(totalQty)}</b></span>
            <span className="text-slate-500">มูลค่ารวม <b className="text-emerald-600">{fmtBaht(totalValue)}</b></span>
          </div>
          <Button variant="success" onClick={exportExcel} disabled={rows.length === 0}><FileSpreadsheet className="h-4 w-4" />Export SAP (.xlsx)</Button>
        </div>
      </Card>

      <Card className="overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center justify-center gap-3 py-20 text-slate-400"><Loader2 className="h-7 w-7 animate-spin" />กำลังคำนวณ…</div>
        ) : !ran ? (
          <div className="flex flex-col items-center justify-center gap-3 py-20 text-slate-400"><PackageCheck className="h-8 w-8" /><span className="text-sm">เลือกหมวดและช่วงวันที่ แล้วกด "สร้างรายงาน"</span></div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-20 text-slate-400"><FolderOpen className="h-8 w-8" /><span className="text-sm">ไม่พบรายการจ่ายออกตามเงื่อนไข</span></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead><tr className="border-b border-slate-100 bg-slate-50/70 text-left font-semibold text-slate-500">
                <th className="px-3 py-3">Item No.</th><th className="px-3 py-3">Item Description</th>
                <th className="px-3 py-3 text-center">Quantity</th><th className="px-3 py-3">UoM</th>
                <th className="px-3 py-3 text-right">Info Price</th><th className="px-3 py-3 text-right">Total</th>
                <th className="px-3 py-3 text-center">Whse</th><th className="px-3 py-3 text-center">Business Type</th><th className="px-3 py-3 text-center">Department</th>
              </tr></thead>
              <tbody className="divide-y divide-slate-50">
                {rows.map((r, i) => (
                  <tr key={i} className="hover:bg-slate-50/50">
                    <td className="px-3 py-2.5 font-mono text-indigo-600">{r["Item No."]}</td>
                    <td className="px-3 py-2.5 text-slate-700">{r["Item Description"]}</td>
                    <td className="px-3 py-2.5 text-center font-semibold text-slate-700">{fmtNumber(r["Quantity"])}</td>
                    <td className="px-3 py-2.5 text-slate-500">{r["UoM Code"]}</td>
                    <td className="px-3 py-2.5 text-right text-slate-600">{fmtBaht(r["Info Price"])}</td>
                    <td className="px-3 py-2.5 text-right font-medium text-slate-700">{fmtBaht(r["Total"])}</td>
                    <td className="px-3 py-2.5 text-center text-slate-500">{r["Whse"]}</td>
                    <td className="px-3 py-2.5 text-center font-mono text-slate-600">{r["Business Type"]}</td>
                    <td className="px-3 py-2.5 text-center font-mono text-slate-600">{r["Department"]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="border-t border-slate-100 px-4 py-2.5 text-xs text-slate-400">รวม {fmtNumber(rows.length)} รายการ · คอลัมน์ที่ส่งออกครบตามเทมเพลต SAP (A–N)</div>
          </div>
        )}
      </Card>
    </div>
  );
}
