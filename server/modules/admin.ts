import { Router } from "express";
import { db } from "../supabase";
import { hashPassword } from "../lib/password";

export const adminRouter = Router();

const ROLES = ["Admin", "Manager", "Staff", "User"];

function ensureAdmin(req: any, res: any): boolean {
  const role = req.query.actorRole || req.body?.actorRole;
  if (role !== "Admin") {
    res.status(403).json({ error: "เฉพาะผู้ดูแลระบบ (Admin) เท่านั้น" });
    return false;
  }
  return true;
}

// ── รายชื่อผู้ใช้ทั้งหมด ────────────────────────────────────────
adminRouter.get("/users", async (req, res) => {
  if (!ensureAdmin(req, res)) return;
  const { data, error } = await db
    .from("users")
    .select("username,name,department,role,created_at,updated_at")
    .order("username", { ascending: true });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data ?? []);
});

// ── แก้ไขผู้ใช้ (ชื่อ/แผนก/สิทธิ์/รีเซ็ตรหัส) ──────────────────
adminRouter.put("/users/:username", async (req, res) => {
  if (!ensureAdmin(req, res)) return;
  const b = req.body ?? {};
  const upd: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (b.name !== undefined) upd.name = b.name;
  if (b.department !== undefined) upd.department = b.department;
  if (b.role !== undefined) {
    if (!ROLES.includes(b.role)) return res.status(400).json({ error: "สิทธิ์ไม่ถูกต้อง" });
    upd.role = b.role;
  }
  if (b.password) upd.password = await hashPassword(b.password);

  const { data, error } = await db.from("users").update(upd).eq("username", req.params.username).select("username");
  if (error) return res.status(500).json({ error: error.message });
  if (!data || data.length === 0) return res.status(404).json({ error: "ไม่พบผู้ใช้งาน" });
  res.json({ success: true });
});

// ── ลบผู้ใช้ ────────────────────────────────────────────────────
adminRouter.delete("/users/:username", async (req, res) => {
  if (!ensureAdmin(req, res)) return;
  const target = req.params.username;
  const actor = req.query.actorUsername;
  if (target === actor) return res.status(400).json({ error: "ไม่สามารถลบบัญชีของตนเองได้" });

  const { data: refs } = await db.from("requisitions").select("id").eq("requested_by", target).limit(1);
  if (refs && refs.length > 0) {
    return res.status(409).json({ error: "ผู้ใช้นี้มีประวัติการเบิก ไม่สามารถลบได้ (แนะนำให้เปลี่ยนสิทธิ์แทน)" });
  }
  const { error } = await db.from("users").delete().eq("username", target);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

// ============================================================
// จัดการแผนก (ใช้ในหน้าแอดมิน)
// ============================================================
adminRouter.get("/departments", async (req, res) => {
  if (!ensureAdmin(req, res)) return;
  const { data, error } = await db.from("departments").select("id,name").order("name", { ascending: true });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data ?? []);
});

adminRouter.post("/departments", async (req, res) => {
  if (!ensureAdmin(req, res)) return;
  const name = (req.body?.name || "").trim();
  if (!name) return res.status(400).json({ error: "กรุณากรอกชื่อแผนก" });
  const { data: existing } = await db.from("departments").select("id").eq("name", name).maybeSingle();
  if (existing) return res.status(409).json({ error: "มีแผนกนี้อยู่แล้ว" });
  const { error } = await db.from("departments").insert({ name });
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

adminRouter.delete("/departments/:id", async (req, res) => {
  if (!ensureAdmin(req, res)) return;
  const { error } = await db.from("departments").delete().eq("id", req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});
