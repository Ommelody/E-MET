import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, XCircle, PackageCheck, Inbox, ChevronDown, ChevronRight, Search, Lock, Loader2, ClipboardList } from "lucide-react";
import { requisitionApi } from "../lib/api";
import { fmtBaht, fmtNumber, fmtDate, statusLabel } from "../lib/format";
import { Button, Card, inputClass, Spinner, EmptyState, PageHeader, Badge, useToast } from "../ui";
import type { User } from "../types";

function firstOfMonth() { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10); }
function todayStr() { return new Date().toISOString().slice(0, 10); }

export default function Approvals({ user }: { user: User }) {
  const toast = useToast();
  const canManager = ["Admin", "Manager"].includes(user.role);

  const [level, setLevel] = useState<"manager" | "stock">(canManager ? "manager" : "stock");
  const [startDate, setStartDate] = useState(firstOfMonth());
  const [endDate, setEndDate] = useState(todayStr());
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<Set<string>>(new Set());
  // draft[reqId][itemId] = { disp, bo, note }
  const [draft, setDraft] = useState<Record<string, Record<string, any>>>({});
  const [note, setNote] = useState("");
  const [processing, setProcessing] = useState(false);

  const isStock = level === "stock";
  const isManager = level === "manager";

  const load = async () => {
    setLoading(true); setSearched(true); setSelected(new Set()); setExpanded(new Set());
    try {
      const res = await requisitionApi.batchList({ level, startDate, endDate }, user);
      const list = Array.isArray(res) ? res : [];
      setRows(list);
      const d: Record<string, Record<string, any>> = {};
      list.forEach((r: any) => {
        d[r.id] = {};
        (r.items || []).forEach((it: any) => {
          const reqQty = it.quantity || 0, stock = it.currentInventoryQuantity ?? 0;
          d[r.id][it.itemId] = {
            disp: isManager ? reqQty : Math.min(reqQty, stock),
            bo: false,
            note: it.notesForItem || "",
          };
        });
      });
      setDraft(d);
    } catch (e: any) { toast.push({ type: "error", msg: e.message }); setRows([]); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [level]);

  const toggleExpand = (id: string) => setExpanded((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleSelect = (id: string) => setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const allSelected = rows.length > 0 && selected.size === rows.length;
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(rows.map((r) => r.id)));

  const setItem = (reqId: string, itemId: string, patch: any) =>
    setDraft((d) => ({ ...d, [reqId]: { ...d[reqId], [itemId]: { ...d[reqId][itemId], ...patch } } }));

  const buildDraftItems = (r: any) =>
    (r.items || []).map((it: any) => {
      const dr = draft[r.id]?.[it.itemId] || {};
      return {
        itemId: it.itemId, itemName: it.itemName, unit: it.unit,
        dispensedQuantity: dr.disp || 0, approvedQuantity: dr.disp || 0,
        isBackordered: !!dr.bo, itemNote: (dr.note || "").trim(),
      };
    });

  const run = async (decision: "Approved" | "Rejected") => {
    if (selected.size === 0) return toast.push({ type: "error", msg: "กรุณาเลือกใบเบิกอย่างน้อย 1 ใบ" });
    if (decision === "Rejected" && !note.trim()) return toast.push({ type: "error", msg: "กรุณาระบุเหตุผลการปฏิเสธ" });
    // validate stock (เฉพาะขั้นจ่าย และรายการที่ไม่ค้างจ่าย)
    if (decision === "Approved" && isStock) {
      for (const r of rows.filter((x) => selected.has(x.id))) {
        for (const it of r.items || []) {
          const dr = draft[r.id]?.[it.itemId] || {};
          if (!dr.bo && (dr.disp || 0) > (it.currentInventoryQuantity ?? 0))
            return toast.push({ type: "error", msg: `#${r.id} "${it.itemName}" จ่ายเกินคงเหลือ` });
        }
      }
    }
    setProcessing(true);
    try {
      const customDraftItems: Record<string, any[]> = {};
      rows.filter((x) => selected.has(x.id)).forEach((r) => (customDraftItems[r.id] = buildDraftItems(r)));
      const res = await requisitionApi.batchApprove({
        requisitionIds: [...selected], approverUsername: user.username, approvalLevel: level,
        approvalDecision: decision, notes: note || (decision === "Approved" ? "อนุมัติเป็นชุด" : "ปฏิเสธเป็นชุด"),
        customDraftItems,
      });
      if (res.success) { toast.push({ type: "success", msg: `ดำเนินการ ${res.processedCount} ใบสำเร็จ` }); setNote(""); load(); }
      else toast.push({ type: "error", msg: res.message });
    } catch (e: any) { toast.push({ type: "error", msg: e.message }); }
    finally { setProcessing(false); }
  };

  return (
    <div>
      <PageHeader title="อนุมัติใบเบิก (แบบชุด)" subtitle="กรองช่วงวันที่ · คลิกบรรทัดเพื่อแตกรายการและปรับยอด · เลือกหลายใบเพื่อดำเนินการพร้อมกัน" />

      {/* Filter bar */}
      <Card className="mb-4 p-5">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-[1fr_auto_auto_auto] md:items-end">
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-slate-600">ขอบเขตสิทธิ์การตรวจสอบ</span>
            <select className={inputClass} value={level} onChange={(e) => setLevel(e.target.value as any)}>
              {canManager && <option value="manager">สิทธิ์อนุมัติผู้จัดการชั้นบริหาร (Manager Level)</option>}
              <option value="stock">สิทธิ์จ่ายพัสดุ (Stock Level)</option>
            </select>
          </label>
          <label className="block"><span className="mb-1.5 block text-xs font-semibold text-slate-600">จากวันที่ส่งเบิก</span><input type="date" className={inputClass} value={startDate} onChange={(e) => setStartDate(e.target.value)} /></label>
          <label className="block"><span className="mb-1.5 block text-xs font-semibold text-slate-600">ถึงวันที่ส่งเบิก</span><input type="date" className={inputClass} value={endDate} onChange={(e) => setEndDate(e.target.value)} /></label>
          <Button onClick={load}><Search className="h-4 w-4" />ประมวลผลค้นหาเป้าหมาย</Button>
        </div>
      </Card>

      {loading ? <Spinner label="กำลังโหลด…" /> : !searched ? (
        <Card><EmptyState icon={<ClipboardList className="h-6 w-6" />} title="เลือกเงื่อนไขแล้วกดค้นหา" /></Card>
      ) : rows.length === 0 ? (
        <Card><EmptyState icon={<Inbox className="h-6 w-6" />} title="ไม่มีใบเบิกรอดำเนินการในช่วงที่เลือก" /></Card>
      ) : (
        <Card className="overflow-hidden">
          {/* header row */}
          <div className="flex items-center gap-4 border-b border-slate-100 bg-slate-50/70 px-5 py-3 text-xs font-semibold text-slate-500">
            <input type="checkbox" checked={allSelected} onChange={toggleAll} className="h-4 w-4 cursor-pointer" />
            <span className="w-6"></span>
            <span className="flex-1">เลขที่ใบเบิก</span>
            <span className="hidden w-28 sm:block">วันที่ยื่นขอเบิก</span>
            <span className="hidden flex-1 md:block">สายผู้เบิก (แผนกงานสังกัด)</span>
            <span className="hidden w-32 lg:block">วัตถุประสงค์โดยย่อ</span>
          </div>

          <div className="divide-y divide-slate-100">
            {rows.map((r) => {
              const isOpen = expanded.has(r.id);
              return (
                <div key={r.id}>
                  <div className="flex items-center gap-4 px-5 py-4 hover:bg-slate-50/50">
                    <input type="checkbox" checked={selected.has(r.id)} onChange={() => toggleSelect(r.id)} className="h-4 w-4 cursor-pointer" />
                    <button onClick={() => toggleExpand(r.id)} className="flex w-6 cursor-pointer items-center justify-center border-none bg-transparent text-slate-400">
                      {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </button>
                    <div className="flex flex-1 cursor-pointer items-center gap-2" onClick={() => toggleExpand(r.id)}>
                      <span className="font-mono text-sm font-bold text-slate-700">{r.id}</span>
                      <Badge bg="#eef2ff" color="#4338ca">{(r.items || []).length} รายการ</Badge>
                    </div>
                    <span className="hidden w-28 text-sm text-slate-500 sm:block">{fmtDate(r.date)}</span>
                    <div className="hidden flex-1 md:block"><div className="text-sm font-medium text-slate-700">{r.requestorName}</div><div className="text-[11px] text-slate-400">{r.requestorDepartment}</div></div>
                    <span className="hidden w-32 truncate text-sm text-slate-500 lg:block" title={r.purpose}>{r.purpose || "-"}</span>
                  </div>

                  {isOpen && (
                    <div className="border-y border-indigo-100 bg-indigo-50/30 px-5 py-4">
                      <div className="mb-3 flex items-center gap-2 text-sm font-bold text-indigo-700"><PackageCheck className="h-4 w-4" />ตรวจสอบยอดจัดจ่ายรายรายการวัสดุ (ใบเบิก #{r.id})</div>
                      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
                        <table className="w-full text-xs">
                          <thead><tr className="border-b border-slate-100 text-left font-semibold text-slate-500">
                            <th className="px-3 py-2.5">รหัสพัสดุ</th><th className="px-3 py-2.5">ชื่อพัสดุ</th>
                            <th className="px-3 py-2.5 text-center">คงเหลือในคลัง</th><th className="px-3 py-2.5 text-center">จำนวนขอเบิก</th>
                            <th className="px-3 py-2.5 text-center">{isManager ? "จำนวนอนุมัติ" : "จำนวนจ่ายจริง"}</th>
                            <th className="px-3 py-2.5 text-center">ค้างจ่าย</th><th className="px-3 py-2.5">หมายเหตุรายการ</th>
                          </tr></thead>
                          <tbody className="divide-y divide-slate-50">
                            {(r.items || []).map((it: any) => {
                              const dr = draft[r.id]?.[it.itemId] || { disp: 0, bo: false, note: "" };
                              const stock = it.currentInventoryQuantity ?? 0;
                              return (
                                <tr key={it.itemId}>
                                  <td className="px-3 py-2.5 font-mono text-[11px] text-indigo-600">{it.itemCode}</td>
                                  <td className="px-3 py-2.5 text-slate-700">{it.itemName}</td>
                                  <td className="px-3 py-2.5 text-center font-semibold text-indigo-600">{fmtNumber(stock)} {it.unit}</td>
                                  <td className="px-3 py-2.5 text-center text-slate-600">{fmtNumber(it.quantity)} {it.unit}</td>
                                  <td className="px-3 py-2.5 text-center">
                                    <input type="number" min={0} disabled={dr.bo} className={inputClass + " mx-auto w-20 text-center disabled:opacity-40"} value={dr.disp}
                                      onChange={(e) => { const raw = Math.max(0, parseInt(e.target.value) || 0); setItem(r.id, it.itemId, { disp: isStock ? Math.min(raw, stock) : raw }); }} />
                                  </td>
                                  <td className="px-3 py-2.5 text-center">
                                    <label className="flex items-center justify-center gap-1 text-[11px] text-slate-500">
                                      <input type="checkbox" checked={dr.bo} onChange={(e) => { const c = e.target.checked; setItem(r.id, it.itemId, { bo: c, disp: c ? 0 : Math.min(it.quantity, stock) }); }} />
                                      ค้างจ่าย
                                    </label>
                                  </td>
                                  <td className="px-3 py-2.5"><input placeholder="ระบุข้อความ…" className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-[11px]" value={dr.note} onChange={(e) => setItem(r.id, it.itemId, { note: e.target.value })} /></td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Action bar */}
      {rows.length > 0 && (
        <Card className="sticky bottom-4 mt-4 flex flex-wrap items-center justify-between gap-3 p-4 shadow-lg">
          <div className="flex flex-1 items-center gap-3">
            <span className="text-sm font-semibold text-slate-600">เลือกแล้ว {selected.size} ใบ</span>
            <input className={inputClass + " max-w-md flex-1"} placeholder="หมายเหตุการอนุมัติ / เหตุผลการปฏิเสธ (ใช้กับทุกใบที่เลือก)" value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
          <div className="flex gap-2">
            <Button variant="danger" onClick={() => run("Rejected")} disabled={processing || selected.size === 0}><XCircle className="h-4 w-4" />ปฏิเสธ</Button>
            <Button variant="success" onClick={() => run("Approved")} disabled={processing || selected.size === 0}>
              {processing ? <Loader2 className="h-4 w-4 animate-spin" /> : isStock ? <PackageCheck className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
              {isStock ? "ยืนยันการจ่าย" : "อนุมัติ"}
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
