import { Router } from "express";
import { db } from "../supabase";
import { generateRequisitionId, generateGoodsIssueId } from "../lib/ids";
import { applyInventoryDeltas } from "./inventory";
import { mapRequisitionRow, mapItemRow, docViewUrl } from "../lib/mappers";
import {
  generateRequisitionFormPDF,
  generateGoodsIssuePDF,
  updateRequisitionPdf,
} from "../lib/pdf";

export const requisitionsRouter = Router();

const STAFF_ROLES = ["Admin", "Manager", "Staff"];

// ── สร้างใบเบิก ────────────────────────────────────────────────
async function createRequisition(reqData: any, itemsData: any[]) {
  const requisitionId = await generateRequisitionId();
  const now = new Date().toISOString();
  const initialStatus = "Pending Manager Approval";

  const itemIds = itemsData.map((i) => i.itemId);
  const { data: invRows } = itemIds.length
    ? await db.from("inventory").select("id,code,name,unit,unit_price,location,quantity").in("id", itemIds)
    : { data: [] as any[] };
  const invMap: Record<string, any> = {};
  (invRows ?? []).forEach((r: any) => (invMap[r.id.toString()] = r));

  const reqItemsForPdf = itemsData.map((it) => {
    const inv = invMap[it.itemId.toString()] || {};
    const qty = parseInt(it.quantity) || 0;
    const price = inv.unit_price || 0;
    return {
      itemId: it.itemId, itemName: it.itemName, quantity: qty, unit: it.unit,
      itemCode: inv.code || "N/A", location: inv.location || "N/A", UnitPrice: price,
    };
  });

  let pdfPath: string | null = null;
  try {
    const grand = reqItemsForPdf.reduce((s, it) => s + it.quantity * (it.UnitPrice || 0), 0);
    pdfPath = await generateRequisitionFormPDF(
      requisitionId,
      { id: requisitionId, date: reqData.date, purpose: reqData.purpose, requestorName: reqData.requestorName,
        requestorDepartment: reqData.requestorDepartment, status: initialStatus, createdAt: now },
      reqItemsForPdf, grand
    );
  } catch { /* non-fatal */ }

  const { error: reqErr } = await db.from("requisitions").insert({
    id: requisitionId, date: reqData.date, purpose: reqData.purpose,
    requested_by: reqData.requestedBy, requestor_name: reqData.requestorName,
    requestor_department: reqData.requestorDepartment, status: initialStatus,
    requisition_pdf_path: pdfPath, created_at: now, updated_at: now,
  });
  if (reqErr) throw new Error(reqErr.message);

  const itemRows = itemsData.map((it) => {
    const inv = invMap[it.itemId.toString()] || {};
    return {
      requisition_id: requisitionId, item_id: parseInt(it.itemId), item_name: it.itemName,
      quantity: parseInt(it.quantity) || 0, unit: it.unit, dispensed_quantity: 0,
      unit_price: inv.unit_price || 0, is_backordered: false, notes_for_item: "",
    };
  });
  const { error: itErr } = await db.from("requisition_items").insert(itemRows);
  if (itErr) throw new Error(itErr.message);

  return { success: true, requisitionId };
}

// ── รายการใบเบิก (มี filter + จำกัดสิทธิ์) ─────────────────────
async function getRequisitions(filters: any, username: string, role: string) {
  filters = filters || {};
  let q = db.from("requisitions").select("*").order("created_at", { ascending: false });

  if (role && !STAFF_ROLES.includes(role)) q = q.eq("requested_by", username);
  if (filters.id) q = q.ilike("id", `%${filters.id}%`);
  if (filters.requestorName) q = q.ilike("requestor_name", `%${filters.requestorName}%`);
  if (filters.department && filters.department.trim() && filters.department !== "-- All --")
    q = q.ilike("requestor_department", `%${filters.department}%`);
  if (filters.status && filters.status.trim() && filters.status !== "-- All --")
    q = q.eq("status", filters.status);
  if (filters.startDate) q = q.gte("date", filters.startDate);
  if (filters.endDate) q = q.lte("date", filters.endDate);

  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return Promise.all((data ?? []).map((row) => mapRequisitionRow(row)));
}

// ── รายละเอียดใบเบิก + รายการ ─────────────────────────────────
async function getRequisitionDetails(reqId: string) {
  const { data: req } = await db.from("requisitions").select("*").eq("id", reqId).maybeSingle();
  if (!req) return null;
  const { data: items } = await db.from("requisition_items").select("*").eq("requisition_id", reqId);
  const itemIds = (items ?? []).map((i: any) => i.item_id);
  const { data: invRows } = itemIds.length
    ? await db.from("inventory").select("id,code,name,unit,unit_price,location,quantity").in("id", itemIds)
    : { data: [] as any[] };
  const invMap: Record<string, any> = {};
  (invRows ?? []).forEach((r: any) => (invMap[r.id.toString()] = { code: r.code, location: r.location, quantity: r.quantity, unit_price: r.unit_price }));

  const mappedReq = await mapRequisitionRow(req);
  return { requisition: mappedReq, items: (items ?? []).map((it: any) => mapItemRow(it, invMap)) };
}

// ── ใบเบิกที่รออนุมัติตามสิทธิ์ ────────────────────────────────
async function getPendingApprovals(_username: string, role: string) {
  const statuses: string[] = [];
  if (role === "Manager" || role === "Admin") statuses.push("Pending Manager Approval");
  if (["Staff", "Manager", "Admin"].includes(role)) statuses.push("Pending Stock Approval");
  if (role === "Admin" || role === "Staff") statuses.push("Partially Completed");
  if (statuses.length === 0) return [];

  const { data } = await db.from("requisitions").select("*").in("status", statuses).order("created_at", { ascending: true });
  const seen: Record<string, boolean> = {};
  const rows = (data ?? []).filter((r: any) => (seen[r.id] ? false : (seen[r.id] = true)));
  return Promise.all(rows.map((r) => mapRequisitionRow(r)));
}

// ── ดึงใบเบิกสำหรับหน้าอนุมัติแบบชุด (พร้อมรายการ + สต๊อกปัจจุบัน) ──
async function getRequisitionsForBatchApproval(filters: any, user: any) {
  if (!user || !STAFF_ROLES.includes(user.role)) return { error: true, message: "Unauthorized access." };
  let statusFilter: string;
  if (filters.level === "manager") {
    if (!["Admin", "Manager"].includes(user.role)) return [];
    statusFilter = "Pending Manager Approval";
  } else if (filters.level === "stock") {
    statusFilter = "Pending Stock Approval";
  } else return [];

  let q = db.from("requisitions").select("*").eq("status", statusFilter).order("created_at", { ascending: true });
  if (filters.startDate) q = q.gte("date", filters.startDate);
  if (filters.endDate) q = q.lte("date", filters.endDate);
  const { data: rows } = await q;

  const mapped = await Promise.all((rows ?? []).map((r) => mapRequisitionRow(r)));
  const reqIds = mapped.map((r) => r.id);
  if (reqIds.length) {
    const { data: allItems } = await db.from("requisition_items").select("*").in("requisition_id", reqIds);
    const itemIds = [...new Set((allItems ?? []).map((i: any) => i.item_id))];
    const { data: invRows } = itemIds.length
      ? await db.from("inventory").select("id,code,unit,unit_price,location,quantity").in("id", itemIds)
      : { data: [] as any[] };
    const invMap: Record<string, any> = {};
    (invRows ?? []).forEach((r: any) => {
      const p = { code: r.code, location: r.location, quantity: r.quantity, unit_price: r.unit_price };
      invMap[r.id.toString()] = p;
    });
    const byReq: Record<string, any[]> = {};
    (allItems ?? []).forEach((it: any) => {
      (byReq[it.requisition_id] ||= []).push(mapItemRow(it, invMap));
    });
    mapped.forEach((r) => (r.items = byReq[r.id] || []));
  }
  return mapped;
}

// ── หัวใจ: อนุมัติ/จ่ายของ 1 ใบ ────────────────────────────────
async function approveRequisition(
  requisitionId: string, approverUsername: string, approvalLevel: string,
  approvalDecision: string, notes: string, clientDispensedItemsData: any[]
) {
  const now = new Date().toISOString();
  const { data: req } = await db.from("requisitions").select("*").eq("id", requisitionId).maybeSingle();
  if (!req) return { success: false, message: "ไม่พบใบเบิก" };
  const originalStatus = req.status;

  const { data: approver } = await db.from("users").select("username,name").eq("username", approverUsername).maybeSingle();
  if (!approver) return { success: false, message: "ไม่พบข้อมูลผู้อนุมัติ" };

  const isManagerStep = approvalLevel === "manager" && originalStatus === "Pending Manager Approval";
  const isStockStep = approvalLevel === "stock" && originalStatus === "Pending Stock Approval";
  const isFulfillBackorder = approvalLevel === "fulfill_backorder" && originalStatus === "Partially Completed";
  const isFinalDispenseStep = isStockStep || isFulfillBackorder;

  const inventoryDeltas: any[] = [];
  let hasDispensedItems = false;

  if (approvalDecision === "Approved" && clientDispensedItemsData?.length) {
    const { data: allItems } = await db.from("requisition_items").select("*").eq("requisition_id", requisitionId);
    for (const ci of clientDispensedItemsData) {
      const sheetItem = (allItems ?? []).find((x: any) => x.item_id.toString() === ci.itemId.toString());
      if (!sheetItem) continue;
      const qtyThis = parseInt(ci.dispensedQuantity) || 0;
      const newCumulative = isFulfillBackorder ? (sheetItem.dispensed_quantity || 0) + qtyThis : qtyThis;
      const requestedQty = sheetItem.quantity || 0;
      const stillBO = ci.isBackordered || newCumulative < requestedQty;

      await db.from("requisition_items").update({
        dispensed_quantity: newCumulative, is_backordered: stillBO,
        notes_for_item: ci.itemNote || sheetItem.notes_for_item || "",
      }).eq("id", sheetItem.id);

      if (isFinalDispenseStep && qtyThis > 0) {
        hasDispensedItems = true;
        inventoryDeltas.push({
          itemId: sheetItem.item_id.toString(), quantityChange: -qtyThis, requisitionId,
          approvedByUsername: approverUsername, itemName: sheetItem.item_name, unit: sheetItem.unit,
          isBackorderFulfillment: isFulfillBackorder,
          isAdditionalDispenseInBOFulFillment: isFulfillBackorder && !ci.isBackordered,
        });
      }
    }
  }

  let newStatus = originalStatus;
  const upd: any = { updated_at: now };

  if (isFulfillBackorder) {
    if (approvalDecision !== "Approved") return { success: false, message: "การดำเนินการกับรายการค้างจ่ายต้องเป็น 'อนุมัติ'" };
    const { data: after } = await db.from("requisition_items").select("is_backordered").eq("requisition_id", requisitionId);
    const stillBO = (after ?? []).some((i: any) => i.is_backordered === true);
    newStatus = stillBO ? "Partially Completed" : "Completed";
    const existing = req.stock_approval_note || "";
    const note = `Fulfilled backorder by ${approver.name} on ${new Date().toLocaleString("th-TH")}. ${(notes || "").trim()}`;
    upd.stock_approval_note = existing ? existing + "\n" + note : note;
  } else if (isManagerStep) {
    Object.assign(upd, {
      manager_approver_username: approverUsername, manager_approver_name: approver.name,
      manager_approval_status: approvalDecision, manager_approval_date: now, manager_approval_note: notes || "",
    });
    newStatus = approvalDecision === "Approved" ? "Pending Stock Approval" : "Rejected by Manager";
  } else if (isStockStep) {
    Object.assign(upd, {
      stock_approver_username: approverUsername, stock_approver_name: approver.name,
      stock_approval_status: approvalDecision, stock_approval_date: now, stock_approval_note: notes || "",
    });
    if (approvalDecision === "Approved") {
      const { data: after } = await db.from("requisition_items").select("is_backordered").eq("requisition_id", requisitionId);
      newStatus = (after ?? []).some((i: any) => i.is_backordered === true) ? "Partially Completed" : "Completed";
    } else newStatus = "Rejected by Stock";
  } else if (approvalDecision === "Rejected") {
    if (approvalLevel === "manager") {
      Object.assign(upd, { manager_approver_username: approverUsername, manager_approver_name: approver.name,
        manager_approval_status: "Rejected", manager_approval_date: now, manager_approval_note: notes || "" });
      newStatus = "Rejected by Manager";
    } else if (approvalLevel === "stock") {
      Object.assign(upd, { stock_approver_username: approverUsername, stock_approver_name: approver.name,
        stock_approval_status: "Rejected", stock_approval_date: now, stock_approval_note: notes || "" });
      newStatus = "Rejected by Stock";
    }
  } else {
    return { success: false, message: "ระดับการอนุมัติหรือสถานะของใบเบิกไม่ถูกต้อง" };
  }
  upd.status = newStatus;

  if (isFinalDispenseStep && approvalDecision === "Approved" && inventoryDeltas.length) {
    await applyInventoryDeltas(inventoryDeltas);
  }

  // สร้างใบจ่าย (GI) เมื่อมีการจ่ายจริง
  if (isFinalDispenseStep && approvalDecision === "Approved" && hasDispensedItems) {
    try {
      const { data: allItemsForPdf } = await db.from("requisition_items").select("*").eq("requisition_id", requisitionId);
      const itemsForGi: any[] = [];
      for (const ci of clientDispensedItemsData) {
        const base = (allItemsForPdf ?? []).find((x: any) => x.item_id.toString() === ci.itemId.toString());
        const { data: invDetail } = await db.from("inventory").select("id,code,location,quantity").eq("id", ci.itemId).maybeSingle();
        itemsForGi.push({
          itemId: ci.itemId, itemName: ci.itemName || base?.item_name || "",
          quantity: base?.quantity || 0, unit: ci.unit || base?.unit || "",
          UnitPrice: base?.unit_price || 0, dispensedQuantity: parseInt(ci.dispensedQuantity) || 0,
          isBackordered: ci.isBackordered, itemCode: invDetail?.code || "N/A",
          location: invDetail?.location || "N/A", currentInventoryQuantity: invDetail?.quantity ?? 0,
          notesForItem: ci.itemNote || "",
        });
      }
      const giPrefix = isFulfillBackorder ? "GI2" : "GI1";
      const goodsIssueId = await generateGoodsIssueId(giPrefix);
      const title = isFulfillBackorder ? "ใบจ่ายวัสดุค้างจ่าย" : "ใบจ่ายวัสดุ";
      const header = { id: req.id, date: req.date, purpose: req.purpose, requestorName: req.requestor_name,
        requestorDepartment: req.requestor_department, status: newStatus, goodsIssueId, stockApproverName: approver.name };
      const giPath = await generateGoodsIssuePDF(header, itemsForGi, title);
      if (giPath) {
        const raw = req.goods_issue_pdf_links;
        const links = raw ? (typeof raw === "string" ? JSON.parse(raw) : raw) : [];
        links.push({ id: goodsIssueId, path: giPath, type: giPrefix, date: now, issuedBy: approver.name });
        upd.goods_issue_pdf_links = links;
      }
    } catch (e) { console.warn("GI PDF failed:", e); }
  }

  await db.from("requisitions").update(upd).eq("id", requisitionId);
  await updateRequisitionPdf(requisitionId);
  return { success: true, newStatus };
}

// ── batch approve (ทั้งใบ) ─────────────────────────────────────
async function processBatchApproval(requisitionIds: string[], approver: string, level: string, decision: string, notes: string, customDraft?: Record<string, any[]>) {
  if (!requisitionIds?.length) return { success: false, message: "No requisition IDs provided." };
  let processed = 0;
  for (const rid of requisitionIds) {
    let dispensed: any[] = [];
    if (customDraft?.[rid]) dispensed = customDraft[rid];
    else if (decision === "Approved") {
      const { data: items } = await db.from("requisition_items").select("*").eq("requisition_id", rid);
      if (level === "stock") {
        const itemIds = (items ?? []).map((i: any) => i.item_id);
        const { data: invRows } = itemIds.length ? await db.from("inventory").select("id,quantity").in("id", itemIds) : { data: [] as any[] };
        const stock: Record<string, number> = {};
        (invRows ?? []).forEach((r: any) => (stock[r.id.toString()] = r.quantity || 0));
        (items ?? []).forEach((it: any) => {
          const cur = stock[it.item_id.toString()] || 0;
          const toDispense = Math.min(it.quantity || 0, cur);
          dispensed.push({ itemId: it.item_id.toString(), itemName: it.item_name, unit: it.unit,
            dispensedQuantity: toDispense, isBackordered: toDispense < (it.quantity || 0), itemNote: it.notes_for_item || "Batch Approved" });
        });
      } else if (level === "manager") {
        (items ?? []).forEach((it: any) => dispensed.push({ itemId: it.item_id.toString(), itemName: it.item_name, unit: it.unit, dispensedQuantity: it.quantity || 0, isBackordered: false, itemNote: it.notes_for_item || "" }));
      }
    }
    const r = await approveRequisition(rid, approver, level, decision, notes, dispensed);
    if (!r.success) return { success: false, message: `ใบเบิก #${rid}: ${r.message}` };
    processed++;
  }
  return { success: true, processedCount: processed };
}

// ── batch approve (รายการต่อรายการ) ───────────────────────────
async function processBatchApprovalByItem(decisions: any[], approver: string, notes: string) {
  if (!decisions?.length) return { success: false, message: "No decisions provided." };
  const byReq: Record<string, any[]> = {};
  decisions.forEach((d) => (byReq[d.requisitionId] ||= []).push(d));
  let processed = 0;
  for (const rid of Object.keys(byReq)) {
    const clientItems = byReq[rid].map((d) => ({
      itemId: d.itemId.toString(), itemName: d.itemName || "", unit: d.unit || "",
      dispensedQuantity: parseInt(d.dispensedQty) || 0, isBackordered: d.isBackordered || false,
      itemNote: d.note || "By-item batch dispatch",
    }));
    const r = await approveRequisition(rid, approver, "stock", "Approved", notes || `By-item batch by ${approver}`, clientItems);
    if (!r.success) return { success: false, message: `REQ ${rid}: ${r.message}` };
    processed++;
  }
  return { success: true, processedCount: processed };
}

// ── บังคับปิดใบเบิก (Manager/Admin) ───────────────────────────
async function manuallyComplete(reqId: string, user: any) {
  if (!user || !["Admin", "Manager"].includes(user.role)) return { success: false, message: "Unauthorized" };
  const { data: req } = await db.from("requisitions").select("id,status,manager_approval_note").eq("id", reqId).maybeSingle();
  if (!req) return { success: false, message: "ไม่พบใบเบิก" };
  if (req.status !== "Partially Completed") return { success: false, message: "ใบเบิกไม่ได้อยู่สถานะ 'จ่ายบางส่วน'" };
  const note = `Manually force-completed by ${user.name} on ${new Date().toLocaleString("th-TH")}`;
  const existing = req.manager_approval_note || "";
  await db.from("requisitions").update({
    status: "Completed", manager_approval_note: existing ? existing + "\n" + note : note, updated_at: new Date().toISOString(),
  }).eq("id", reqId);
  await updateRequisitionPdf(reqId);
  return { success: true, newStatus: "Completed" };
}

// ============================================================ ROUTES
requisitionsRouter.post("/", async (req, res) => {
  try {
    const { requisition, items } = req.body ?? {};
    res.json(await createRequisition(requisition, items || []));
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

requisitionsRouter.get("/", async (req, res) => {
  try {
    const { username = "", role = "", ...filters } = req.query as any;
    res.json(await getRequisitions(filters, username, role));
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

requisitionsRouter.get("/pending", async (req, res) => {
  try {
    const { username = "", role = "" } = req.query as any;
    res.json(await getPendingApprovals(username, role));
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

requisitionsRouter.post("/batch/list", async (req, res) => {
  try { res.json(await getRequisitionsForBatchApproval(req.body?.filters || {}, req.body?.user)); }
  catch (e: any) { res.status(500).json({ error: e.message }); }
});

requisitionsRouter.post("/batch/approve", async (req, res) => {
  try {
    const b = req.body ?? {};
    res.json(await processBatchApproval(b.requisitionIds, b.approverUsername, b.approvalLevel, b.approvalDecision, b.notes, b.customDraftItems));
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

requisitionsRouter.post("/batch/by-item", async (req, res) => {
  try {
    const b = req.body ?? {};
    res.json(await processBatchApprovalByItem(b.decisions, b.approverUsername, b.notes));
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

requisitionsRouter.get("/:id", async (req, res) => {
  try {
    const details = await getRequisitionDetails(req.params.id);
    if (!details) return res.status(404).json({ error: "ไม่พบใบเบิก" });
    res.json(details);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

requisitionsRouter.post("/:id/approve", async (req, res) => {
  try {
    const b = req.body ?? {};
    res.json(await approveRequisition(req.params.id, b.approverUsername, b.approvalLevel, b.approvalDecision, b.notes, b.dispensedItems || []));
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

requisitionsRouter.post("/:id/complete", async (req, res) => {
  try { res.json(await manuallyComplete(req.params.id, req.body?.user)); }
  catch (e: any) { res.status(500).json({ error: e.message }); }
});

export { docViewUrl };
