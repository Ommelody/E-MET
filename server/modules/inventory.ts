import { Router } from "express";
import { db } from "../supabase";
import { getPublicUrl, uploadFile, deleteFile } from "../lib/storage";
import { generateDailyTransactionId } from "../lib/ids";
import { recordTransaction } from "../lib/transactions";

export const inventoryRouter = Router();

// ── รายการวัสดุทั้งหมด (พร้อม url รูป) ────────────────────────
inventoryRouter.get("/", async (_req, res) => {
  const { data, error } = await db
    .from("inventory")
    .select(
      "id,code,name,category,unit,quantity,min_quantity,max_issue_quantity,unit_price,location,created_at,updated_at,catalog(image_path)"
    )
    .order("name", { ascending: true });
  if (error) return res.status(500).json({ error: error.message });

  const items = (data ?? []).map((it: any) => ({
    id: it.id.toString(),
    code: it.code,
    name: it.name,
    category: it.category || "",
    unit: it.unit || "",
    quantity: it.quantity,
    minQuantity: it.min_quantity,
    maxIssueQuantity: it.max_issue_quantity,
    unitPrice: it.unit_price,
    location: it.location || "",
    createdAt: it.created_at,
    updatedAt: it.updated_at,
    imageUrl: it.catalog?.image_path ? getPublicUrl("catalog-images", it.catalog.image_path) : null,
  }));
  res.json(items);
});

// ── เพิ่มวัสดุ ─────────────────────────────────────────────────
inventoryRouter.post("/", async (req, res) => {
  const b = req.body ?? {};
  const { data: existing } = await db.from("inventory").select("id").eq("code", b.code).maybeSingle();
  if (existing) return res.status(409).json({ error: "รหัสวัสดุนี้มีอยู่แล้ว" });

  const { data, error } = await db
    .from("inventory")
    .insert({
      code: b.code,
      name: b.name,
      category: b.category,
      unit: b.unit,
      quantity: parseInt(b.quantity) || 0,
      min_quantity: parseInt(b.minQuantity) || 0,
      max_issue_quantity: b.maxIssueQuantity === "" || b.maxIssueQuantity == null ? null : parseInt(b.maxIssueQuantity),
      unit_price: parseFloat(b.unitPrice) || 0,
      location: b.location || "",
    })
    .select("id")
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true, id: data.id.toString() });
});

// ── แก้ไขวัสดุ ─────────────────────────────────────────────────
inventoryRouter.put("/:id", async (req, res) => {
  const b = req.body ?? {};
  const { data, error } = await db
    .from("inventory")
    .update({
      code: b.code,
      name: b.name,
      category: b.category,
      unit: b.unit,
      quantity: parseInt(b.quantity) || 0,
      min_quantity: parseInt(b.minQuantity) || 0,
      max_issue_quantity: b.maxIssueQuantity === "" || b.maxIssueQuantity == null ? null : parseInt(b.maxIssueQuantity),
      unit_price: parseFloat(b.unitPrice) || 0,
      location: b.location || "",
      updated_at: new Date().toISOString(),
    })
    .eq("id", req.params.id)
    .select("id");
  if (error) return res.status(500).json({ error: error.message });
  if (!data || data.length === 0) return res.status(404).json({ error: "ไม่พบวัสดุ" });
  res.json({ success: true });
});

// ── ลบวัสดุ ────────────────────────────────────────────────────
inventoryRouter.delete("/:id", async (req, res) => {
  const { error } = await db.from("inventory").delete().eq("id", req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

// ── อัปโหลดรูปวัสดุ (base64) ───────────────────────────────────
inventoryRouter.post("/:id/image", async (req, res) => {
  const id = req.params.id;
  const { base64, mimeType } = req.body ?? {};
  if (!base64) return res.status(400).json({ error: "ไม่มีข้อมูลรูปภาพ" });
  try {
    const ext = (mimeType || "image/jpeg").split("/")[1] || "jpg";
    const path = `catalog/${id}.${ext}`;
    await uploadFile("catalog-images", path, Buffer.from(base64, "base64"), mimeType || "image/jpeg");

    const { data: existing } = await db.from("catalog").select("item_id").eq("item_id", id).maybeSingle();
    if (existing) {
      await db.from("catalog").update({ image_path: path, updated_at: new Date().toISOString() }).eq("item_id", id);
    } else {
      await db.from("catalog").insert({ item_id: parseInt(id), image_path: path });
    }
    res.json({ success: true, imageUrl: getPublicUrl("catalog-images", path) });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── ลบรูปวัสดุ ─────────────────────────────────────────────────
inventoryRouter.delete("/:id/image", async (req, res) => {
  const id = req.params.id;
  const { data: cat } = await db.from("catalog").select("item_id,image_path").eq("item_id", id).maybeSingle();
  if (cat?.image_path) await deleteFile("catalog-images", cat.image_path);
  if (cat) await db.from("catalog").update({ image_path: null, updated_at: new Date().toISOString() }).eq("item_id", id);
  res.json({ success: true });
});

// ============================================================
// ฟังก์ชันใช้ร่วม: ปรับจำนวนสต๊อก + บันทึก transaction
// (ใช้โดยโมดูล requisitions ตอนจ่ายของ)
// ============================================================
export interface InventoryDelta {
  itemId: string | number;
  quantityChange: number;
  requisitionId?: string;
  approvedByUsername?: string;
  itemName?: string;
  unit?: string;
  isBackorderFulfillment?: boolean;
  isAdditionalDispenseInBOFulFillment?: boolean;
}

export async function applyInventoryDeltas(deltas: InventoryDelta[]) {
  if (!deltas || deltas.length === 0) return;
  for (const upd of deltas) {
    if (!upd.quantityChange) continue;
    const { data: inv } = await db
      .from("inventory")
      .select("id,quantity,unit_price,code,name,unit")
      .eq("id", upd.itemId)
      .maybeSingle();
    if (!inv) continue;

    const newQty = Math.max(0, (inv.quantity || 0) + upd.quantityChange);
    await db.from("inventory").update({ quantity: newQty, updated_at: new Date().toISOString() }).eq("id", upd.itemId);

    if (upd.requisitionId && upd.quantityChange !== 0) {
      const noteSuffix = upd.isBackorderFulfillment
        ? " (Backorder Fulfillment)"
        : upd.isAdditionalDispenseInBOFulFillment
        ? " (Additional in BO Fulfillment)"
        : "";
      const txnId = await generateDailyTransactionId("TRN");
      await recordTransaction({
        transactionId: txnId,
        type: "Requisition Issue",
        referenceNo: upd.requisitionId,
        itemId: upd.itemId,
        itemCode: inv.code,
        itemName: upd.itemName || inv.name,
        quantityChange: upd.quantityChange,
        unit: upd.unit || inv.unit,
        unitPrice: inv.unit_price,
        valueChange: upd.quantityChange * inv.unit_price,
        newStockQuantity: newQty,
        receivedBy: upd.approvedByUsername,
        notes: "Issued for Requisition " + upd.requisitionId + noteSuffix,
        source: "System (Requisition)",
      });
    }
  }
}
