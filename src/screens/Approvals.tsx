import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, XCircle, PackageCheck, Inbox, ClipboardCheck, Lock, Loader2 } from "lucide-react";
import { requisitionApi } from "../lib/api";
import { fmtBaht, fmtNumber, fmtDate, fmtDateTime, statusLabel, STATUS_STYLES } from "../lib/format";
import { Button, Card, inputClass, Modal, Spinner, EmptyState, PageHeader, Badge, useToast } from "../ui";
import type { User } from "../types";

const levelOf = (status: string) =>
  status === "Pending Manager Approval" ? "manager"
  : status === "Pending Stock Approval" ? "stock"
  : status === "Partially Completed" ? "fulfill_backorder" : "";

export default function Approvals({ user }: { user: User }) {
  const toast = useToast();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [batching, setBatching] = useState(false);

  // detail modal
  const [active, setActive] = useState<any | null>(null);
  const [items, setItems] = useState<any[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [disp, setDisp] = useState<Record<string, number>>({});
  const [bo, setBo] = useState<Record<string, boolean>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [approvalNote, setApprovalNote] = useState("");
  const [processing, setProcessing] = useState(false);

  const load = () => {
    setLoading(true);
    setSelected(new Set());
    requisitionApi.pending(user).then((r) => setRows(Array.isArray(r) ? r : [])).catch((e) => toast.push({ type: "error", msg: e.message })).finally(() => setLoading(false));
  };
  useEffect(load, []);

  const filtered = useMemo(() => rows.filter((r) => filter === "all" || r.status === filter), [rows, filter]);

  // ── เปิดใบเบิก ────────────────────────────────────────────────
  const open = async (r: any) => {
    setActive(r); setItems([]); setApprovalNote(""); setDetailLoading(true);
    try {
      const d = await requisitionApi.details(r.id);
      const its = d.items || [];
      setItems(its);
      const level = levelOf(r.status);
      const nd: Record<string, number> = {}, nb: Record<string, boolean> = {}, nn: Record<string, string> = {};
      its.forEach((it: any) => {
        const reqQty = it.quantity || 0, stock = it.currentInventoryQuantity ?? 0, already = it.dispensedQuantity || 0;
        if (level === "manager") nd[it.itemId] = reqQty; // อนุมัติเต็มตามที่ขอเป็นค่าตั้งต้น (ปรับลดได้)
        else if (level === "stock") nd[it.itemId] = Math.min(reqQty, stock);
        else if (level === "fulfill_backorder") nd[it.itemId] = it.isBackordered ? Math.min(reqQty - already, stock) : 0;
        nb[it.itemId] = it.isBackordered; nn[it.itemId] = it.notesForItem || "";
      });
      setDisp(nd); setBo(nb); setNotes(nn);
    } catch (e: any) { toast.push({ type: "error", msg: e.message }); setActive(null); }
    finally { setDetailLoading(false); }
  };

  const decide = async (decision: "Approved" | "Rejected") => {
    if (!active) return;
    const level = levelOf(active.status);
    if (decision === "Rejected" && !approvalNote.trim()) return toast.push({ type: "error", msg: "กรุณาระบุเหตุผลการปฏิเสธ" });
    // validate stock
    for (const it of items) {
      const q = disp[it.itemId] || 0;
      if (decision === "Approved" && (level === "stock" || level === "fulfill_backorder") && !bo[it.itemId] && q > (it.currentInventoryQuantity ?? 0)) {
        return toast.push({ type: "error", msg: `"${it.itemName}" จ่าย ${q} เกินคงเหลือ (${it.currentInventoryQuantity})` });
      }
    }
    setProcessing(true);
    try {
      const dispensedItems = items.map((it: any) => ({
        itemId: it.itemId, itemName: it.itemName, unit: it.unit,
        dispensedQuantity: disp[it.itemId] || 0, approvedQuantity: disp[it.itemId] || 0,
        isBackordered: bo[it.itemId] || false, itemNote: (notes[it.itemId] || "").trim(),
      }));
      const res = await requisitionApi.approve(active.id, { approverUsername: user.username, approvalLevel: level, approvalDecision: decision, notes: approvalNote, dispensedItems });
      if (res.success) { toast.push({ type: "success", msg: `อัปเดตสถานะเป็น: ${statusLabel(res.newStatus)}` }); setActive(null); load(); }
      else toast.push({ type: "error", msg: res.message || "ไม่สำเร็จ" });
    } catch (e: any) { toast.push({ type: "error", msg: e.message }); }
    finally { setProcessing(false); }
  };

  const forceComplete = async () => {
    if (!active) return;
    if (!confirm(`บังคับปิดงานใบเบิก #${active.id}? รายการค้างจ่ายที่เหลือจะถูกยกเลิก`)) return;
    setProcessing(true);
    try {
      const res = await requisitionApi.complete(active.id, user);
      if (res.success) { toast.push({ type: "success", msg: "ปิดงานเป็น 'เสร็จสิ้น' แล้ว" }); setActive(null); load(); }
      else toast.push({ type: "error", msg: res.message });
    } catch (e: any) { toast.push({ type: "error", msg: e.message }); }
    finally { setProcessing(false); }
  };

  // ── batch (เฉพาะสถานะเดียวกัน manager/stock) ───────────────────
  const toggle = (id: string) => setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const selectedRows = filtered.filter((r) => selected.has(r.id));
  const batchLevel = selectedRows.length && selectedRows.every((r) => r.status === selectedRows[0].status) ? levelOf(selectedRows[0].status) : "";
  const canBatch = (batchLevel === "manager" && ["Admin", "Manager"].includes(user.role)) || (batchLevel === "stock" && ["Admin", "Manager", "Staff"].includes(user.role));

  const runBatch = async (decision: "Approved" | "Rejected") => {
    if (!canBatch) return toast.push({ type: "error", msg: "เลือกใบเบิกที่อยู่สถานะเดียวกัน (อนุมัติผจก. หรือ จ่ายพัสดุ)" });
    if (decision === "Rejected" && !confirm("ยืนยันปฏิเสธใบเบิกที่เลือกทั้งหมด?")) return;
    setBatching(true);
    try {
      const res = await requisitionApi.batchApprove({
        requisitionIds: [...selected], approverUsername: user.username, approvalLevel: batchLevel, approvalDecision: decision,
        notes: decision === "Approved" ? "อนุมัติเป็นชุด" : "ปฏิเสธเป็นชุด",
      });
      if (res.success) { toast.push({ type: "success", msg: `ดำเนินการ ${res.processedCount} ใบสำเร็จ` }); load(); }
      else toast.push({ type: "error", msg: res.message });
    } catch (e: any) { toast.push({ type: "error", msg: e.message }); }
    finally { setBatching(false); }
  };

  const level = active ? levelOf(active.status) : "";
  const isManager = level === "manager";
  const isDispense = level === "stock" || level === "fulfill_backorder";
  const editable = isManager || isDispense;

  return (
    <div>
      <PageHeader title="อนุมัติใบเบิก" subtitle="พิจารณา / จ่ายพัสดุ / จ่ายของค้าง — ทีละใบหรือเป็นชุด" />

      <Card className="mb-4 flex flex-wrap items-center justify-between gap-3 p-4">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-500">กรองสถานะ</span>
          <select className={inputClass + " max-w-[220px]"} value={filter} onChange={(e) => { setFilter(e.target.value); setSelected(new Set()); }}>
            <option value="all">ทุกสถานะที่รอดำเนินการ</option>
            <option value="Pending Manager Approval">รออนุมัติ (หัวหน้างาน)</option>
            <option value="Pending Stock Approval">รอจ่ายพัสดุ</option>
            <option value="Partially Completed">จ่ายบางส่วน (ค้างจ่าย)</option>
          </select>
        </div>
        {selected.size > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">เลือก {selected.size} ใบ</span>
            <Button size="sm" variant="success" onClick={() => runBatch("Approved")} disabled={batching || !canBatch}><CheckCircle2 className="h-4 w-4" />อนุมัติเป็นชุด</Button>
            <Button size="sm" variant="danger" onClick={() => runBatch("Rejected")} disabled={batching || !canBatch}><XCircle className="h-4 w-4" />ปฏิเสธเป็นชุด</Button>
          </div>
        )}
      </Card>

      {loading ? <Spinner label="กำลังโหลด…" /> : filtered.length === 0 ? (
        <Card><EmptyState icon={<Inbox className="h-6 w-6" />} title="ไม่มีใบเบิกรอดำเนินการ" /></Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-slate-100 bg-slate-50/70 text-left text-xs font-semibold text-slate-500">
                <th className="w-10 px-4 py-3"></th>
                <th className="px-4 py-3">เลขที่</th><th className="px-4 py-3">วันที่</th><th className="px-4 py-3">ผู้เบิก</th>
                <th className="px-4 py-3">สถานะ</th><th className="px-4 py-3 text-right"></th>
              </tr></thead>
              <tbody className="divide-y divide-slate-50">
                {filtered.map((r) => {
                  const s = STATUS_STYLES[r.status] || { bg: "#f1f5f9", color: "#475569" };
                  const batchable = r.status === "Pending Manager Approval" || r.status === "Pending Stock Approval";
                  return (
                    <tr key={r.id} className="hover:bg-slate-50/50">
                      <td className="px-4 py-3">{batchable && <input type="checkbox" checked={selected.has(r.id)} onChange={() => toggle(r.id)} className="h-4 w-4 cursor-pointer" />}</td>
                      <td className="px-4 py-3 font-mono text-xs font-semibold text-slate-700">{r.id}</td>
                      <td className="px-4 py-3 text-slate-500">{fmtDate(r.date)}</td>
                      <td className="px-4 py-3"><div className="text-slate-700">{r.requestorName}</div><div className="text-[11px] text-slate-400">{r.requestorDepartment}</div></td>
                      <td className="px-4 py-3"><Badge bg={s.bg} color={s.color}>{statusLabel(r.status)}</Badge></td>
                      <td className="px-4 py-3 text-right"><Button size="sm" variant="outline" onClick={() => open(r)}><ClipboardCheck className="h-4 w-4" />{r.status === "Partially Completed" ? "จ่ายของค้าง" : "ตรวจสอบ"}</Button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Modal open={!!active} onClose={() => setActive(null)} title={`ดำเนินการใบเบิก ${active?.id || ""}`} width="max-w-4xl">
        {detailLoading ? <div className="flex items-center justify-center py-10 text-slate-400"><Loader2 className="h-6 w-6 animate-spin" /></div> : active && (
          <div>
            <div className="mb-4 grid grid-cols-2 gap-3 rounded-xl bg-slate-50 p-4 text-sm sm:grid-cols-4">
              <div><div className="text-[11px] text-slate-400">ผู้เบิก</div><div className="text-slate-700">{active.requestorName}</div></div>
              <div><div className="text-[11px] text-slate-400">แผนก</div><div className="text-slate-700">{active.requestorDepartment}</div></div>
              <div><div className="text-[11px] text-slate-400">วันที่</div><div className="text-slate-700">{fmtDate(active.date)}</div></div>
              <div><div className="text-[11px] text-slate-400">สถานะ</div><div className="text-slate-700">{statusLabel(active.status)}</div></div>
              <div className="col-span-2 sm:col-span-4"><div className="text-[11px] text-slate-400">วัตถุประสงค์</div><div className="text-slate-700">{active.purpose || "-"}</div></div>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-100">
              <table className="w-full text-xs">
                <thead><tr className="bg-slate-50/70 text-left font-semibold text-slate-500">
                  <th className="px-3 py-2.5">วัสดุ</th><th className="px-3 py-2.5 text-center">ขอเบิก</th><th className="px-3 py-2.5 text-center">คงเหลือ</th>
                  {editable && <th className="px-3 py-2.5 text-center">{isManager ? "อนุมัติจำนวน" : "จ่ายครั้งนี้"}</th>}
                  {isDispense && <th className="px-3 py-2.5 text-center">ค้างจ่าย / หมายเหตุ</th>}
                  {isManager && <th className="px-3 py-2.5 text-center">หมายเหตุ</th>}
                  <th className="px-3 py-2.5 text-right">มูลค่า</th>
                </tr></thead>
                <tbody className="divide-y divide-slate-50">
                  {items.map((it: any) => {
                    const stock = it.currentInventoryQuantity ?? 0;
                    return (
                      <tr key={it.itemId} className="align-top">
                        <td className="px-3 py-2.5"><div className="font-medium text-slate-700">{it.itemName}</div><div className="font-mono text-[11px] text-slate-400">{it.itemCode} · {it.unit}</div></td>
                        <td className="px-3 py-2.5 text-center text-slate-600">{fmtNumber(it.quantity)}</td>
                        <td className="px-3 py-2.5 text-center"><span className={stock < it.quantity ? "text-amber-600" : "text-slate-600"}>{fmtNumber(stock)}</span></td>
                        {editable && (
                          <td className="px-3 py-2.5 text-center">
                            <input type="number" min={0} disabled={bo[it.itemId]} className={inputClass + " mx-auto w-20 text-center disabled:opacity-40"} value={disp[it.itemId] ?? 0}
                              onChange={(e) => { const raw = Math.max(0, parseInt(e.target.value) || 0); setDisp({ ...disp, [it.itemId]: isManager ? raw : Math.min(raw, stock) }); }} />
                            {isManager && (disp[it.itemId] ?? 0) > it.quantity && <div className="mt-0.5 text-[10px] text-amber-500">มากกว่ายอดขอ</div>}
                          </td>
                        )}
                        {isDispense && (
                          <td className="px-3 py-2.5">
                            <label className="flex items-center justify-center gap-1 text-[11px] font-semibold text-rose-600">
                              <input type="checkbox" checked={bo[it.itemId] || false} onChange={(e) => { const c = e.target.checked; setBo({ ...bo, [it.itemId]: c }); setDisp({ ...disp, [it.itemId]: c ? 0 : Math.min(it.quantity, stock) }); }} />
                              ค้างจ่าย
                            </label>
                            <input placeholder="หมายเหตุ…" className="mt-1 w-full rounded border border-slate-200 bg-slate-50 px-1.5 py-1 text-[11px]" value={notes[it.itemId] || ""} onChange={(e) => setNotes({ ...notes, [it.itemId]: e.target.value })} />
                          </td>
                        )}
                        {isManager && (
                          <td className="px-3 py-2.5">
                            <input placeholder="หมายเหตุ…" className="w-full rounded border border-slate-200 bg-slate-50 px-1.5 py-1 text-[11px]" value={notes[it.itemId] || ""} onChange={(e) => setNotes({ ...notes, [it.itemId]: e.target.value })} />
                          </td>
                        )}
                        <td className="px-3 py-2.5 text-right font-medium text-slate-700">{fmtBaht((disp[it.itemId] ?? 0) * (it.UnitPrice || 0))}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <textarea className={inputClass + " mt-4"} rows={2} placeholder="หมายเหตุการอนุมัติ / เหตุผลการปฏิเสธ" value={approvalNote} onChange={(e) => setApprovalNote(e.target.value)} />

            <div className="mt-4 flex flex-wrap justify-end gap-2">
              {active.status === "Partially Completed" && ["Admin", "Manager"].includes(user.role) && (
                <Button variant="outline" onClick={forceComplete} disabled={processing}><Lock className="h-4 w-4" />บังคับปิดงาน</Button>
              )}
              {level !== "fulfill_backorder" && <Button variant="danger" onClick={() => decide("Rejected")} disabled={processing}><XCircle className="h-4 w-4" />ปฏิเสธ</Button>}
              <Button variant="success" onClick={() => decide("Approved")} disabled={processing}>
                {editable ? <><PackageCheck className="h-4 w-4" />ยืนยันการจ่าย</> : <><CheckCircle2 className="h-4 w-4" />อนุมัติ</>}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
