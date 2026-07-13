import { useEffect, useState } from "react";
import { UserCog, Save } from "lucide-react";
import { authApi } from "../lib/api";
import { Button, Card, Field, inputClass, PageHeader, Badge, useToast } from "../ui";
import type { User } from "../types";

export default function Profile({ user, onUpdate }: { user: User; onUpdate: (u: User) => void }) {
  const toast = useToast();
  const [name, setName] = useState(user.name);
  const [department, setDepartment] = useState(user.department);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [departments, setDepartments] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => { authApi.departments().then(setDepartments).catch(() => setDepartments([])); }, []);

  const save = async () => {
    if (password && password !== confirm) return toast.push({ type: "error", msg: "รหัสผ่านใหม่ไม่ตรงกัน" });
    setSaving(true);
    try {
      await authApi.updateProfile({ username: user.username, name, department, ...(password ? { password } : {}) });
      onUpdate({ ...user, name, department });
      setPassword(""); setConfirm("");
      toast.push({ type: "success", msg: "บันทึกโปรไฟล์สำเร็จ" });
    } catch (e: any) { toast.push({ type: "error", msg: e.message }); }
    finally { setSaving(false); }
  };

  return (
    <div>
      <PageHeader title="โปรไฟล์ของฉัน" subtitle="จัดการข้อมูลบัญชีและรหัสผ่าน" />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="p-6 text-center">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-2xl bg-[#5b4df6] text-2xl font-bold text-white">{user.name.charAt(0)}</div>
          <div className="mt-4 text-lg font-bold text-slate-800">{user.name}</div>
          <div className="font-mono text-xs text-slate-400">{user.username}</div>
          <div className="mt-3 flex justify-center"><Badge bg="#ede9fe" color="#6d28d9">{user.role}</Badge></div>
        </Card>

        <Card className="p-6 lg:col-span-2">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="ชื่อ–นามสกุล"><input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} /></Field>
            <Field label="แผนก">
              <select className={inputClass} value={department} onChange={(e) => setDepartment(e.target.value)}>
                {departments.map((d) => <option key={d} value={d}>{d}</option>)}
                {!departments.includes(department) && department && <option value={department}>{department}</option>}
              </select>
            </Field>
            <Field label="รหัสผ่านใหม่ (เว้นว่างหากไม่เปลี่ยน)"><input type="password" className={inputClass} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" /></Field>
            <Field label="ยืนยันรหัสผ่านใหม่"><input type="password" className={inputClass} value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="••••••••" /></Field>
          </div>
          <div className="mt-6 flex justify-end">
            <Button onClick={save} disabled={saving}><Save className="h-4 w-4" />{saving ? "กำลังบันทึก…" : "บันทึกการเปลี่ยนแปลง"}</Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
