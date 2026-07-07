import { useEffect, useState } from "react";
import { Search, FileText, FileDown, Eye, ClipboardList, Printer } from "lucide-react";
import { requisitionApi } from "../lib/api";
import { fmtBaht, fmtNumber, fmtDate, fmtDateTime, statusLabel, STATUS_STYLES, STATUS_LABELS } from "../lib/format";
import { Button, Card, inputClass, Modal, Spinner, EmptyState, PageHeader, Badge, useToast } from "../ui";
import type { User } from "../types";

export default function History({ user }: { user: User }) {
  const toast = useToast();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ id: "", status: "", startDate: "", endDate: "" });
  const [detail, setDetail] = useState<any | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const load = () => {
    setLoading(true);
    requisitionApi.list(filters, user).then(setRows).catch((e) => toast.push({ type: "error", msg: e.message })).finally(() => setLoading(false));
  };
  useEffect(load, []);

  const openDetail = async (id: string) => {
    setDetailLoading(true);
    setDetail({ loading: true });
    try { setDetail(await requisitionApi.details(id)); }
    catch (e: any) { toast.push({ type: "error", msg: e.message }); setDetail(null); }
    finally { setDetailLoading(false); }
  };

  return (
    <div>
      <PageHeader title="ประวัติใบเบิก" subtitle={["Admin", "Manager", "Staff"].includes(user.role) ? "ใบเบิกทั้งหมดในระบบ" : "ใบเบิกของคุณ"} />

      <Card className="mb-4 p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="relative min-w-[180px] flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input className={inputClass + " pl-9"} placeholder="ค้นหาเลขที่ใบเบิก" value={filters.id} onChange={(e) => setFilters({ ...filters, id: e.target.value })} />
          </div>
          <select className={inputClass + " max-w-[200px]"} value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}>
            <option value="">ทุกสถานะ</option>
            {Object.keys(STATUS_LABELS).map((s) => <option key={s} value={s}>{statusLabel(s)}</option>)}
          </select>
          <input type="date" className={inputClass + " max-w-[160px]"} value={filters.startDate} onChange={(e) => setFilters({ ...filters, startDate: e.target.value })} />
          <input type="date" className={inputClass + " max-w-[160px]"} value={filters.endDate} onChange={(e) => setFilters({ ...filters, endDate: e.target.value })} />
          <Button onClick={load}>ค้นหา</Button>
        </div>
      </Card>

      <Card className="overflow-hidden">
        {loading ? <Spinner label="กำลังโหลด…" /> : rows.length === 0 ? (
          <EmptyState icon={<ClipboardList className="h-6 w-6" />} title="ไม่พบใบเบิก" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/70 text-left text-xs font-semibold text-slate-500">
                  <th className="px-4 py-3">เลขที่</th>
                  <th className="px-4 py-3">วันที่</th>
                  <th className="px-4 py-3">ผู้เบิก</th>
                  <th className="px-4 py-3">สถานะ</th>
                  <th className="px-4 py-3 text-center">เอกสาร</th>
                  <th className="px-4 py-3 text-right"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {rows.map((r) => {
                  const s = STATUS_STYLES[r.status] || { bg: "#f1f5f9", color: "#475569" };
                  return (
                    <tr key={r.id} className="hover:bg-slate-50/50">
                      <td className="px-4 py-3 font-mono text-xs font-semibold text-slate-700">{r.id}</td>
                      <td className="px-4 py-3 text-slate-500">{fmtDate(r.date)}</td>
                      <td className="px-4 py-3"><div className="text-slate-700">{r.requestorName}</div><div className="text-[11px] text-slate-400">{r.requestorDepartment}</div></td>
                      <td className="px-4 py-3"><Badge bg={s.bg} color={s.color}>{statusLabel(r.status)}</Badge></td>
                      <td className="px-4 py-3">
                        <div className="flex justify-center gap-1">
                          {r.RequisitionPDFLink && <a href={r.RequisitionPDFLink} target="_blank" rel="noreferrer" title="เอกสารใบเบิก" className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-indigo-50 hover:text-indigo-600"><FileText className="h-4 w-4" /></a>}
                          {r.GoodsIssuePDFLinks?.map((g: any, i: number) => (
                            <span key={i} className="inline-flex">
                              <a href={g.url} target="_blank" rel="noreferrer" title={`เอกสารใบจ่าย ${g.id}`} className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-emerald-50 hover:text-emerald-600"><FileDown className="h-4 w-4" /></a>
                              <button onClick={() => window.open(g.url, "_blank")} title={`พิมพ์ใบจ่าย ${g.id}`} className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border-none bg-transparent text-slate-400 hover:bg-sky-50 hover:text-sky-600"><Printer className="h-4 w-4" /></button>
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right"><Button size="sm" variant="outline" onClick={() => openDetail(r.id)}><Eye className="h-4 w-4" />ดู</Button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal open={!!detail} onClose={() => setDetail(null)} title="รายละเอียดใบเบิก" width="max-w-3xl">
        {detailLoading || detail?.loading ? <Spinner /> : detail && (
          <div>
            <div className="mb-5 grid grid-cols-4 gap-2 rounded-2xl border border-slate-100 bg-slate-50 px-2 py-4 text-center">
              {(() => {
                const rq = detail.requisition;
                const steps = [
                  { n: 1, label: "ยื่นขอเบิก", sub: rq.requestorName, state: "done" },
                  { n: 2, label: "อนุมัติ (ผจก.)", sub: rq.managerApprovalStatus || "รอพิจารณา",
                    state: rq.managerApprovalDate ? "done" : rq.status === "Pending Manager Approval" ? "active" : "idle" },
                  { n: 3, label: "จ่ายพัสดุ", sub: rq.stockApprovalStatus || "รอพิจารณา",
                    state: rq.stockApprovalDate ? "done" : rq.status === "Pending Stock Approval" ? "active" : "idle" },
                  { n: 4, label: "สิ้นสุด",
                    sub: rq.status === "Completed" ? "จ่ายสำเร็จ" : rq.status === "Partially Completed" ? "มีค้างจ่าย" : rq.status.includes("Rejected") ? "ถูกปฏิเสธ" : "กำลังดำเนินการ",
                    state: rq.status === "Completed" ? "done" : rq.status === "Partially Completed" ? "active" : rq.status.includes("Rejected") ? "reject" : "idle" },
                ];
                const bg = (s: string) => s === "done" ? "#16a34a" : s === "active" ? "#f59e0b" : s === "reject" ? "#e11d48" : "#e2e8f0";
                const fg = (s: string) => s === "idle" ? "#94a3b8" : "#fff";
                return steps.map((st) => (
                  <div key={st.n} className="flex flex-col items-center">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold shadow" style={{ background: bg(st.state), color: fg(st.state) }}>{st.n}</div>
                    <span className="mt-1.5 text-[11px] font-bold text-slate-700">{st.label}</span>
                    <span className="text-[10px] text-slate-400">{st.sub}</span>
                  </div>
                ));
              })()}
            </div>

            <div className="mb-4 grid grid-cols-2 gap-3 rounded-xl bg-slate-50 p-4 text-sm sm:grid-cols-4">
              <div><div className="text-[11px] text-slate-400">เลขที่</div><div className="font-mono font-semibold text-slate-700">{detail.requisition.id}</div></div>
              <div><div className="text-[11px] text-slate-400">วันที่</div><div className="text-slate-700">{fmtDate(detail.requisition.date)}</div></div>
              <div><div className="text-[11px] text-slate-400">ผู้เบิก</div><div className="text-slate-700">{detail.requisition.requestorName}</div></div>
              <div><div className="text-[11px] text-slate-400">สถานะ</div><div className="text-slate-700">{statusLabel(detail.requisition.status)}</div></div>
              <div className="col-span-2 sm:col-span-4"><div className="text-[11px] text-slate-400">วัตถุประสงค์</div><div className="text-slate-700">{detail.requisition.purpose || "-"}</div></div>
            </div>
            <div className="overflow-hidden rounded-xl border border-slate-100">
              <table className="w-full text-sm">
                <thead><tr className="bg-slate-50/70 text-left text-xs font-semibold text-slate-500">
                  <th className="px-3 py-2.5">วัสดุ</th><th className="px-3 py-2.5 text-center">ขอเบิก</th><th className="px-3 py-2.5 text-center">จ่ายแล้ว</th><th className="px-3 py-2.5 text-right">มูลค่า</th>
                </tr></thead>
                <tbody className="divide-y divide-slate-50">
                  {detail.items.map((it: any, i: number) => (
                    <tr key={i}>
                      <td className="px-3 py-2.5"><div className="font-medium text-slate-700">{it.itemName}</div><div className="font-mono text-[11px] text-slate-400">{it.itemCode}</div></td>
                      <td className="px-3 py-2.5 text-center text-slate-600">{fmtNumber(it.quantity)} {it.unit}</td>
                      <td className="px-3 py-2.5 text-center">{it.isBackordered ? <span className="text-amber-600">{fmtNumber(it.dispensedQuantity)} (ค้าง)</span> : <span className="text-slate-600">{fmtNumber(it.dispensedQuantity)}</span>}</td>
                      <td className="px-3 py-2.5 text-right text-slate-700">{fmtBaht(it.TotalPrice)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {(detail.requisition.managerApprovalNote || detail.requisition.stockApprovalNote) && (
              <div className="mt-4 space-y-2 text-xs">
                {detail.requisition.managerApproverName && <div className="rounded-lg bg-slate-50 p-3"><span className="font-semibold text-slate-600">หัวหน้างาน:</span> <span className="text-slate-500">{detail.requisition.managerApproverName} · {detail.requisition.managerApprovalStatus} · {fmtDateTime(detail.requisition.managerApprovalDate)}</span>{detail.requisition.managerApprovalNote && <div className="mt-1 text-slate-500">“{detail.requisition.managerApprovalNote}”</div>}</div>}
                {detail.requisition.stockApproverName && <div className="rounded-lg bg-slate-50 p-3"><span className="font-semibold text-slate-600">พัสดุ:</span> <span className="text-slate-500">{detail.requisition.stockApproverName} · {detail.requisition.stockApprovalStatus} · {fmtDateTime(detail.requisition.stockApprovalDate)}</span>{detail.requisition.stockApprovalNote && <div className="mt-1 whitespace-pre-line text-slate-500">“{detail.requisition.stockApprovalNote}”</div>}</div>}
              </div>
            )}
            <div className="mt-4 flex justify-end gap-2">
              {detail.requisition.RequisitionPDFLink && <a href={detail.requisition.RequisitionPDFLink} target="_blank" rel="noreferrer"><Button variant="outline"><FileText className="h-4 w-4" />ใบเบิก</Button></a>}
              {detail.requisition.GoodsIssuePDFLinks?.map((g: any, i: number) => <a key={i} href={g.url} target="_blank" rel="noreferrer"><Button variant="outline"><FileDown className="h-4 w-4" />ใบจ่าย {i + 1}</Button></a>)}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
