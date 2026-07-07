import { useState } from "react";
import { Search, ArrowDownToLine, ArrowUpFromLine, PackageSearch, Boxes } from "lucide-react";
import { movementApi } from "../lib/api";
import { fmtNumber, fmtDateTime } from "../lib/format";
import { Card, Button, inputClass, Spinner, EmptyState, PageHeader, useToast } from "../ui";

export default function Movement() {
  const toast = useToast();
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const search = async () => {
    if (!query.trim()) return toast.push({ type: "error", msg: "กรุณากรอกชื่อหรือรหัสพัสดุ" });
    setLoading(true); setSearched(true);
    try {
      const res = await movementApi.search(query.trim());
      setItems(res.items || []);
    } catch (e: any) { toast.push({ type: "error", msg: e.message }); }
    finally { setLoading(false); }
  };

  return (
    <div>
      <PageHeader title="ตรวจสอบการเคลื่อนไหวพัสดุ" subtitle="ค้นหาพัสดุเพื่อดูประวัติการรับเข้าและการจ่ายออกทั้งหมด" />

      <Card className="mb-4 p-4">
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input autoFocus className={inputClass + " pl-9"} placeholder="พิมพ์ชื่อวัสดุ หรือรหัสพัสดุ แล้วกด Enter" value={query}
              onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.key === "Enter" && search()} />
          </div>
          <Button onClick={search}><Search className="h-4 w-4" />ค้นหา</Button>
        </div>
      </Card>

      {loading ? <Spinner label="กำลังค้นหา…" /> : !searched ? (
        <Card><EmptyState icon={<PackageSearch className="h-6 w-6" />} title="ค้นหาพัสดุเพื่อเริ่มตรวจสอบ" hint="ระบบจะแสดงว่ามีการรับเข้าเมื่อใด และจ่ายไปยังหน่วยงานใดบ้าง" /></Card>
      ) : items.length === 0 ? (
        <Card><EmptyState icon={<PackageSearch className="h-6 w-6" />} title="ไม่พบพัสดุตามคำค้น" /></Card>
      ) : (
        <div className="flex flex-col gap-5">
          {items.map((it) => (
            <Card key={it.id} className="overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-slate-50/60 px-5 py-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-100 text-indigo-600"><Boxes className="h-6 w-6" /></div>
                  <div>
                    <div className="font-semibold text-slate-800">{it.name}</div>
                    <div className="font-mono text-[11px] text-slate-400">{it.code} · {it.location || "ไม่ระบุที่ตั้ง"}</div>
                  </div>
                </div>
                <div className="flex gap-5 text-sm">
                  <div className="text-center"><div className="flex items-center gap-1 text-emerald-600"><ArrowDownToLine className="h-4 w-4" /><span className="font-bold">{fmtNumber(it.totalIn)}</span></div><div className="text-[10px] text-slate-400">รับเข้ารวม</div></div>
                  <div className="text-center"><div className="flex items-center gap-1 text-rose-600"><ArrowUpFromLine className="h-4 w-4" /><span className="font-bold">{fmtNumber(it.totalOut)}</span></div><div className="text-[10px] text-slate-400">จ่ายออกรวม</div></div>
                  <div className="text-center"><div className="font-bold text-slate-700">{fmtNumber(it.currentStock)}</div><div className="text-[10px] text-slate-400">คงเหลือ ({it.unit})</div></div>
                </div>
              </div>

              {it.movements.length === 0 ? (
                <div className="px-5 py-8 text-center text-sm text-slate-400">ยังไม่มีประวัติการเคลื่อนไหว</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="border-b border-slate-100 text-left text-xs font-semibold text-slate-500">
                      <th className="px-5 py-2.5">วันที่-เวลา</th><th className="px-5 py-2.5">ประเภท</th>
                      <th className="px-5 py-2.5 text-center">จำนวน</th><th className="px-5 py-2.5">อ้างอิง / ปลายทาง</th><th className="px-5 py-2.5 text-center">คงเหลือหลังทำรายการ</th>
                    </tr></thead>
                    <tbody className="divide-y divide-slate-50">
                      {it.movements.map((m: any, i: number) => (
                        <tr key={i} className="hover:bg-slate-50/50">
                          <td className="px-5 py-2.5 text-slate-500">{fmtDateTime(m.timestamp)}</td>
                          <td className="px-5 py-2.5">
                            {m.isReceipt ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700"><ArrowDownToLine className="h-3 w-3" />รับเข้า</span>
                            ) : (
                              <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-1 text-[11px] font-semibold text-rose-700"><ArrowUpFromLine className="h-3 w-3" />จ่ายออก</span>
                            )}
                          </td>
                          <td className={`px-5 py-2.5 text-center font-bold ${m.isReceipt ? "text-emerald-600" : "text-rose-600"}`}>{m.quantityChange > 0 ? "+" : ""}{fmtNumber(m.quantityChange)} {m.unit}</td>
                          <td className="px-5 py-2.5">
                            <div className="font-mono text-xs text-slate-600">{m.referenceNo || "-"}</div>
                            {m.isReceipt
                              ? <div className="text-[11px] text-slate-400">รับโดย {m.receivedBy || "-"}</div>
                              : <div className="text-[11px] text-slate-400">{m.toDepartment ? `→ ${m.toDepartment}` : ""}{m.toRequestor ? ` (${m.toRequestor})` : ""}</div>}
                            {m.notes && <div className="mt-0.5 text-[11px] italic text-slate-400">📝 {m.notes}</div>}
                          </td>
                          <td className="px-5 py-2.5 text-center text-slate-600">{m.newStockQuantity != null ? fmtNumber(m.newStockQuantity) : "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
