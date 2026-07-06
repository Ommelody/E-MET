import { useEffect, useState } from "react";
import { CheckCircle2, XCircle, PackageCheck, Inbox, ClipboardCheck } from "lucide-react";
import { requisitionApi } from "../lib/api";
import { fmtBaht, fmtNumber, fmtDate } from "../lib/format";
import { Button, Card, inputClass, Modal, Spinner, EmptyState, PageHeader, Badge, useToast } from "../ui";
import type { User } from "../types";

export default function Approvals({ user }: { user: User }) {
  const toast = useToast();
  const canManager = ["Admin", "Manager"].includes(user.role);
  const [level, setLevel] = useState<"manager" | "stock">(canManager ? "manager" : "stock");
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState<any | null>(null);
  const [draft, setDraft] = useState<Record<string, number>>({});
  const [note, setNote] = useState("");
  const [processing, setProcessing] = useState(false);

  const load = () => {
    setLoading(true);
    requisitionApi.batchList({ level }, user).then((r) => setRows(Array.isArray(r) ? r : [])).catch((e) => toast.push({ type: "error", msg: e.message })).finally(() => setLoading(false));
  };
  useEffect(load, [level]);

  const openReq = (r: any) => {
    setActive(r);
    setNote("");
    const d: Record<string, number> = {};
    (r.items || []).forEach((it: any) => {
      d[it.itemId] = level === "stock" ? Math.min(it.quantity, it.currentInventoryQuantity ?? 0) : it.quantity;
    });
    setDraft(d);
  };

  const decide = async (decision: "Approved" | "Rejected") => {
    if (!active) return;
    setProcessing(true);
    try {
      if (level === "manager" || decision === "Rejected") {
        await requisitionApi.approve(active.id, { approverUsername: user.username, approvalLevel: level, approvalDecision: decision, notes: note, dispensedItems: [] });
      } else {
        const dispensedItems = (active.items || []).map((it: any) => ({
          itemId: it.itemId, itemName: it.itemName, unit: it.unit,
          dispensedQuantity: draft[it.itemId] ?? 0,
          isBackordered: (draft[it.itemId] ?? 0) < it.quantity,
          itemNote: "",
        }));
        await requisitionApi.approve(active.id, { approverUsername: user.username, approvalLevel: "stock", approvalDecision: "Approved", notes: note, dispensedItems });
      }
      toast.push({ type: "success", msg: decision === "Approved" ? "อนุมัติสำเร็จ" : "ปฏิเสธใบเบิกแล้ว" });
      setActive(null);
      load();
    } catch (e: any) {
      toast.push({ type: "error", msg: e.message });
    } finally { setProcessing(false); }
  };

  return (
    <div>
      <PageHeader title="อนุมัติใบเบิก" subtitle="ตรวจสอบและดำเนินการกับใบเบิกที่รอการอนุมัติ" />

      <div className="mb-4 inline-flex gap-1 rounded-xl bg-slate-100 p-1">
        {canManager && <button onClick={() => setLevel("manager")} className={`cursor-pointer rounded-lg border-none px-4 py-2 text-sm font-semibold transition ${level === "manager" ? "bg-white text-slate-800 shadow-sm" : "bg-transparent text-slate-500"}`}>รออนุมัติ (หัวหน้างาน)</button>}
        <button onClick={() => setLevel("stock")} className={`cursor-pointer rounded-lg border-none px-4 py-2 text-sm font-semibold transition ${level === "stock" ? "bg-white text-slate-800 shadow-sm" : "bg-transparent text-slate-500"}`}>รอจ่ายพัสดุ</button>
      </div>

      {loading ? <Spinner label="กำลังโหลด…" /> : rows.length === 0 ? (
        <Card><EmptyState icon={<Inbox className="h-6 w-6" />} title="ไม่มีใบเบิกรอดำเนินการ" hint="รายการที่รออนุมัติในระดับนี้จะปรากฏที่นี่" /></Card>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {rows.map((r) => (
            <Card key={r.id} className="flex flex-col p-5">
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-mono text-xs font-bold text-slate-700">{r.id}</div>
                  <div className="mt-0.5 text-sm font-semibold text-slate-700">{r.requestorName}</div>
                  <div className="text-[11px] text-slate-400">{r.requestorDepartment} · {fmtDate(r.date)}</div>
                </div>
                <Badge bg="#eef2ff" color="#4338ca">{fmtNumber((r.items || []).length)} รายการ</Badge>
              </div>
              <p className="mt-3 line-clamp-2 min-h-[2.5rem] text-xs text-slate-500">{r.purpose || "ไม่ระบุวัตถุประสงค์"}</p>
              <Button className="mt-3" variant="outline" onClick={() => openReq(r)}><ClipboardCheck className="h-4 w-4" />ตรวจสอบ / ดำเนินการ</Button>
            </Card>
          ))}
        </div>
      )}

      <Modal open={!!active} onClose={() => setActive(null)} title={`ดำเนินการใบเบิก ${active?.id || ""}`} width="max-w-3xl">
        {active && (
          <div>
            <div className="mb-4 grid grid-cols-2 gap-3 rounded-xl bg-slate-50 p-4 text-sm sm:grid-cols-3">
              <div><div className="text-[11px] text-slate-400">ผู้เบิก</div><div className="text-slate-700">{active.requestorName}</div></div>
              <div><div className="text-[11px] text-slate-400">แผนก</div><div className="text-slate-700">{active.requestorDepartment}</div></div>
              <div><div className="text-[11px] text-slate-400">วันที่</div><div className="text-slate-700">{fmtDate(active.date)}</div></div>
              <div className="col-span-2 sm:col-span-3"><div className="text-[11px] text-slate-400">วัตถุประสงค์</div><div className="text-slate-700">{active.purpose || "-"}</div></div>
            </div>

            <div className="overflow-hidden rounded-xl border border-slate-100">
              <table className="w-full text-sm">
                <thead><tr className="bg-slate-50/70 text-left text-xs font-semibold text-slate-500">
                  <th className="px-3 py-2.5">วัสดุ</th><th className="px-3 py-2.5 text-center">ขอเบิก</th><th className="px-3 py-2.5 text-center">คงเหลือ</th>
                  {level === "stock" && <th className="px-3 py-2.5 text-center">จ่ายครั้งนี้</th>}
                </tr></thead>
                <tbody className="divide-y divide-slate-50">
                  {(active.items || []).map((it: any) => (
                    <tr key={it.itemId}>
                      <td className="px-3 py-2.5"><div className="font-medium text-slate-700">{it.itemName}</div><div className="font-mono text-[11px] text-slate-400">{it.itemCode}</div></td>
                      <td className="px-3 py-2.5 text-center text-slate-600">{fmtNumber(it.quantity)} {it.unit}</td>
                      <td className="px-3 py-2.5 text-center"><span className={((it.currentInventoryQuantity ?? 0) < it.quantity) ? "text-amber-600" : "text-slate-600"}>{fmtNumber(it.currentInventoryQuantity ?? 0)}</span></td>
                      {level === "stock" && (
                        <td className="px-3 py-2.5 text-center">
                          <input type="number" min={0} max={it.currentInventoryQuantity ?? 0} className={inputClass + " mx-auto w-20 text-center"} value={draft[it.itemId] ?? 0} onChange={(e) => setDraft({ ...draft, [it.itemId]: Math.max(0, Math.min(parseInt(e.target.value) || 0, it.currentInventoryQuantity ?? 0)) })} />
                          {(draft[it.itemId] ?? 0) < it.quantity && <div className="mt-0.5 text-[10px] text-amber-500">ค้างจ่าย {fmtNumber(it.quantity - (draft[it.itemId] ?? 0))}</div>}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-4">
              <textarea className={inputClass} rows={2} placeholder="หมายเหตุ (ถ้ามี)" value={note} onChange={(e) => setNote(e.target.value)} />
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <Button variant="danger" onClick={() => decide("Rejected")} disabled={processing}><XCircle className="h-4 w-4" />ปฏิเสธ</Button>
              <Button variant="success" onClick={() => decide("Approved")} disabled={processing}>
                {level === "stock" ? <><PackageCheck className="h-4 w-4" />ยืนยันการจ่าย</> : <><CheckCircle2 className="h-4 w-4" />อนุมัติ</>}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
