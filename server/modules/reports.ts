import { Router } from "express";
import { db } from "../supabase";

export const reportsRouter = Router();

// helper: ดึงทั้งหมดแบบแบ่งหน้า (กัน limit 1000 ของ supabase)
async function fetchAll(table: string, select: string, applyFilters?: (q: any) => any) {
  const pageSize = 1000;
  let from = 0;
  const out: any[] = [];
  // eslint-disable-next-line no-constant-condition
  while (true) {
    let q = db.from(table).select(select).range(from, from + pageSize - 1);
    if (applyFilters) q = applyFilters(q);
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    out.push(...(data ?? []));
    if (!data || data.length < pageSize) break;
    from += pageSize;
  }
  return out;
}

// ── 1) รายงานสต๊อกคงคลัง ──────────────────────────────────────
reportsRouter.get("/inventory", async (_req, res) => {
  try {
    const inv = await fetchAll("inventory", "id,code,name,category,unit,quantity,min_quantity,unit_price,location");
    const rows = inv.map((i: any) => ({
      code: i.code, name: i.name, category: i.category || "", unit: i.unit || "",
      quantity: i.quantity || 0, minQuantity: i.min_quantity || 0, unitPrice: i.unit_price || 0,
      totalValue: (i.quantity || 0) * (i.unit_price || 0), location: i.location || "",
      isLow: (i.quantity || 0) <= (i.min_quantity || 0),
    }));
    res.json({ rows, totalValue: rows.reduce((s, r) => s + r.totalValue, 0) });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── 2) รายงานวัสดุต่ำกว่าจุดสั่งซื้อ ───────────────────────────
reportsRouter.get("/low-stock", async (_req, res) => {
  try {
    const inv = await fetchAll("inventory", "code,name,category,unit,quantity,min_quantity,location");
    const rows = inv
      .filter((i: any) => (i.quantity || 0) <= (i.min_quantity || 0))
      .map((i: any) => ({ code: i.code, name: i.name, category: i.category || "", unit: i.unit || "",
        quantity: i.quantity || 0, minQuantity: i.min_quantity || 0, location: i.location || "",
        shortfall: Math.max(0, (i.min_quantity || 0) - (i.quantity || 0)) }));
    res.json({ rows });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── 3) รายงานความเคลื่อนไหวสต๊อก (transaction logs) ───────────
reportsRouter.get("/transactions", async (req, res) => {
  try {
    const { startDate, endDate, type } = req.query as any;
    const logs = await fetchAll(
      "transaction_logs",
      "transaction_id,timestamp,type,reference_no,item_code,item_name,quantity_change,unit,unit_price,value_change,new_stock_quantity,received_by,notes,source",
      (q) => {
        if (startDate) q = q.gte("timestamp", new Date(startDate).toISOString());
        if (endDate) { const e = new Date(endDate); e.setHours(23, 59, 59, 999); q = q.lte("timestamp", e.toISOString()); }
        if (type && type !== "-- All --") q = q.eq("type", type);
        return q.order("timestamp", { ascending: false });
      }
    );
    res.json({ rows: logs.map((l: any) => ({
      transactionId: l.transaction_id, timestamp: l.timestamp, type: l.type, referenceNo: l.reference_no,
      itemCode: l.item_code, itemName: l.item_name, quantityChange: l.quantity_change, unit: l.unit,
      unitPrice: l.unit_price, valueChange: l.value_change, newStockQuantity: l.new_stock_quantity,
      receivedBy: l.received_by, notes: l.notes, source: l.source,
    })) });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── 4) รายงานการเบิกจ่าย (requisitions summary) ───────────────
reportsRouter.get("/requisitions", async (req, res) => {
  try {
    const { startDate, endDate, status, department } = req.query as any;
    const reqs = await fetchAll("requisitions",
      "id,date,requestor_name,requestor_department,status,created_at",
      (q) => {
        if (startDate) q = q.gte("date", startDate);
        if (endDate) q = q.lte("date", endDate);
        if (status && status !== "-- All --") q = q.eq("status", status);
        if (department && department !== "-- All --") q = q.ilike("requestor_department", `%${department}%`);
        return q.order("created_at", { ascending: false });
      }
    );
    res.json({ rows: reqs.map((r: any) => ({
      id: r.id, date: r.date, requestorName: r.requestor_name,
      requestorDepartment: r.requestor_department, status: r.status, createdAt: r.created_at,
    })) });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── 5) รายงานมูลค่าการเบิกตามแผนก ─────────────────────────────
reportsRouter.get("/by-department", async (req, res) => {
  try {
    const { startDate, endDate } = req.query as any;
    const reqs = await fetchAll("requisitions", "id,requestor_department,date,status",
      (q) => {
        if (startDate) q = q.gte("date", startDate);
        if (endDate) q = q.lte("date", endDate);
        return q;
      });
    const reqIds = reqs.map((r: any) => r.id);
    const items = reqIds.length
      ? await fetchAll("requisition_items", "requisition_id,dispensed_quantity,unit_price,total_price", (q) => q.in("requisition_id", reqIds))
      : [];
    const valueByReq: Record<string, number> = {};
    items.forEach((it: any) => {
      const v = it.total_price ?? (it.dispensed_quantity || 0) * (it.unit_price || 0);
      valueByReq[it.requisition_id] = (valueByReq[it.requisition_id] || 0) + v;
    });
    const byDept: Record<string, { count: number; value: number }> = {};
    reqs.forEach((r: any) => {
      const d = r.requestor_department || "ไม่ระบุ";
      byDept[d] ||= { count: 0, value: 0 };
      byDept[d].count += 1;
      byDept[d].value += valueByReq[r.id] || 0;
    });
    res.json({ rows: Object.entries(byDept).map(([department, v]) => ({ department, count: v.count, value: v.value })) });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── 6) รายงานวัสดุที่ถูกเบิกมากที่สุด ─────────────────────────
reportsRouter.get("/top-items", async (req, res) => {
  try {
    const { startDate, endDate } = req.query as any;
    let reqIds: string[] | null = null;
    if (startDate || endDate) {
      const reqs = await fetchAll("requisitions", "id,date", (q) => {
        if (startDate) q = q.gte("date", startDate);
        if (endDate) q = q.lte("date", endDate);
        return q;
      });
      reqIds = reqs.map((r: any) => r.id);
      if (reqIds.length === 0) return res.json({ rows: [] });
    }
    const items = await fetchAll("requisition_items",
      "requisition_id,item_id,item_name,quantity,dispensed_quantity,unit,unit_price,total_price",
      (q) => (reqIds ? q.in("requisition_id", reqIds) : q));
    const agg: Record<string, any> = {};
    items.forEach((it: any) => {
      const k = it.item_id?.toString() || it.item_name;
      agg[k] ||= { itemName: it.item_name, unit: it.unit, totalRequested: 0, totalDispensed: 0, totalValue: 0 };
      agg[k].totalRequested += it.quantity || 0;
      agg[k].totalDispensed += it.dispensed_quantity || 0;
      agg[k].totalValue += it.total_price ?? (it.dispensed_quantity || 0) * (it.unit_price || 0);
    });
    const rows = Object.values(agg).sort((a: any, b: any) => b.totalDispensed - a.totalDispensed).slice(0, 50);
    res.json({ rows });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── 7) รายงานใบเบิกค้างจ่าย (backorders) ──────────────────────
reportsRouter.get("/backorders", async (_req, res) => {
  try {
    const items = await fetchAll("requisition_items",
      "requisition_id,item_id,item_name,quantity,dispensed_quantity,unit,is_backordered",
      (q) => q.eq("is_backordered", true));
    const reqIds = [...new Set(items.map((i: any) => i.requisition_id))];
    const reqs = reqIds.length
      ? await fetchAll("requisitions", "id,requestor_name,requestor_department,date,status", (q) => q.in("id", reqIds))
      : [];
    const reqMap: Record<string, any> = {};
    reqs.forEach((r: any) => (reqMap[r.id] = r));
    const rows = items.map((it: any) => {
      const r = reqMap[it.requisition_id] || {};
      return { requisitionId: it.requisition_id, requestorName: r.requestor_name, department: r.requestor_department,
        date: r.date, status: r.status, itemName: it.item_name, unit: it.unit,
        requested: it.quantity || 0, dispensed: it.dispensed_quantity || 0,
        outstanding: Math.max(0, (it.quantity || 0) - (it.dispensed_quantity || 0)) };
    });
    res.json({ rows });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});
