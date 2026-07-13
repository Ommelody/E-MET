import { Router } from "express";
import { db } from "../supabase";

export const auditRouter = Router();

// ── บันทึก audit จาก client (เช่น LOGIN) ───────────────────────
auditRouter.post("/", async (req, res) => {
  const b = req.body ?? {};
  try {
    await db.from("audit_logs").insert({
      actor: b.actor || null, actor_name: b.actorName || null, actor_role: b.actorRole || null,
      action: b.action, entity_type: b.entityType || null, entity_id: b.entityId || null,
      detail: b.detail || null,
    });
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── ดูรายการ audit (เฉพาะ Admin) ──────────────────────────────
auditRouter.get("/", async (req, res) => {
  const q = req.query as any;
  if (q.actorRole !== "Admin") return res.status(403).json({ error: "เฉพาะผู้ดูแลระบบ (Admin) เท่านั้น" });
  try {
    let query = db.from("audit_logs").select("*", { count: "exact" }).order("timestamp", { ascending: false });
    if (q.action && q.action !== "-- All --") query = query.eq("action", q.action);
    if (q.actor) query = query.ilike("actor", `%${q.actor}%`);
    if (q.startDate) query = query.gte("timestamp", new Date(q.startDate).toISOString());
    if (q.endDate) { const e = new Date(q.endDate); e.setHours(23, 59, 59, 999); query = query.lte("timestamp", e.toISOString()); }
    const limit = Math.min(500, parseInt(q.limit) || 200);
    const { data, error } = await query.limit(limit);
    if (error) return res.status(500).json({ error: error.message });
    res.json(data ?? []);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});
