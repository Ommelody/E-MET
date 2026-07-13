import { db } from "../supabase";

export interface TxnInput {
  transactionId: string;
  timestamp?: string;
  type: string;
  referenceNo?: string | null;
  itemId?: number | string | null;
  itemCode?: string;
  itemName?: string;
  quantityChange: number;
  unit?: string;
  unitPrice?: number;
  valueChange?: number;
  newStockQuantity?: number;
  receivedBy?: string;
  notes?: string;
  source?: string;
}

/** บันทึกความเคลื่อนไหวสต๊อกลง transaction_logs */
export async function recordTransaction(tx: TxnInput) {
  const { error } = await db.from("transaction_logs").insert({
    transaction_id: tx.transactionId,
    timestamp: tx.timestamp || new Date().toISOString(),
    type: tx.type,
    reference_no: tx.referenceNo || null,
    item_id: tx.itemId ? parseInt(String(tx.itemId)) : null,
    item_code: tx.itemCode,
    item_name: tx.itemName,
    quantity_change: tx.quantityChange,
    unit: tx.unit,
    unit_price: Number(tx.unitPrice) || 0,
    value_change: Number(tx.valueChange) || 0,
    new_stock_quantity: tx.newStockQuantity,
    received_by: tx.receivedBy,
    notes: tx.notes || "",
    source: tx.source,
  });
  if (error) throw new Error(error.message);
}
