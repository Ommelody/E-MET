import { Router } from "express";
import { db } from "../supabase";

export const reportsRouter = Router();

// ── ดึงทั้งหมดแบบแบ่งหน้า (กัน limit 1000 ของ supabase) ──────────
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

async function buildInvMap(itemIds: any[]) {
  const ids = [...new Set(itemIds.filter(Boolean))];
  if (!ids.length) return {} as Record<string, any>;
  const rows = await fetchAll("inventory", "id,code,location,quantity,unit,unit_price", (q) => q.in("id", ids));
  const map: Record<string, any> = {};
  rows.forEach((r: any) => (map[r.id.toString()] = r));
  return map;
}

// กรองใบเบิกตามช่วงวันที่ (บน req.date) + เวลาบน created_at
function withinDateRange(dateStr: string, startDate?: string, endDate?: string) {
  if (startDate && dateStr < startDate) return false;
  if (endDate && dateStr > endDate) return false;
  return true;
}
function withinDateTime(createdAt: string, startDate?: string, endDate?: string, startTime?: string, endTime?: string) {
  if (!createdAt) return true;
  const d = new Date(createdAt);
  if (startDate) {
    const s = new Date(`${startDate}T${startTime || "00:00"}:00`);
    if (d < s) return false;
  }
  if (endDate) {
    const e = new Date(`${endDate}T${endTime || "23:59"}:59`);
    if (d > e) return false;
  }
  return true;
}

async function loadReqsWithItems(statusFilter: (s: string) => boolean, filters: any, useDateTime = false) {
  const reqs = await fetchAll("requisitions", "*", (q) => q.order("created_at", { ascending: false }));
  const filtered = reqs.filter((r: any) => {
    if (!statusFilter(r.status)) return false;
    if (filters.department && r.requestor_department !== filters.department) return false;
    if (useDateTime) return withinDateTime(r.created_at, filters.startDate, filters.endDate, filters.startTime, filters.endTime);
    return withinDateRange(r.date, filters.startDate, filters.endDate);
  });
  const ids = filtered.map((r: any) => r.id);
  const items = ids.length ? await fetchAll("requisition_items", "*", (q) => q.in("requisition_id", ids)) : [];
  const invMap = await buildInvMap(items.map((i: any) => i.item_id));
  const byReq: Record<string, any[]> = {};
  items.forEach((it: any) => (byReq[it.requisition_id] ||= []).push(it));
  return { reqs: filtered, byReq, invMap };
}

// ── 1) ใบจ่ายพัสดุสำเร็จ (Approved & Issued) ───────────────────
reportsRouter.get("/approvedIssued", async (req, res) => {
  try {
    const f = req.query as any;
    const { reqs, byReq, invMap } = await loadReqsWithItems(
      (s) => s === "Completed" || s === "Partially Completed",
      f
    );
    const rows: any[] = [];
    reqs.forEach((r: any) => {
      (byReq[r.id] || []).forEach((it: any) => {
        const disp = it.dispensed_quantity || 0;
        if (disp <= 0) return;
        const inv = invMap[it.item_id?.toString()] || {};
        rows.push({
          requisitionId: r.id, requisitionDate: r.date, department: r.requestor_department,
          requestorName: r.requestor_name, itemCode: inv.code || "N/A", itemName: it.item_name,
          dispensedQuantity: disp, unit: it.unit, unitPrice: it.unit_price || 0,
          totalValue: disp * (it.unit_price || 0), approvedBy: r.stock_approver_name || "-",
        });
      });
    });
    res.json(rows);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── 2) ใบเบิกถูกปฏิเสธ/ไม่อนุมัติ ──────────────────────────────
reportsRouter.get("/cancelledRejected", async (req, res) => {
  try {
    const f = req.query as any;
    const { reqs, byReq, invMap } = await loadReqsWithItems(
      (s) => s === "Rejected by Manager" || s === "Rejected by Stock",
      f
    );
    const rows: any[] = [];
    reqs.forEach((r: any) => {
      const rejectedBy = r.status === "Rejected by Manager" ? (r.manager_approver_name || "-") : (r.stock_approver_name || "-");
      (byReq[r.id] || []).forEach((it: any) => {
        const inv = invMap[it.item_id?.toString()] || {};
        rows.push({
          requisitionId: r.id, requisitionDate: r.date, department: r.requestor_department,
          requestorName: r.requestor_name, itemCode: inv.code || "N/A", itemName: it.item_name,
          requestedQuantity: it.quantity, unit: it.unit, rejectedBy, status: r.status,
        });
      });
    });
    res.json(rows);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── 3) ใบอนุมัติเบิกเกินยอดสต๊อกคลัง (Overstock) ───────────────
reportsRouter.get("/potentialOverStock", async (req, res) => {
  try {
    const f = req.query as any;
    const { reqs, byReq, invMap } = await loadReqsWithItems(
      (s) => s === "Pending Stock Approval" || s === "Pending Manager Approval",
      f
    );
    const rows: any[] = [];
    reqs.forEach((r: any) => {
      (byReq[r.id] || []).forEach((it: any) => {
        const inv = invMap[it.item_id?.toString()] || {};
        const stock = inv.quantity ?? 0;
        if ((it.quantity || 0) <= stock) return; // เฉพาะที่เกินสต๊อก
        rows.push({
          requisitionId: r.id, requisitionDate: r.date, department: r.requestor_department,
          requestorName: r.requestor_name, itemCode: inv.code || "N/A", itemName: it.item_name,
          requestedQuantity: it.quantity, currentStock: stock, unit: it.unit, status: r.status,
        });
      });
    });
    res.json(rows);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── 4) รายการค้างจ่ายตกค้าง (Current Backorders) ──────────────
reportsRouter.get("/backorderedItems", async (req, res) => {
  try {
    const f = req.query as any;
    const { reqs, byReq, invMap } = await loadReqsWithItems(
      (s) => s === "Partially Completed",
      f
    );
    const rows: any[] = [];
    reqs.forEach((r: any) => {
      (byReq[r.id] || []).forEach((it: any) => {
        if (!it.is_backordered) return;
        const inv = invMap[it.item_id?.toString()] || {};
        rows.push({
          requisitionId: r.id, requisitionDate: r.date, department: r.requestor_department,
          requestorName: r.requestor_name, itemCode: inv.code || "N/A", itemName: it.item_name,
          backorderedQuantity: Math.max(0, (it.quantity || 0) - (it.dispensed_quantity || 0)),
          unit: it.unit, itemNote: it.notes_for_item || "",
        });
      });
    });
    res.json(rows);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── 5) จัดจ่ายค้างจ่ายแล้ว (Fulfilled Backorders Log) ─────────
reportsRouter.get("/fulfilledBackorders", async (req, res) => {
  try {
    const f = req.query as any;
    const logs = await fetchAll(
      "transaction_logs",
      "transaction_id,timestamp,type,reference_no,item_code,item_name,quantity_change,unit,received_by,notes",
      (q) => q.eq("type", "Requisition Issue").ilike("notes", "%Backorder Fulfillment%").order("timestamp", { ascending: false })
    );
    // map req department/requestor
    const reqIds = [...new Set(logs.map((l: any) => l.reference_no).filter(Boolean))];
    const reqs = reqIds.length ? await fetchAll("requisitions", "id,requestor_name,requestor_department", (q) => q.in("id", reqIds)) : [];
    const reqMap: Record<string, any> = {};
    reqs.forEach((r: any) => (reqMap[r.id] = r));
    const rows = logs
      .filter((l: any) => withinDateTime(l.timestamp, f.startDate, f.endDate, f.startTime, f.endTime))
      .filter((l: any) => !f.department || reqMap[l.reference_no]?.requestor_department === f.department)
      .map((l: any) => {
        const r = reqMap[l.reference_no] || {};
        return {
          requisitionId: l.reference_no, fulfillmentDate: l.timestamp, department: r.requestor_department || "-",
          requestorName: r.requestor_name || "-", itemCode: l.item_code, itemName: l.item_name,
          fulfilledQuantity: Math.abs(l.quantity_change || 0), unit: l.unit,
          fulfilledBy: l.received_by || "-", itemNote: l.notes || "",
        };
      });
    res.json(rows);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── 6) สรุปใบเบิกจ่ายรายวัน (Daily Log) ────────────────────────
reportsRouter.get("/dailyRequisition", async (req, res) => {
  try {
    const f = req.query as any;
    const { reqs, byReq, invMap } = await loadReqsWithItems(() => true, f, true);
    const rows: any[] = [];
    reqs.forEach((r: any) => {
      const creationTime = r.created_at
        ? new Date(r.created_at).toLocaleString("th-TH", { dateStyle: "short", timeStyle: "short" })
        : "-";
      (byReq[r.id] || []).forEach((it: any) => {
        const inv = invMap[it.item_id?.toString()] || {};
        rows.push({
          requisitionId: r.id, creationTime, department: r.requestor_department,
          requestorName: r.requestor_name, itemCode: inv.code || "N/A", itemName: it.item_name,
          requestedQuantity: it.quantity, dispensedQuantity: it.dispensed_quantity ?? null,
          itemIsBackordered: it.is_backordered ? "Yes" : "No", status: r.status,
        });
      });
    });
    res.json(rows);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── 7) พัสดุในคลังทั้งหมด (Stock balance) ───────────────────────
reportsRouter.get("/inventoryStock", async (req, res) => {
  try {
    const f = req.query as any;
    const inv = await fetchAll("inventory", "id,code,name,category,unit,quantity,min_quantity,unit_price,location,updated_at");
    const rows = inv
      .filter((i: any) => !f.category || (i.category || "").toLowerCase().includes(String(f.category).toLowerCase()))
      .filter((i: any) => !f.location || (i.location || "").toLowerCase().includes(String(f.location).toLowerCase()))
      .sort((a: any, b: any) => (a.name || "").localeCompare(b.name || ""))
      .map((i: any) => ({
        "ID": i.id, "รหัส": i.code, "ชื่อวัสดุ": i.name, "หมวดหมู่": i.category || "",
        "ที่ตั้ง": i.location || "", "คงเหลือ": i.quantity || 0, "หน่วย": i.unit || "",
        "Min Stock": i.min_quantity || 0, "ราคา/หน่วย": i.unit_price || 0,
        "มูลค่ารวม": (i.quantity || 0) * (i.unit_price || 0), "อัปเดตล่าสุด": i.updated_at,
      }));
    res.json(rows);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── รายงานด่วน (แสดงด้านบนหน้ารายงานทันที ไม่ต้องกรอง) ─────────
reportsRouter.get("/quick", async (req, res) => {
  try {
    const days = parseInt((req.query.days as string) || "30");
    const since = new Date(Date.now() - days * 86400000).toISOString();

    const recent = await fetchAll(
      "transaction_logs",
      "transaction_id,timestamp,type,reference_no,item_code,item_name,quantity_change,unit,received_by",
      (q) => q.gte("timestamp", since).order("timestamp", { ascending: false })
    );
    const reqs = await fetchAll("requisitions", "id,requestor_department,created_at", (q) => q.gte("created_at", since));
    const reqIds = reqs.map((r: any) => r.id);
    const items = reqIds.length ? await fetchAll("requisition_items", "requisition_id,item_name,dispensed_quantity,unit,unit_price", (q) => q.in("requisition_id", reqIds)) : [];

    const itemAgg: Record<string, any> = {};
    items.forEach((it: any) => {
      itemAgg[it.item_name] ||= { itemName: it.item_name, unit: it.unit, count: 0, totalDispensed: 0, value: 0 };
      itemAgg[it.item_name].count += 1;
      itemAgg[it.item_name].totalDispensed += it.dispensed_quantity || 0;
      itemAgg[it.item_name].value += (it.dispensed_quantity || 0) * (it.unit_price || 0);
    });
    const depAgg: Record<string, any> = {};
    const valueByReq: Record<string, number> = {};
    items.forEach((it: any) => { valueByReq[it.requisition_id] = (valueByReq[it.requisition_id] || 0) + (it.dispensed_quantity || 0) * (it.unit_price || 0); });
    reqs.forEach((r: any) => { const d = r.requestor_department || "ไม่ระบุ"; depAgg[d] ||= { count: 0, value: 0 }; depAgg[d].count += 1; depAgg[d].value += valueByReq[r.id] || 0; });

    const totalValue = items.reduce((s: number, it: any) => s + (it.dispensed_quantity || 0) * (it.unit_price || 0), 0);

    res.json({
      days,
      recentMovements: recent.slice(0, 12).map((l: any) => ({
        timestamp: l.timestamp, type: l.type, isReceipt: l.type === "Goods Receipt",
        itemCode: l.item_code, itemName: l.item_name, quantityChange: l.quantity_change,
        unit: l.unit, referenceNo: l.reference_no, receivedBy: l.received_by,
      })),
      summary: { totalRequisitions: reqs.length, totalValue, receiptCount: recent.filter((l: any) => l.type === "Goods Receipt").length, issueCount: recent.filter((l: any) => l.type === "Requisition Issue").length },
      topItems: Object.values(itemAgg).sort((a: any, b: any) => b.count - a.count).slice(0, 8),
      topDepartments: Object.entries(depAgg).map(([department, v]: any) => ({ department, count: v.count, value: v.value })).sort((a, b) => b.count - a.count).slice(0, 8),
    });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});
