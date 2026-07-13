import { updateRequisitionPdf } from "./pdf";

export const docViewUrl = (bucket: string, path: string) =>
  `/api/documents/view?bucket=${bucket}&path=${encodeURIComponent(path)}`;

export function resolveGiPdfLinks(linksJson: any) {
  if (!linksJson) return [];
  const links = typeof linksJson === "string" ? JSON.parse(linksJson) : linksJson;
  return (links as any[]).map((l) => ({ ...l, url: l.path ? docViewUrl("pdfs", l.path) : l.url }));
}

/** map แถว requisitions -> camelCase + ลิงก์เอกสาร (สร้าง PDF ให้ถ้ายังไม่มี) */
export async function mapRequisitionRow(row: any) {
  let pdfPath = row.requisition_pdf_path;
  if (!pdfPath) {
    try {
      pdfPath = await updateRequisitionPdf(row.id);
    } catch {
      /* non-fatal */
    }
  }
  return {
    id: row.id,
    date: row.date,
    purpose: row.purpose,
    requestedBy: row.requested_by,
    requestorName: row.requestor_name,
    requestorDepartment: row.requestor_department,
    status: row.status,
    managerApproverUsername: row.manager_approver_username,
    managerApproverName: row.manager_approver_name,
    managerApprovalStatus: row.manager_approval_status,
    managerApprovalDate: row.manager_approval_date,
    managerApprovalNote: row.manager_approval_note,
    stockApproverUsername: row.stock_approver_username,
    stockApproverName: row.stock_approver_name,
    stockApprovalStatus: row.stock_approval_status,
    stockApprovalDate: row.stock_approval_date,
    stockApprovalNote: row.stock_approval_note,
    RequisitionPDFLink: pdfPath ? docViewUrl("pdfs", pdfPath) : null,
    GoodsIssuePDFLinks: resolveGiPdfLinks(row.goods_issue_pdf_links),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    items: [] as any[],
  };
}

export function mapItemRow(item: any, invMap: Record<string, any>) {
  const inv = invMap[item.item_id] || invMap[item.item_id?.toString()] || {};
  return {
    requisitionId: item.requisition_id,
    itemId: item.item_id?.toString(),
    itemName: item.item_name,
    quantity: item.quantity,
    unit: item.unit,
    dispensedQuantity: item.dispensed_quantity,
    UnitPrice: item.unit_price,
    TotalPrice: item.total_price ?? item.quantity * item.unit_price,
    isBackordered: item.is_backordered,
    notesForItem: item.notes_for_item || "",
    itemCode: inv.code || "N/A",
    location: inv.location || "N/A",
    currentInventoryQuantity: inv.quantity !== undefined ? inv.quantity : 0,
    imageUrl: inv.imageUrl || null,
  };
}
