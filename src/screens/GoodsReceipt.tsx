import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2, Search, PackagePlus, Upload, FileSpreadsheet, Download, Save } from "lucide-react";
import * as XLSX from "xlsx";
import { inventoryApi, goodsReceiptApi } from "../lib/api";
import { fmtBaht, fmtNumber, todayISO } from "../lib/format";
import { Button, Card, Field, inputClass, Modal, EmptyState, PageHeader, useToast } from "../ui";
import type { User } from "../types";

interface Line { itemId: string; itemCode: string; itemName: string; unit: string; quantity: number; unitPrice: number; currentPrice: number; }

export default function GoodsReceipt({ user }: { user: User }) {
  const toast = useToast();
  const [items, setItems] = useState<any[]>([]);
  const [refNo, setRefNo] = useState("");
  const [date, setDate] = useState(todayISO());
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<Line[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [mode, setMode] = useState<"manual" | "excel">("manual");
  const [xlFile, setXlFile] = useState<File | null>(null);
  const [xlStatus, setXlStatus] = useState("");

  const downloadTemplate = () => {
    const ws = XLSX.utils.aoa_to_sheet([["ItemCode", "QuantityReceived", "UnitPrice"]]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template");
    XLSX.writeFile(wb, "THAMC_GoodsReceipt_Template.xlsx");
  };

  const importExcel = () => {
    if (!xlFile) return toast.push({ type: "error", msg: "กรุณาเลือกไฟล์ Excel ก่อน" });
    setSubmitting(true); setXlStatus("กำลังอ่านไฟล์…");
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const wb = XLSX.read(new Uint8Array(evt.target!.result as ArrayBuffer), { type: "array" });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json(sheet, { header: 1, blankrows: false }) as any[];
        if (json.length < 2) throw new Error("ไฟล์ไม่มีข้อมูลรายการ");
        const h = (json[0] || []).map((x: any) => (x ? x.toString().trim() : ""));
        const ci = h.indexOf("ItemCode"), qi = h.indexOf("QuantityReceived"), pi = h.indexOf("UnitPrice");
        if (ci === -1 || qi === -1) throw new Error("หัวตารางต้องมี 'ItemCode' และ 'QuantityReceived'");
        const rows: any[] = [];
        for (let i = 1; i < json.length; i++) {
          const r = json[i]; if (!r) continue;
          const code = r[ci]?.toString().trim(); const qty = parseInt(r[qi]);
          if (!code || isNaN(qty) || qty <= 0) continue;
          let price = null;
          if (pi !== -1 && r[pi] != null && r[pi].toString().trim() !== "") { const p = parseFloat(r[pi]); if (!isNaN(p) && p >= 0) price = p; }
          rows.push({ itemCode: code, quantityReceived: qty, unitPrice: price });
        }
        if (!rows.length) throw new Error("ไม่พบรายการที่นำเข้าได้");
        setXlStatus(`พบ ${rows.length} รายการ — กำลังบันทึก…`);
        const res = await goodsReceiptApi.submit({
          referenceNo: refNo || "Excel Import", receiptDate: date, notes,
          receivedByUsername: user.username, source: "Excel Import", items: rows,
        });
        if (res.success) { toast.push({ type: "success", msg: `นำเข้า ${rows.length} รายการสำเร็จ` }); setXlFile(null); setXlStatus(""); inventoryApi.list().then(setItems); }
        else setXlStatus("นำเข้าล้มเหลว: " + (res.message || "") + (res.details ? "\n" + res.details.filter((d: any) => !d.success).map((d: any) => `- ${d.itemCode}: ${d.message}`).join("\n") : ""));
      } catch (e: any) { setXlStatus("ข้อผิดพลาด: " + e.message); }
      finally { setSubmitting(false); }
    };
    reader.readAsArrayBuffer(xlFile);
  };

  useEffect(() => { inventoryApi.list().then(setItems).catch((e) => toast.push({ type: "error", msg: e.message })); }, []);

  const available = useMemo(() => {
    const chosen = new Set(lines.map((l) => l.itemId));
    const q = search.trim().toLowerCase();
    return items.filter((i) => !chosen.has(i.id) && (!q || i.name.toLowerCase().includes(q) || i.code.toLowerCase().includes(q)));
  }, [items, lines, search]);

  const addLine = (it: any) => {
    setLines((cur) => [...cur, { itemId: it.id, itemCode: it.code, itemName: it.name, unit: it.unit, quantity: 1, unitPrice: it.unitPrice, currentPrice: it.unitPrice }]);
    setPickerOpen(false); setSearch("");
  };
  const upd = (id: string, patch: Partial<Line>) => setLines((cur) => cur.map((l) => (l.itemId === id ? { ...l, ...patch } : l)));
  const removeLine = (id: string) => setLines((cur) => cur.filter((l) => l.itemId !== id));

  const totalValue = lines.reduce((s, l) => s + l.quantity * l.unitPrice, 0);

  const submit = async () => {
    if (lines.length === 0) return toast.push({ type: "error", msg: "กรุณาเพิ่มรายการวัสดุที่รับเข้าอย่างน้อย 1 รายการ" });
    if (lines.some((l) => l.quantity <= 0)) return toast.push({ type: "error", msg: "จำนวนรับเข้าต้องมากกว่า 0" });
    setSubmitting(true);
    try {
      const res = await goodsReceiptApi.submit({
        referenceNo: refNo || "Manual GRN", receiptDate: date, notes,
        receivedByUsername: user.username, source: `Manual (${user.name})`,
        items: lines.map((l) => ({ itemCode: l.itemCode, quantityReceived: l.quantity, unitPrice: l.unitPrice })),
      });
      if (res.success) { toast.push({ type: "success", msg: "รับวัสดุเข้าคลังสำเร็จ" }); setLines([]); setRefNo(""); setNotes(""); inventoryApi.list().then(setItems); }
      else toast.push({ type: "error", msg: res.message || "บางรายการล้มเหลว" });
    } catch (e: any) {
      toast.push({ type: "error", msg: e.message });
    } finally { setSubmitting(false); }
  };

  return (
    <div>
      <PageHeader title="รับวัสดุเข้าคลัง" subtitle="บันทึกการรับพัสดุเข้าสต๊อก (Goods Receipt)" />

      <div className="mb-4 inline-flex gap-1 rounded-xl bg-slate-100 p-1">
        <button onClick={() => setMode("manual")} className={`inline-flex cursor-pointer items-center gap-2 rounded-lg border-none px-4 py-2 text-sm font-semibold transition ${mode === "manual" ? "bg-white text-slate-800 shadow-sm" : "bg-transparent text-slate-500"}`}><Save className="h-4 w-4" />กรอกด้วยตนเอง</button>
        <button onClick={() => setMode("excel")} className={`inline-flex cursor-pointer items-center gap-2 rounded-lg border-none px-4 py-2 text-sm font-semibold transition ${mode === "excel" ? "bg-white text-slate-800 shadow-sm" : "bg-transparent text-slate-500"}`}><FileSpreadsheet className="h-4 w-4" />นำเข้าไฟล์ Excel</button>
      </div>

      {mode === "excel" ? (
        <Card className="mx-auto max-w-2xl p-6">
          <div className="mb-4 flex items-center justify-between border-b border-slate-100 pb-3">
            <span className="text-sm font-bold text-slate-700">ขั้นที่ 1: เตรียมไฟล์ตามเทมเพลต</span>
            <Button size="sm" variant="outline" onClick={downloadTemplate}><Download className="h-4 w-4" />โหลด Template</Button>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="เลขที่อ้างอิง"><input className={inputClass} value={refNo} onChange={(e) => setRefNo(e.target.value)} placeholder="เช่น Import-2568" /></Field>
            <Field label="วันที่รับเข้า"><input type="date" className={inputClass} value={date} onChange={(e) => setDate(e.target.value)} /></Field>
            <div className="sm:col-span-2"><Field label="หมายเหตุ"><input className={inputClass} value={notes} onChange={(e) => setNotes(e.target.value)} /></Field></div>
          </div>
          <div className="mt-4">
            <div className="relative rounded-xl border-2 border-dashed border-slate-300 p-6 text-center transition hover:border-emerald-500">
              <Upload className="mx-auto mb-2 h-7 w-7 text-slate-400" />
              <span className="block text-xs font-bold text-slate-700">{xlFile ? xlFile.name : "คลิกเลือกไฟล์ .xlsx"}</span>
              <input type="file" accept=".xlsx,.xls" onChange={(e) => setXlFile(e.target.files?.[0] || null)} className="absolute inset-0 h-full w-full cursor-pointer opacity-0" />
            </div>
          </div>
          <Button variant="success" className="mt-4 w-full" onClick={importExcel} disabled={submitting || !xlFile}><Save className="h-4 w-4" />{submitting ? "กำลังประมวลผล…" : "นำเข้าสต๊อก"}</Button>
          {xlStatus && <pre className="mt-4 max-h-48 overflow-y-auto whitespace-pre-wrap rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">{xlStatus}</pre>}
        </Card>
      ) : (
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card className="mb-4 p-5">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="เลขที่อ้างอิง / เอกสาร"><input className={inputClass} value={refNo} onChange={(e) => setRefNo(e.target.value)} placeholder="เช่น PO-2568-001" /></Field>
              <Field label="วันที่รับเข้า"><input type="date" className={inputClass} value={date} onChange={(e) => setDate(e.target.value)} /></Field>
              <div className="sm:col-span-2"><Field label="หมายเหตุ"><input className={inputClass} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="รายละเอียดเพิ่มเติม (ถ้ามี)" /></Field></div>
            </div>
          </Card>

          <Card className="overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5">
              <h3 className="m-0 text-sm font-bold text-slate-700">รายการรับเข้า ({lines.length})</h3>
              <Button size="sm" onClick={() => setPickerOpen(true)}><Plus className="h-4 w-4" />เพิ่มรายการ</Button>
            </div>
            {lines.length === 0 ? (
              <EmptyState icon={<PackagePlus className="h-6 w-6" />} title="ยังไม่มีรายการ" hint="กด 'เพิ่มรายการ' เพื่อเลือกวัสดุที่รับเข้า" />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-slate-100 bg-slate-50/70 text-left text-xs font-semibold text-slate-500">
                    <th className="px-4 py-2.5">วัสดุ</th><th className="px-4 py-2.5 text-center">จำนวนรับ</th><th className="px-4 py-2.5 text-center">ราคา/หน่วย</th><th className="px-4 py-2.5 text-right">มูลค่า</th><th></th>
                  </tr></thead>
                  <tbody className="divide-y divide-slate-50">
                    {lines.map((l) => (
                      <tr key={l.itemId}>
                        <td className="px-4 py-3"><div className="font-medium text-slate-700">{l.itemName}</div><div className="font-mono text-[11px] text-slate-400">{l.itemCode}</div></td>
                        <td className="px-4 py-3 text-center"><input type="number" min={1} className={inputClass + " mx-auto w-24 text-center"} value={l.quantity} onChange={(e) => upd(l.itemId, { quantity: parseInt(e.target.value) || 0 })} /></td>
                        <td className="px-4 py-3 text-center">
                          <input type="number" step="0.01" className={inputClass + " mx-auto w-28 text-center"} value={l.unitPrice} onChange={(e) => upd(l.itemId, { unitPrice: parseFloat(e.target.value) || 0 })} />
                          {l.unitPrice !== l.currentPrice && <div className="mt-0.5 text-[10px] text-indigo-500">จะอัปเดตราคาคลัง</div>}
                        </td>
                        <td className="px-4 py-3 text-right font-medium text-slate-700">{fmtBaht(l.quantity * l.unitPrice)}</td>
                        <td className="px-4 py-3 text-right"><button onClick={() => removeLine(l.itemId)} className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border-none bg-transparent text-slate-400 hover:bg-rose-50 hover:text-rose-600"><Trash2 className="h-4 w-4" /></button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>

        <div>
          <Card className="sticky top-6 p-5">
            <h3 className="m-0 text-sm font-bold text-slate-700">สรุปการรับเข้า</h3>
            <div className="mt-4 flex justify-between text-sm"><span className="text-slate-500">จำนวนรายการ</span><span className="font-semibold text-slate-700">{lines.length}</span></div>
            <div className="mt-2 flex justify-between text-sm"><span className="text-slate-500">จำนวนรวม (ชิ้น)</span><span className="font-semibold text-slate-700">{fmtNumber(lines.reduce((s, l) => s + l.quantity, 0))}</span></div>
            <div className="mt-3 border-t border-slate-100 pt-3 flex justify-between"><span className="font-semibold text-slate-600">มูลค่ารวม</span><span className="text-lg font-bold text-emerald-600">{fmtBaht(totalValue)}</span></div>
            <Button variant="success" className="mt-5 w-full" onClick={submit} disabled={submitting}><Upload className="h-4 w-4" />{submitting ? "กำลังบันทึก…" : "บันทึกการรับเข้า"}</Button>
          </Card>
        </div>
      </div>
      )}

      <Modal open={pickerOpen} onClose={() => setPickerOpen(false)} title="เลือกวัสดุที่รับเข้า" width="max-w-2xl">
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input autoFocus className={inputClass + " pl-9"} placeholder="ค้นหาชื่อ / รหัสวัสดุ" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="max-h-80 overflow-y-auto">
          {available.length === 0 ? <EmptyState title="ไม่พบวัสดุ" /> : (
            <div className="flex flex-col divide-y divide-slate-50">
              {available.slice(0, 50).map((it) => (
                <button key={it.id} onClick={() => addLine(it)} className="flex cursor-pointer items-center justify-between border-none bg-transparent px-2 py-3 text-left hover:bg-slate-50">
                  <div><div className="text-sm font-medium text-slate-700">{it.name}</div><div className="font-mono text-[11px] text-slate-400">{it.code}</div></div>
                  <div className="text-right text-xs text-slate-500">คงเหลือ {fmtNumber(it.quantity)} {it.unit}</div>
                </button>
              ))}
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
