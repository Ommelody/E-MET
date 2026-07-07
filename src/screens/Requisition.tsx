import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2, Search, Send, ShoppingCart, ImageOff, CheckCircle2 } from "lucide-react";
import { inventoryApi, requisitionApi } from "../lib/api";
import { fmtBaht, fmtNumber, todayISO } from "../lib/format";
import { Button, Card, Field, inputClass, Modal, EmptyState, PageHeader, useToast } from "../ui";
import type { User } from "../types";

interface Line { itemId: string; itemName: string; unit: string; quantity: number; unitPrice: number; available: number; }

export default function Requisition({ user, onDone }: { user: User; onDone: () => void }) {
  const toast = useToast();
  const [items, setItems] = useState<any[]>([]);
  const [date, setDate] = useState(todayISO());
  const [purpose, setPurpose] = useState("");
  const [lines, setLines] = useState<Line[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [successId, setSuccessId] = useState<string | null>(null);

  useEffect(() => { inventoryApi.list().then(setItems).catch((e) => toast.push({ type: "error", msg: e.message })); }, []);

  const available = useMemo(() => {
    const chosen = new Set(lines.map((l) => l.itemId));
    const q = search.trim().toLowerCase();
    return items.filter((i) => !chosen.has(i.id) && (!q || i.name.toLowerCase().includes(q) || i.code.toLowerCase().includes(q)));
  }, [items, lines, search]);

  const addLine = (it: any) => {
    setLines((cur) => [...cur, { itemId: it.id, itemName: it.name, unit: it.unit, quantity: 1, unitPrice: it.unitPrice, available: it.quantity }]);
    setPickerOpen(false);
    setSearch("");
  };
  const setQty = (id: string, q: number) => setLines((cur) => cur.map((l) => (l.itemId === id ? { ...l, quantity: Math.max(1, q) } : l)));
  const removeLine = (id: string) => setLines((cur) => cur.filter((l) => l.itemId !== id));

  const total = lines.reduce((s, l) => s + l.quantity * l.unitPrice, 0);

  const submit = async () => {
    if (!purpose.trim()) return toast.push({ type: "error", msg: "กรุณาระบุวัตถุประสงค์การเบิก" });
    if (lines.length === 0) return toast.push({ type: "error", msg: "กรุณาเพิ่มรายการวัสดุอย่างน้อย 1 รายการ" });
    setSubmitting(true);
    try {
      const res = await requisitionApi.create(
        { date, purpose, requestedBy: user.username, requestorName: user.name, requestorDepartment: user.department },
        lines.map((l) => ({ itemId: l.itemId, itemName: l.itemName, quantity: l.quantity, unit: l.unit }))
      );
      setLines([]); setPurpose("");
      setSuccessId(res.requisitionId || "-");
    } catch (e: any) {
      toast.push({ type: "error", msg: e.message });
    } finally { setSubmitting(false); }
  };

  return (
    <div>
      <PageHeader title="สร้างใบเบิกวัสดุ" subtitle="เลือกวัสดุและระบุจำนวนที่ต้องการเบิก" />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card className="mb-4 p-5">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="วันที่เบิก"><input type="date" className={inputClass} value={date} onChange={(e) => setDate(e.target.value)} /></Field>
              <Field label="ผู้เบิก"><input className={inputClass + " bg-slate-100"} value={`${user.name} · ${user.department}`} disabled /></Field>
              <div className="sm:col-span-2">
                <Field label="วัตถุประสงค์ *"><textarea className={inputClass} rows={2} value={purpose} onChange={(e) => setPurpose(e.target.value)} placeholder="ระบุเหตุผล/งานที่ต้องใช้วัสดุ" /></Field>
              </div>
            </div>
          </Card>

          <Card className="overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5">
              <h3 className="m-0 text-sm font-bold text-slate-700">รายการวัสดุ ({lines.length})</h3>
              <Button size="sm" onClick={() => setPickerOpen(true)}><Plus className="h-4 w-4" />เพิ่มรายการ</Button>
            </div>
            {lines.length === 0 ? (
              <EmptyState icon={<ShoppingCart className="h-6 w-6" />} title="ยังไม่มีรายการ" hint="กด 'เพิ่มรายการ' เพื่อเลือกวัสดุ" />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/70 text-left text-xs font-semibold text-slate-500">
                      <th className="px-4 py-2.5">วัสดุ</th>
                      <th className="px-4 py-2.5 text-center">คงเหลือ</th>
                      <th className="px-4 py-2.5 text-center">จำนวนเบิก</th>
                      <th className="px-4 py-2.5 text-right">มูลค่า</th>
                      <th className="px-4 py-2.5"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {lines.map((l) => (
                      <tr key={l.itemId}>
                        <td className="px-4 py-3"><div className="font-medium text-slate-700">{l.itemName}</div><div className="text-[11px] text-slate-400">{fmtBaht(l.unitPrice)}/{l.unit}</div></td>
                        <td className="px-4 py-3 text-center text-slate-500">{fmtNumber(l.available)} {l.unit}</td>
                        <td className="px-4 py-3 text-center">
                          <input type="number" min={1} className={inputClass + " mx-auto w-20 text-center"} value={l.quantity} onChange={(e) => setQty(l.itemId, parseInt(e.target.value) || 1)} />
                          {l.quantity > l.available && <div className="mt-0.5 text-[10px] text-amber-500">เกินคงเหลือ (จะค้างจ่าย)</div>}
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
            <h3 className="m-0 text-sm font-bold text-slate-700">สรุปใบเบิก</h3>
            <div className="mt-4 flex justify-between text-sm"><span className="text-slate-500">จำนวนรายการ</span><span className="font-semibold text-slate-700">{lines.length}</span></div>
            <div className="mt-2 flex justify-between text-sm"><span className="text-slate-500">จำนวนรวม (ชิ้น)</span><span className="font-semibold text-slate-700">{fmtNumber(lines.reduce((s, l) => s + l.quantity, 0))}</span></div>
            <div className="mt-3 border-t border-slate-100 pt-3 flex justify-between"><span className="font-semibold text-slate-600">มูลค่ารวมโดยประมาณ</span><span className="text-lg font-bold text-[#5b4df6]">{fmtBaht(total)}</span></div>
            <Button className="mt-5 w-full" onClick={submit} disabled={submitting}><Send className="h-4 w-4" />{submitting ? "กำลังส่ง…" : "ส่งใบเบิก"}</Button>
            <p className="mt-3 text-center text-[11px] text-slate-400">ใบเบิกจะเข้าสู่ขั้นตอนอนุมัติโดยหัวหน้างานก่อน</p>
          </Card>
        </div>
      </div>

      <Modal open={pickerOpen} onClose={() => setPickerOpen(false)} title="เลือกวัสดุ" width="max-w-2xl">
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input autoFocus className={inputClass + " pl-9"} placeholder="ค้นหาชื่อ / รหัสวัสดุ" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="max-h-80 overflow-y-auto">
          {available.length === 0 ? <EmptyState title="ไม่พบวัสดุ" /> : (
            <div className="flex flex-col divide-y divide-slate-50">
              {available.slice(0, 50).map((it) => (
                <button key={it.id} onClick={() => addLine(it)} className="flex cursor-pointer items-center justify-between border-none bg-transparent px-2 py-3 text-left hover:bg-slate-50">
                  <div className="flex items-center gap-3">
                    {it.imageUrl ? (
                      <img src={it.imageUrl} alt="" onClick={(e) => { e.stopPropagation(); setLightbox(it.imageUrl); }} className="h-11 w-11 shrink-0 cursor-zoom-in rounded-lg border border-slate-200 object-cover transition hover:scale-105" />
                    ) : (
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-300"><ImageOff className="h-4 w-4" /></div>
                    )}
                    <div><div className="text-sm font-medium text-slate-700">{it.name}</div><div className="font-mono text-[11px] text-slate-400">{it.code} · {it.location || "ไม่ระบุที่ตั้ง"}</div></div>
                  </div>
                  <div className="text-right"><div className="text-xs text-slate-500">คงเหลือ {fmtNumber(it.quantity)} {it.unit}</div><div className="text-[11px] text-slate-400">{fmtBaht(it.unitPrice)}/{it.unit}</div></div>
                </button>
              ))}
            </div>
          )}
        </div>
      </Modal>

      {lightbox && (
        <div onClick={() => setLightbox(null)} className="fixed inset-0 z-[70] flex items-center justify-center bg-black/90 p-4 backdrop-blur-sm">
          <button onClick={() => setLightbox(null)} className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/20 text-white hover:bg-white/40">✕</button>
          <img src={lightbox} alt="" className="max-h-[85vh] max-w-full rounded-lg object-contain shadow-2xl" />
        </div>
      )}

      {successId && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl bg-white p-7 text-center shadow-2xl">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600"><CheckCircle2 className="h-9 w-9" /></div>
            <h3 className="mt-4 text-lg font-bold text-slate-800">ส่งคำขอสำเร็จ!</h3>
            <p className="mt-1 text-sm text-slate-500">ระบบสร้างใบเบิกเลขที่</p>
            <div className="my-3 rounded-xl bg-indigo-50 py-3 font-mono text-xl font-bold text-[#5b4df6]">{successId}</div>
            <p className="text-xs text-slate-400">ใบเบิกเข้าสู่ขั้นตอนอนุมัติโดยหัวหน้างานก่อน</p>
            <div className="mt-5 flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setSuccessId(null)}>สร้างใบใหม่</Button>
              <Button className="flex-1" onClick={() => { setSuccessId(null); onDone(); }}>ดูประวัติ</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
