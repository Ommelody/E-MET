import { useEffect, useMemo, useState } from "react";
import { Plus, Search, Pencil, Trash2, Package, ImageOff } from "lucide-react";
import { inventoryApi } from "../lib/api";
import { fmtBaht, fmtNumber } from "../lib/format";
import { Button, Card, Field, inputClass, Modal, Spinner, EmptyState, PageHeader, useToast } from "../ui";
import type { User } from "../types";

const empty = { code: "", name: "", category: "", unit: "", quantity: "0", minQuantity: "0", maxIssueQuantity: "", unitPrice: "0", location: "" };

export default function Inventory({ user }: { user: User }) {
  const toast = useToast();
  const canEdit = ["Admin", "Manager", "Staff"].includes(user.role);
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);
  const [imageFile, setImageFile] = useState<{ base64: string; mime: string; preview: string } | null>(null);
  const [lightbox, setLightbox] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    inventoryApi.list().then(setItems).catch((e) => toast.push({ type: "error", msg: e.message })).finally(() => setLoading(false));
  };
  useEffect(load, []);

  const categories = useMemo(() => [...new Set(items.map((i) => i.category).filter(Boolean))].sort(), [items]);
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((i) => {
      const matchQ = !q || i.name.toLowerCase().includes(q) || i.code.toLowerCase().includes(q) || (i.location || "").toLowerCase().includes(q);
      const matchC = !category || i.category === category;
      return matchQ && matchC;
    });
  }, [items, search, category]);

  const openAdd = () => { setEditing(null); setForm(empty); setImageFile(null); setModalOpen(true); };
  const openEdit = (it: any) => {
    setEditing(it);
    setForm({ code: it.code, name: it.name, category: it.category || "", unit: it.unit || "",
      quantity: String(it.quantity), minQuantity: String(it.minQuantity), maxIssueQuantity: it.maxIssueQuantity == null ? "" : String(it.maxIssueQuantity), unitPrice: String(it.unitPrice), location: it.location || "" });
    setImageFile(null);
    setModalOpen(true);
  };

  const onPickImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const res = reader.result as string;
      setImageFile({ base64: res.split(",")[1], mime: file.type, preview: res });
    };
    reader.readAsDataURL(file);
  };

  const save = async () => {
    if (!form.code.trim() || !form.name.trim()) return toast.push({ type: "error", msg: "กรุณากรอกรหัสและชื่อวัสดุ" });
    setSaving(true);
    try {
      let id = editing?.id;
      if (editing) await inventoryApi.update(editing.id, form);
      else { const r = await inventoryApi.create(form); id = r.id; }
      if (imageFile && id) await inventoryApi.uploadImage(id, imageFile.base64, imageFile.mime);
      toast.push({ type: "success", msg: editing ? "แก้ไขวัสดุสำเร็จ" : "เพิ่มวัสดุสำเร็จ" });
      setModalOpen(false);
      load();
    } catch (e: any) {
      toast.push({ type: "error", msg: e.message });
    } finally { setSaving(false); }
  };

  const remove = async (it: any) => {
    if (!confirm(`ยืนยันการลบวัสดุ "${it.name}"?`)) return;
    try { await inventoryApi.remove(it.id); toast.push({ type: "success", msg: "ลบวัสดุแล้ว" }); load(); }
    catch (e: any) { toast.push({ type: "error", msg: e.message }); }
  };

  if (loading) return <Spinner label="กำลังโหลดคลังพัสดุ…" />;

  return (
    <div>
      <PageHeader title="คลังพัสดุ" subtitle={`ทั้งหมด ${fmtNumber(items.length)} รายการ`}
        action={canEdit && <Button onClick={openAdd}><Plus className="h-4 w-4" />เพิ่มวัสดุ</Button>} />

      <Card className="mb-4 p-4">
        <div className="flex flex-wrap gap-3">
          <div className="relative min-w-[220px] flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input className={inputClass + " pl-9"} placeholder="ค้นหาชื่อ / รหัส / ที่ตั้ง" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <select className={inputClass + " max-w-[220px]"} value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">ทุกหมวดหมู่</option>
            {categories.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </Card>

      <Card className="overflow-hidden">
        {filtered.length === 0 ? (
          <EmptyState icon={<Package className="h-6 w-6" />} title="ไม่พบวัสดุ" hint="ลองปรับคำค้นหรือเพิ่มวัสดุใหม่" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/70 text-left text-xs font-semibold text-slate-500">
                  <th className="px-4 py-3">วัสดุ</th>
                  <th className="px-4 py-3">หมวดหมู่</th>
                  <th className="px-4 py-3 text-center">คงเหลือ</th>
                  <th className="px-4 py-3 text-right">ราคา/หน่วย</th>
                  <th className="px-4 py-3">ที่ตั้ง</th>
                  {canEdit && <th className="px-4 py-3 text-right">จัดการ</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filtered.map((it) => {
                  const low = it.quantity <= it.minQuantity;
                  return (
                    <tr key={it.id} className="hover:bg-slate-50/50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          {it.imageUrl ? (
                            <img src={it.imageUrl} alt="" onClick={() => setLightbox(it.imageUrl)} className="h-10 w-10 cursor-zoom-in rounded-lg object-cover transition hover:scale-105" />
                          ) : (
                            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-slate-300"><ImageOff className="h-4 w-4" /></div>
                          )}
                          <div>
                            <div className="font-medium text-slate-700">{it.name}</div>
                            <div className="font-mono text-[11px] text-slate-400">{it.code}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-500">{it.category || "-"}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`font-semibold ${low ? "text-amber-600" : "text-slate-700"}`}>{fmtNumber(it.quantity)}</span>
                        <span className="text-slate-400"> {it.unit}</span>
                        {low && <div className="text-[10px] text-amber-500">ต่ำกว่าขั้นต่ำ ({fmtNumber(it.minQuantity)})</div>}
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-slate-700">{fmtBaht(it.unitPrice)}</td>
                      <td className="px-4 py-3 text-slate-500">{it.location || "-"}</td>
                      {canEdit && (
                        <td className="px-4 py-3">
                          <div className="flex justify-end gap-1">
                            <button onClick={() => openEdit(it)} className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border-none bg-transparent text-slate-400 hover:bg-indigo-50 hover:text-indigo-600"><Pencil className="h-4 w-4" /></button>
                            {user.role === "Admin" && <button onClick={() => remove(it)} className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border-none bg-transparent text-slate-400 hover:bg-rose-50 hover:text-rose-600"><Trash2 className="h-4 w-4" /></button>}
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? "แก้ไขวัสดุ" : "เพิ่มวัสดุใหม่"} width="max-w-2xl">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="รหัสวัสดุ *"><input className={inputClass} value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} /></Field>
          <Field label="ชื่อวัสดุ *"><input className={inputClass} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
          <Field label="หมวดหมู่"><input className={inputClass} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} /></Field>
          <Field label="หน่วยนับ"><input className={inputClass} value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} /></Field>
          <Field label="จำนวนคงเหลือ"><input type="number" className={inputClass} value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} /></Field>
          <Field label="จุดสั่งซื้อขั้นต่ำ"><input type="number" className={inputClass} value={form.minQuantity} onChange={(e) => setForm({ ...form, minQuantity: e.target.value })} /></Field>
          <Field label="จำนวนเบิกสูงสุด/ครั้ง (เว้นว่าง=ไม่จำกัด)"><input type="number" min={0} className={inputClass} value={form.maxIssueQuantity} onChange={(e) => setForm({ ...form, maxIssueQuantity: e.target.value })} placeholder="ไม่จำกัด" /></Field>
          <Field label="ราคาต่อหน่วย"><input type="number" step="0.01" className={inputClass} value={form.unitPrice} onChange={(e) => setForm({ ...form, unitPrice: e.target.value })} /></Field>
          <Field label="ที่ตั้ง"><input className={inputClass} value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} /></Field>
          <div className="sm:col-span-2">
            <Field label="รูปภาพวัสดุ">
              <div className="flex items-center gap-3">
                {(imageFile?.preview || editing?.imageUrl) && <img src={imageFile?.preview || editing?.imageUrl} alt="" className="h-16 w-16 rounded-lg object-cover" />}
                <input type="file" accept="image/*" onChange={onPickImage} className="text-xs text-slate-500" />
              </div>
            </Field>
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="outline" onClick={() => setModalOpen(false)}>ยกเลิก</Button>
          <Button onClick={save} disabled={saving}>{saving ? "กำลังบันทึก…" : "บันทึก"}</Button>
        </div>
      </Modal>

      {lightbox && (
        <div onClick={() => setLightbox(null)} className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 p-4 backdrop-blur-sm">
          <button onClick={() => setLightbox(null)} className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/20 text-white hover:bg-white/40">✕</button>
          <img src={lightbox} alt="" className="max-h-[85vh] max-w-full rounded-lg object-contain shadow-2xl" />
        </div>
      )}
    </div>
  );
}
