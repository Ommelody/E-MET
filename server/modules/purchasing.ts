import { Router } from "express";
import { db } from "../supabase";

export const purchasingRouter = Router();

/**
 * รายงานจุดสั่งซื้ออัตโนมัติ (Reorder Point)
 *
 * สูตรที่ใช้:
 *   อัตราใช้เฉลี่ย/วัน (ADU) = ยอดจ่ายจริงรวมในช่วงที่ดู ÷ จำนวนวันที่ดู
 *       (ถ้าตั้งค่า avg_daily_usage ในวัสดุไว้เอง จะใช้ค่านั้นแทน)
 *   ความต้องการช่วงรอของ (Lead-time demand) = ADU × ระยะเวลารอของ (วัน)
 *   จุดสั่งซื้อ (ROP) = Lead-time demand + สต๊อกสำรอง (Safety stock)
 *   ระดับสั่งเติมเป้าหมาย (Order-up-to) = ROP + (ADU × รอบทบทวน)
 *   ปริมาณแนะนำให้สั่ง = max(0, Order-up-to − คงเหลือปัจจุบัน)
 *   → จะ "ต้องสั่งซื้อ" เมื่อ คงเหลือ ≤ ROP
 *
 * พารามิเตอร์ (query, ผู้ใช้ปรับได้ทั้งหมด):
 *   lookbackDays  ช่วงย้อนหลังที่ใช้คำนวณ ADU (ค่าเริ่มต้น 90 วัน)
 *   leadTimeDays  ระยะเวลารอของเริ่มต้น (ค่าเริ่มต้น 7) — วัสดุที่ตั้งค่าเองจะใช้ค่าตัวเอง
 *   safetyDays    จำนวนวันสำรอง เพื่อคำนวณ safety stock = ADU × safetyDays (ค่าเริ่มต้น 7)
 *   reviewDays    รอบทบทวน/สั่งซื้อ (ค่าเริ่มต้น 30)
 *   category      กรองเฉพาะหมวดหมู่ (ไม่ระบุ = ทั้งหมด)
 *   onlyNeeded    "1" = แสดงเฉพาะที่ต้องสั่งซื้อ
 */
purchasingRouter.get("/reorder", async (req, res) => {
  try {
    const q = req.query as any;
    const lookbackDays = Math.max(1, parseInt(q.lookbackDays) || 90);
    const defLead = parseInt(q.leadTimeDays) || 7;
    const defSafetyDays = parseInt(q.safetyDays) || 7;
    const reviewDays = parseInt(q.reviewDays) || 30;
    const category = (q.category || "").trim();
    const onlyNeeded = q.onlyNeeded === "1";

    // 1) รายการวัสดุ
    let invQ = db.from("inventory").select("id,code,name,category,unit,quantity,min_quantity,unit_price,location,lead_time_days,safety_stock,avg_daily_usage");
    if (category && category !== "-- All --") invQ = invQ.ilike("category", `%${category}%`);
    const { data: inv, error } = await invQ.order("name", { ascending: true });
    if (error) return res.status(500).json({ error: error.message });

    // 2) ยอดจ่ายจริงย้อนหลังจาก transaction_logs (type = Requisition Issue)
    const since = new Date(Date.now() - lookbackDays * 86400000).toISOString();
    const ids = (inv ?? []).map((i: any) => i.id);
    const usage: Record<string, number> = {};
    if (ids.length) {
      const pageSize = 1000; let from = 0;
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { data: logs } = await db.from("transaction_logs")
          .select("item_id,quantity_change,type,timestamp")
          .eq("type", "Requisition Issue").gte("timestamp", since)
          .in("item_id", ids).range(from, from + pageSize - 1);
        (logs ?? []).forEach((l: any) => { usage[l.item_id] = (usage[l.item_id] || 0) + Math.abs(l.quantity_change || 0); });
        if (!logs || logs.length < pageSize) break;
        from += pageSize;
      }
    }

    const rows = (inv ?? []).map((i: any) => {
      const adu = i.avg_daily_usage != null ? Number(i.avg_daily_usage) : (usage[i.id] || 0) / lookbackDays;
      const lead = i.lead_time_days != null ? i.lead_time_days : defLead;
      const safety = i.safety_stock != null ? i.safety_stock : Math.ceil(adu * defSafetyDays);
      const leadDemand = adu * lead;
      const rop = Math.ceil(leadDemand + safety);
      const orderUpTo = Math.ceil(rop + adu * reviewDays);
      const stock = i.quantity || 0;
      const needToOrder = stock <= rop;
      const suggestedQty = Math.max(0, orderUpTo - stock);
      return {
        id: i.id.toString(), code: i.code, name: i.name, category: i.category || "", unit: i.unit || "",
        location: i.location || "", currentStock: stock, minQuantity: i.min_quantity || 0,
        unitPrice: i.unit_price || 0,
        avgDailyUsage: Math.round(adu * 100) / 100, leadTimeDays: lead, safetyStock: safety,
        reorderPoint: rop, orderUpTo, needToOrder, suggestedQty,
        estimatedCost: suggestedQty * (i.unit_price || 0),
      };
    });

    const result = onlyNeeded ? rows.filter((r) => r.needToOrder) : rows;
    res.json({
      params: { lookbackDays, defLead, defSafetyDays, reviewDays },
      totalItems: rows.length,
      needCount: rows.filter((r) => r.needToOrder).length,
      totalEstimatedCost: result.filter((r) => r.needToOrder).reduce((s, r) => s + r.estimatedCost, 0),
      rows: result,
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

/** อัปเดตพารามิเตอร์จุดสั่งซื้อรายวัสดุ */
purchasingRouter.put("/settings/:id", async (req, res) => {
  const b = req.body ?? {};
  const upd: any = { updated_at: new Date().toISOString() };
  upd.lead_time_days = b.leadTimeDays === "" || b.leadTimeDays == null ? null : parseInt(b.leadTimeDays);
  upd.safety_stock = b.safetyStock === "" || b.safetyStock == null ? null : parseInt(b.safetyStock);
  upd.avg_daily_usage = b.avgDailyUsage === "" || b.avgDailyUsage == null ? null : parseFloat(b.avgDailyUsage);
  const { error } = await db.from("inventory").update(upd).eq("id", req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});
