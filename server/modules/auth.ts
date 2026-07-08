import { Router } from "express";
import { db } from "../supabase.js";
import { hashPassword, verifyPassword, needsUpgrade } from "../lib/password.js";

/**
 * โมดูล Auth — คงพฤติกรรม/ข้อมูลผู้ใช้เดิมทั้งหมดไว้
 * รหัสผ่านตอนนี้ใช้ bcrypt (ปลอดภัย) — บัญชีเก่าที่ยังเป็นรูปแบบเดิม
 * จะถูกอัปเกรดเป็น bcrypt อัตโนมัติทันทีที่ล็อกอินสำเร็จ ไม่ต้องทำอะไรเพิ่ม
 */
export const authRouter = Router();

// ── รายชื่อแผนก (ใช้ในหน้า register) ─────────────────────────
authRouter.get("/departments", async (_req, res) => {
  const { data, error } = await db
    .from("departments")
    .select("name")
    .order("name", { ascending: true });
  if (error) return res.status(500).json({ error: error.message });
  res.json((data ?? []).map((d) => d.name));
});

// ── เข้าสู่ระบบ ───────────────────────────────────────────────
authRouter.post("/login", async (req, res) => {
  const { username, password } = req.body ?? {};
  if (!username || !password) {
    return res.status(400).json({ error: "กรุณากรอกชื่อผู้ใช้และรหัสผ่าน" });
  }

  const { data: user, error } = await db
    .from("users")
    .select("username,password,name,department,role")
    .eq("username", username)
    .maybeSingle();

  if (error) return res.status(500).json({ error: error.message });

  if (!user || !(await verifyPassword(password, user.password))) {
    return res.status(401).json({ error: "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง" });
  }

  // อัปเกรดรหัสผ่านรูปแบบเก่าเป็น bcrypt แบบเงียบ ๆ เบื้องหลัง
  if (needsUpgrade(user.password)) {
    const newHash = await hashPassword(password);
    db.from("users").update({ password: newHash }).eq("username", user.username).then(() => {});
  }

  return res.json({
    username: user.username,
    name: user.name,
    department: user.department,
    role: user.role,
  });
});

// ── ลงทะเบียนผู้ใช้ใหม่ ────────────────────────────────────────
authRouter.post("/register", async (req, res) => {
  const { username, password, name, department, role } = req.body ?? {};
  if (!username || !password || !name || !department) {
    return res.status(400).json({ error: "กรอกข้อมูลไม่ครบ" });
  }

  const { data: existing } = await db
    .from("users")
    .select("username")
    .eq("username", username)
    .maybeSingle();
  if (existing) {
    return res.status(409).json({ error: "ชื่อผู้ใช้งานนี้มีอยู่แล้ว" });
  }

  const { error } = await db.from("users").insert({
    username,
    password: await hashPassword(password),
    name,
    department,
    role: role || "User",
  });
  if (error) return res.status(500).json({ error: error.message });

  res.json({ success: true });
});

// ── แก้ไขโปรไฟล์ตัวเอง ────────────────────────────────────────
authRouter.put("/profile", async (req, res) => {
  const { username, name, department, password } = req.body ?? {};
  if (!username) return res.status(400).json({ error: "ไม่พบผู้ใช้งาน" });

  const updateData: Record<string, unknown> = {
    name,
    department,
    updated_at: new Date().toISOString(),
  };
  if (password) updateData.password = await hashPassword(password);

  const { data, error } = await db
    .from("users")
    .update(updateData)
    .eq("username", username)
    .select("username");
  if (error) return res.status(500).json({ error: error.message });
  if (!data || data.length === 0) {
    return res.status(404).json({ error: "ไม่พบผู้ใช้งาน" });
  }
  res.json({ success: true });
});
