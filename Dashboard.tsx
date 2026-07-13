import { useEffect, useState } from "react";
import { Megaphone, CalendarCheck, AlertTriangle, PhoneCall, Pencil, Save, Plus, Trash2, X } from "lucide-react";
import { announcementsApi } from "../lib/api";
import { Button, Card, Field, inputClass, Spinner, useToast } from "../ui";
import type { User } from "../types";

const ACCENTS: Record<string, { bar: string; bg: string; fg: string }> = {
  indigo: { bar: "#5b4df6", bg: "#eef2ff", fg: "#4338ca" },
  amber: { bar: "#f59e0b", bg: "#fffbeb", fg: "#b45309" },
  sky: { bar: "#0ea5e9", bg: "#f0f9ff", fg: "#0369a1" },
  emerald: { bar: "#16a34a", bg: "#f0fdf4", fg: "#15803d" },
  rose: { bar: "#e11d48", bg: "#fff1f2", fg: "#be123c" },
};
const ICONS: Record<string, React.ComponentType<any>> = { calendar: CalendarCheck, alert: AlertTriangle, phone: PhoneCall, megaphone: Megaphone };

export default function Announcements({ user }: { user: User }) {
  const toast = useToast();
  const isAdmin = user.role === "Admin";
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    announcementsApi.get().then(setData).catch(() => setData(null)).finally(() => setLoading(false));
  }, []);

  const startEdit = () => { setDraft(JSON.parse(JSON.stringify(data))); setEditing(true); };
  const save = async () => {
    setSaving(true);
    try {
      await announcementsApi.update(user, draft);
      setData(draft); setEditing(false);
      toast.push({ type: "success", msg: "บันทึกประกาศสำเร็จ" });
    } catch (e: any) { toast.push({ type: "error", msg: e.message }); }
    finally { setSaving(false); }
  };

  const updCard = (i: number, patch: any) => setDraft((d: any) => ({ ...d, cards: d.cards.map((c: any, ci: number) => ci === i ? { ...c, ...patch } : c) }));
  const addCard = () => setDraft((d: any) => ({ ...d, cards: [...d.cards, { id: "c" + Date.now(), accent: "indigo", icon: "megaphone", title: "ประกาศใหม่", body: "" }] }));
  const rmCard = (i: number) => setDraft((d: any) => ({ ...d, cards: d.cards.filter((_: any, ci: number) => ci !== i) }));

  if (loading) return <Spinner label="กำลังโหลดประกาศ…" />;
  if (!data) return <div className="text-sm text-slate-500">โหลดประกาศไม่สำเร็จ</div>;

  const view = editing ? draft : data;

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <h1 className="m-0 flex items-center gap-2 text-2xl font-bold tracking-tight text-slate-800"><Megaphone className="h-6 w-6 text-[#5b4df6]" />ประกาศข่าวสาร</h1>
          <p className="mt-1 text-sm text-slate-500">อัปเดตข้อมูลและแจ้งเตือนจากแผนกคลังพัสดุ</p>
        </div>
        {isAdmin && !editing && <Button variant="outline" onClick={startEdit}><Pencil className="h-4 w-4" />แก้ไขประกาศ</Button>}
        {isAdmin && editing && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setEditing(false)}>ยกเลิก</Button>
            <Button onClick={save} disabled={saving}><Save className="h-4 w-4" />{saving ? "กำลังบันทึก…" : "บันทึก"}</Button>
          </div>
        )}
      </div>

      {data._needsSetup && isAdmin && (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-700">
          ⚠️ ยังไม่ได้สร้างตาราง <code>app_settings</code> — การบันทึกจะยังไม่ถาวรจนกว่าจะรัน SQL ในไฟล์ <code>docs/supabase-app-settings.sql</code>
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        {view.cards.map((card: any, i: number) => {
          const a = ACCENTS[card.accent] || ACCENTS.indigo;
          const Icon = ICONS[card.icon] || Megaphone;
          return (
            <Card key={card.id} className="overflow-hidden p-6" >
              <div style={{ borderTop: `4px solid ${a.bar}`, margin: "-24px -24px 20px", padding: "20px 24px 0" }}>
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl" style={{ background: a.bg, color: a.fg }}><Icon className="h-6 w-6" /></div>
                  <div className="flex-1">
                    {editing ? (
                      <input className={inputClass} value={card.title} onChange={(e) => updCard(i, { title: e.target.value })} />
                    ) : (
                      <h3 className="m-0 text-lg font-bold text-slate-800">{card.title}</h3>
                    )}
                  </div>
                  {editing && <button onClick={() => rmCard(i)} className="text-slate-400 hover:text-rose-600"><Trash2 className="h-4 w-4" /></button>}
                </div>
              </div>
              {editing ? (
                <textarea className={inputClass} rows={5} value={card.body} onChange={(e) => updCard(i, { body: e.target.value })} placeholder="เนื้อหา (ขึ้นบรรทัดใหม่ = ย่อหน้าใหม่)" />
              ) : (
                <div className="whitespace-pre-line border-l-2 border-slate-100 pl-4 text-sm leading-relaxed text-slate-600">{card.body}</div>
              )}
              {editing && (
                <div className="mt-3 flex gap-2">
                  <select className={inputClass + " max-w-[130px]"} value={card.accent} onChange={(e) => updCard(i, { accent: e.target.value })}>
                    {Object.keys(ACCENTS).map((k) => <option key={k} value={k}>{k}</option>)}
                  </select>
                  <select className={inputClass + " max-w-[130px]"} value={card.icon} onChange={(e) => updCard(i, { icon: e.target.value })}>
                    {Object.keys(ICONS).map((k) => <option key={k} value={k}>{k}</option>)}
                  </select>
                </div>
              )}
            </Card>
          );
        })}
        {editing && <button onClick={addCard} className="flex min-h-[140px] cursor-pointer items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-300 text-sm font-semibold text-slate-400 hover:border-[#5b4df6] hover:text-[#5b4df6]"><Plus className="h-5 w-5" />เพิ่มการ์ดประกาศ</button>}
      </div>

      {/* Contact block */}
      <Card className="mt-5 p-6">
        <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl" style={{ background: ACCENTS.sky.bg, color: ACCENTS.sky.fg }}><PhoneCall className="h-6 w-6" /></div>
            <div>
              {editing ? (
                <input className={inputClass + " mb-1"} value={view.contact.title} onChange={(e) => setDraft((d: any) => ({ ...d, contact: { ...d.contact, title: e.target.value } }))} />
              ) : <h3 className="m-0 text-base font-bold text-slate-800">{view.contact.title}</h3>}
              {editing ? (
                <input className={inputClass} value={view.contact.subtitle} onChange={(e) => setDraft((d: any) => ({ ...d, contact: { ...d.contact, subtitle: e.target.value } }))} />
              ) : <p className="m-0 text-sm text-slate-500">{view.contact.subtitle}</p>}
            </div>
          </div>
          <div className="text-left sm:text-right">
            {editing ? (
              <div className="flex flex-col gap-1">
                <input className={inputClass + " text-right"} value={view.contact.phone} onChange={(e) => setDraft((d: any) => ({ ...d, contact: { ...d.contact, phone: e.target.value } }))} />
                <input className={inputClass + " text-right"} value={view.contact.ext} onChange={(e) => setDraft((d: any) => ({ ...d, contact: { ...d.contact, ext: e.target.value } }))} />
              </div>
            ) : (
              <>
                <p className="m-0 text-2xl font-black tracking-wide text-sky-600">{view.contact.phone}</p>
                <p className="m-0 text-sm text-slate-400">{view.contact.ext}</p>
              </>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}
