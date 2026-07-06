import { useEffect, useState } from "react";
import { Users, Pencil, Trash2, Plus, Building2, Shield } from "lucide-react";
import { adminApi } from "../lib/api";
import { fmtDate } from "../lib/format";
import { Button, Card, Field, inputClass, Modal, Spinner, EmptyState, PageHeader, Badge, useToast } from "../ui";
import type { User } from "../types";

const ROLES = ["Admin", "Manager", "Staff", "User"];
const ROLE_STYLE: Record<string, { bg: string; color: string }> = {
  Admin: { bg: "#ede9fe", color: "#6d28d9" }, Manager: { bg: "#dbeafe", color: "#1d4ed8" },
  Staff: { bg: "#dcfce7", color: "#15803d" }, User: { bg: "#f1f5f9", color: "#475569" },
};

export default function Admin({ user }: { user: User }) {
  const toast = useToast();
  const [tab, setTab] = useState<"users" | "departments">("users");
  const [users, setUsers] = useState<any[]>([]);
  const [depts, setDepts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState({ name: "", department: "", role: "User", password: "" });
  const [newDept, setNewDept] = useState("");

  const load = () => {
    setLoading(true);
    Promise.all([adminApi.users(user), adminApi.departments(user)])
      .then(([u, d]) => { setUsers(u); setDepts(d); })
      .catch((e) => toast.push({ type: "error", msg: e.message }))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const openEdit = (u: any) => { setEditing(u); setForm({ name: u.name, department: u.department, role: u.role, password: "" }); };
  const saveUser = async () => {
    try {
      await adminApi.updateUser(editing.username, user, form);
      toast.push({ type: "success", msg: "บันทึกผู้ใช้สำเร็จ" });
      setEditing(null); load();
    } catch (e: any) { toast.push({ type: "error", msg: e.message }); }
  };
  const removeUser = async (u: any) => {
    if (!confirm(`ยืนยันการลบผู้ใช้ "${u.name}" (${u.username})?`)) return;
    try { await adminApi.deleteUser(u.username, user); toast.push({ type: "success", msg: "ลบผู้ใช้แล้ว" }); load(); }
    catch (e: any) { toast.push({ type: "error", msg: e.message }); }
  };
  const addDept = async () => {
    if (!newDept.trim()) return;
    try { await adminApi.addDepartment(user, newDept.trim()); setNewDept(""); toast.push({ type: "success", msg: "เพิ่มแผนกแล้ว" }); load(); }
    catch (e: any) { toast.push({ type: "error", msg: e.message }); }
  };
  const removeDept = async (d: any) => {
    if (!confirm(`ลบแผนก "${d.name}"?`)) return;
    try { await adminApi.removeDepartment(user, d.id); toast.push({ type: "success", msg: "ลบแผนกแล้ว" }); load(); }
    catch (e: any) { toast.push({ type: "error", msg: e.message }); }
  };

  if (user.role !== "Admin") return <EmptyState icon={<Shield className="h-6 w-6" />} title="เฉพาะผู้ดูแลระบบ" hint="คุณไม่มีสิทธิ์เข้าถึงหน้านี้" />;

  return (
    <div>
      <PageHeader title="ผู้ดูแลระบบ" subtitle="จัดการผู้ใช้งานและแผนก" />

      <div className="mb-4 inline-flex gap-1 rounded-xl bg-slate-100 p-1">
        <button onClick={() => setTab("users")} className={`inline-flex cursor-pointer items-center gap-2 rounded-lg border-none px-4 py-2 text-sm font-semibold transition ${tab === "users" ? "bg-white text-slate-800 shadow-sm" : "bg-transparent text-slate-500"}`}><Users className="h-4 w-4" />ผู้ใช้งาน</button>
        <button onClick={() => setTab("departments")} className={`inline-flex cursor-pointer items-center gap-2 rounded-lg border-none px-4 py-2 text-sm font-semibold transition ${tab === "departments" ? "bg-white text-slate-800 shadow-sm" : "bg-transparent text-slate-500"}`}><Building2 className="h-4 w-4" />แผนก</button>
      </div>

      {loading ? <Spinner label="กำลังโหลด…" /> : tab === "users" ? (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-slate-100 bg-slate-50/70 text-left text-xs font-semibold text-slate-500">
                <th className="px-4 py-3">ผู้ใช้งาน</th><th className="px-4 py-3">แผนก</th><th className="px-4 py-3">สิทธิ์</th><th className="px-4 py-3">สร้างเมื่อ</th><th className="px-4 py-3 text-right">จัดการ</th>
              </tr></thead>
              <tbody className="divide-y divide-slate-50">
                {users.map((u) => {
                  const rs = ROLE_STYLE[u.role] || ROLE_STYLE.User;
                  return (
                    <tr key={u.username} className="hover:bg-slate-50/50">
                      <td className="px-4 py-3"><div className="font-medium text-slate-700">{u.name}</div><div className="font-mono text-[11px] text-slate-400">{u.username}</div></td>
                      <td className="px-4 py-3 text-slate-500">{u.department}</td>
                      <td className="px-4 py-3"><Badge bg={rs.bg} color={rs.color}>{u.role}</Badge></td>
                      <td className="px-4 py-3 text-slate-500">{fmtDate(u.created_at)}</td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1">
                          <button onClick={() => openEdit(u)} className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border-none bg-transparent text-slate-400 hover:bg-indigo-50 hover:text-indigo-600"><Pencil className="h-4 w-4" /></button>
                          {u.username !== user.username && <button onClick={() => removeUser(u)} className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border-none bg-transparent text-slate-400 hover:bg-rose-50 hover:text-rose-600"><Trash2 className="h-4 w-4" /></button>}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      ) : (
        <Card className="p-5">
          <div className="mb-4 flex gap-2">
            <input className={inputClass + " max-w-xs"} placeholder="ชื่อแผนกใหม่" value={newDept} onChange={(e) => setNewDept(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addDept()} />
            <Button onClick={addDept}><Plus className="h-4 w-4" />เพิ่มแผนก</Button>
          </div>
          {depts.length === 0 ? <EmptyState title="ยังไม่มีแผนก" /> : (
            <div className="flex flex-col divide-y divide-slate-50">
              {depts.map((d) => (
                <div key={d.id} className="flex items-center justify-between py-2.5">
                  <span className="text-sm text-slate-700">{d.name}</span>
                  <button onClick={() => removeDept(d)} className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border-none bg-transparent text-slate-400 hover:bg-rose-50 hover:text-rose-600"><Trash2 className="h-4 w-4" /></button>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      <Modal open={!!editing} onClose={() => setEditing(null)} title={`แก้ไขผู้ใช้ ${editing?.username || ""}`}>
        <div className="flex flex-col gap-4">
          <Field label="ชื่อ–นามสกุล"><input className={inputClass} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
          <Field label="แผนก">
            <select className={inputClass} value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })}>
              {depts.map((d) => <option key={d.id} value={d.name}>{d.name}</option>)}
              {!depts.some((d) => d.name === form.department) && form.department && <option value={form.department}>{form.department}</option>}
            </select>
          </Field>
          <Field label="สิทธิ์การใช้งาน">
            <select className={inputClass} value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>{ROLES.map((r) => <option key={r} value={r}>{r}</option>)}</select>
          </Field>
          <Field label="รีเซ็ตรหัสผ่าน (เว้นว่างหากไม่เปลี่ยน)"><input type="password" className={inputClass} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="รหัสผ่านใหม่" /></Field>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="outline" onClick={() => setEditing(null)}>ยกเลิก</Button>
          <Button onClick={saveUser}>บันทึก</Button>
        </div>
      </Modal>
    </div>
  );
}
