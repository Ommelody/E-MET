import { Router } from "express";
import { db } from "../supabase";
import { generateDailyTransactionId } from "../lib/ids";
import { recordTransaction } from "../lib/transactions";

export const goodsReceiptRouter = Router();

goodsReceiptRouter.get("/template", (_req, res) => {
  res.json(["ItemCode", "QuantityReceived", "UnitPrice"]);
});

goodsReceiptRouter.post("/", async (req, res) => {
  const info = req.body ?? {};
  const items = info.items || [];
  if (!items.length) return res.status(400).json({ error: "No items provided." });

  try {
    const { data: allInv } = await db.from("inventory").select("id,code,name,unit,quantity,unit_price");
    const byCode: Record<string, any> = {};
    (allInv ?? []).forEach((r: any) => (byCode[r.code.trim().toLowerCase()] = r));

    const results: any[] = [];
    let hadError = false;

    for (const item of items) {
      const code = String(item.itemCode).trim().toLowerCase();
      const inv = byCode[code];
      if (!inv) { results.push({ itemCode: item.itemCode, success: false, message: "ไม่พบรหัสวัสดุ" }); hadError = true; continue; }

      const qty = parseInt(item.quantityReceived);
      if (isNaN(qty) || qty <= 0) { results.push({ itemCode: item.itemCode, success: false, message: "จำนวนไม่ถูกต้อง" }); hadError = true; continue; }

      let unitPrice = inv.unit_price || 0;
      let updatePrice = false;
      if (item.unitPrice !== undefined && item.unitPrice !== null && !isNaN(parseFloat(item.unitPrice))) {
        unitPrice = parseFloat(item.unitPrice);
        updatePrice = unitPrice !== inv.unit_price;
      }

      const newQty = (inv.quantity || 0) + qty;
      const payload: any = { quantity: newQty, updated_at: new Date().toISOString() };
      if (updatePrice) payload.unit_price = unitPrice;
      await db.from("inventory").update(payload).eq("id", inv.id);

      const txnId = await generateDailyTransactionId("GRN");
      await recordTransaction({
        transactionId: txnId, timestamp: new Date(info.receiptDate || Date.now()).toISOString(),
        type: "Goods Receipt", referenceNo: info.referenceNo || "Manual GRN", itemId: inv.id,
        itemCode: inv.code, itemName: inv.name, quantityChange: qty, unit: inv.unit,
        unitPrice, valueChange: qty * unitPrice, newStockQuantity: newQty,
        receivedBy: info.receivedByUsername, notes: info.notes || "", source: info.source,
      });
      results.push({ itemCode: item.itemCode, success: true, newStock: newQty, unitPriceUsed: unitPrice, inventoryPriceUpdated: updatePrice });
    }

    if (hadError) return res.json({ success: false, message: "บางรายการล้มเหลว", details: results });
    res.json({ success: true, message: "รับวัสดุเข้าคลังสำเร็จ", details: results });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});
