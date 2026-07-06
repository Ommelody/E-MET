import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2, Search, PackagePlus, Upload } from "lucide-react";
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
