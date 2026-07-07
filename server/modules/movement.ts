import { Router } from "express";
import { db } from "../supabase";

export const movementRouter = Router();

// ── ค้นหาพัสดุ (โดยชื่อ/รหัส) แล้วคืนประวัติการเคลื่อนไหว ─────────
movementRouter.get("/", async (req, res) => {
  try {
    const q = ((req.query.query as string) || "").trim();
    if (!q) return res.json({ items: [] });

    // 1) หาพัสดุที่ตรงกับคำค้น
    const { data: inv } = await db
      .from("inventory")
      .select("id,code,name,unit,quantity,unit_price,location,category")
      .or(`code.ilike.%${q}%,name.ilike.%${q}%`)
      .limit(20);

    if (!inv || inv.length === 0) return res.json({ items: [] });

    const ids = inv.map((i: any) => i.id);

    // 2) ดึง transaction logs ของพัสดุเหล่านั้น
    const { data: logs } = await db
      .from("transaction_logs")
      .select("transaction_id,timestamp,type,reference_no,item_id,item_code,item_name,quantity_change,unit,unit_price,value_change,new_stock_quantity,received_by,notes,source")
      .in("item_id", ids)
      .order("timestamp", { ascending: false });

    // 3) หาแผนก/ผู้เบิกของ reference (ใบเบิก) เพื่อบอกว่า "จ่ายไปไหน"
    const reqIds = [...new Set((logs ?? []).map((l: any) => l.reference_no).filter((r: string) => r && r.startsWith("REQ")))];
    const reqMap: Record<string, any> = {};
    if (reqIds.length) {
      const { data: reqs } = await db.from("requisitions").select("id,requestor_name,requestor_department").in("id", reqIds);
      (reqs ?? []).forEach((r: any) => (reqMap[r.id] = r));
    }

    const byItem: Record<string, any[]> = {};
    (logs ?? []).forEach((l: any) => {
      const req = reqMap[l.reference_no];
      (byItem[l.item_id] ||= []).push({
        transactionId: l.transaction_id,
        timestamp: l.timestamp,
        type: l.type, // "Goods Receipt" | "Requisition Issue"
        isReceipt: l.type === "Goods Receipt",
        referenceNo: l.reference_no,
        quantityChange: l.quantity_change,
        unit: l.unit,
        unitPrice: l.unit_price,
        valueChange: l.value_change,
        newStockQuantity: l.new_stock_quantity,
        receivedBy: l.received_by,
        notes: l.notes,
        source: l.source,
        toDepartment: req?.requestor_department || null,
        toRequestor: req?.requestor_name || null,
      });
    });

    const items = inv.map((i: any) => {
      const movements = byItem[i.id] || [];
      const totalIn = movements.filter((m) => m.isReceipt).reduce((s, m) => s + Math.abs(m.quantityChange), 0);
      const totalOut = movements.filter((m) => !m.isReceipt).reduce((s, m) => s + Math.abs(m.quantityChange), 0);
      return {
        id: i.id.toString(), code: i.code, name: i.name, unit: i.unit, category: i.category || "",
        location: i.location || "", currentStock: i.quantity, unitPrice: i.unit_price,
        totalIn, totalOut, movements,
      };
    });

    res.json({ items });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});
