import { db } from "../supabase";
import { uploadFile } from "./storage";

// ── date helpers (กัน error เมื่อค่าเป็น null/ผิดรูป) ─────────────
function dateTH(v: any, opts: Intl.DateTimeFormatOptions = {}) {
  try {
    if (!v) return "-";
    const d = new Date(v);
    return isNaN(d.getTime()) ? String(v) : d.toLocaleDateString("th-TH", opts);
  } catch {
    return String(v);
  }
}
function dateTimeTH(v: any, opts: Intl.DateTimeFormatOptions = {}) {
  try {
    if (!v) return "-";
    const d = new Date(v);
    return isNaN(d.getTime()) ? String(v) : d.toLocaleString("th-TH", opts);
  } catch {
    return String(v);
  }
}

function baseStyle() {
  return `@import url('https://fonts.googleapis.com/css2?family=Sarabun:wght@400;600;700&display=swap');
    *{box-sizing:border-box}
    body{font-family:'Sarabun',sans-serif;font-size:10.5pt;margin:24px;color:#1e293b}
    .header{text-align:center;font-size:16pt;font-weight:700;margin-bottom:6px;color:#0f172a}
    .subheader{text-align:center;font-size:10pt;margin-bottom:6px;color:#475569}
    table{width:100%;border-collapse:collapse;margin-bottom:16px}
    .info-table td{border:none;padding:4px 0;text-align:left;background:transparent;font-size:10.5pt;line-height:1.6}
    .item-table th,.item-table td{border:1px solid #cbd5e1;padding:7px 8px;text-align:left;word-wrap:break-word;font-size:10pt}
    .item-table th{background:#f1f5f9;font-weight:700;text-align:center;color:#0f172a}
    .item-table td:nth-child(1),.item-table td:nth-child(4),.item-table td:nth-child(5){text-align:center}
    .currency{text-align:right}
    .total-row td{font-weight:700;background:#f1f5f9;border:1px solid #cbd5e1}
    .signature-table{margin-top:44px;page-break-inside:avoid;line-height:1.6}
    .signature-table td{border:none;text-align:center;vertical-align:top;padding:10px}
    .sig-line{margin-bottom:34px;color:#94a3b8}
    .footer-note{font-size:8pt;text-align:center;margin-top:28px;color:#94a3b8}`;
}

// ── ใบเบิกวัสดุ ────────────────────────────────────────────────
export function buildRequisitionFormHtml(title: string, req: any, items: any[], grandTotal: number) {
  const rows = items
    .map((it, i) => {
      const up = parseFloat(it.UnitPrice) || 0;
      const qty = parseInt(it.quantity) || 0;
      return `<tr><td>${i + 1}</td><td>${it.itemCode || "-"}</td><td style='text-align:left'>${it.itemName}</td>
        <td>${it.location || "-"}</td><td>${qty}</td><td>${it.unit || ""}</td>
        <td class='currency'>${up.toFixed(2)}</td><td class='currency'>${(qty * up).toFixed(2)}</td></tr>`;
    })
    .join("");

  const created = req.createdAt ? dateTimeTH(req.createdAt, { dateStyle: "short", timeStyle: "short" }) : "...";
  const mgrDate = req.managerApprovalDate ? dateTH(req.managerApprovalDate) : ".........................";
  const stkDate = req.stockApprovalDate ? dateTH(req.stockApprovalDate) : ".........................";

  return `<!DOCTYPE html><html lang="th"><head><meta charset="utf-8"><style>${baseStyle()}</style></head><body>
    <div class='header'>${title}</div>
    <div class='subheader'>เลขที่อ้างอิง: ${req.id} (สถานะ: ${req.status})</div>
    <table class="info-table">
      <tr><td style="width:50%"><strong>วันที่เบิก:</strong> ${dateTH(req.date, { year: "numeric", month: "long", day: "numeric" })}</td>
      <td style="width:50%"><strong>ผู้เบิก:</strong> ${req.requestorName || ""}</td></tr>
      <tr><td><strong>หน่วยงาน:</strong> ${req.requestorDepartment || ""}</td>
      <td><strong>วัตถุประสงค์:</strong> ${req.purpose || ""}</td></tr>
    </table>
    <table class='item-table'><thead><tr>
      <th style='width:5%'>ลำดับ</th><th style='width:12%'>รหัสวัสดุ</th><th style='width:33%'>ชื่อวัสดุ</th>
      <th style='width:10%'>ที่ตั้ง</th><th style='width:10%'>จำนวนเบิก</th><th style='width:8%'>หน่วย</th>
      <th style='width:10%' class='currency'>ราคา/หน่วย</th><th style='width:12%' class='currency'>มูลค่ารวม</th>
    </tr></thead><tbody>${rows}</tbody>
    <tfoot><tr class='total-row'><td colspan='7' style='text-align:right'>รวมมูลค่าที่ขอเบิก (บาท):</td>
    <td class='currency'>${grandTotal.toFixed(2)}</td></tr></tfoot></table>
    <table class="signature-table"><tr>
      <td style="width:33.33%"><div class="sig-line">............................................</div>
        <div>(${req.requestorName || "ผู้ขอเบิก"})</div><strong>ผู้ขอเบิก</strong>
        <div style="font-size:8.5pt;color:#64748b">วันที่: ${created}</div></td>
      <td style="width:33.33%"><div class="sig-line">............................................</div>
        <div>(${req.managerApproverName || "........................"})</div><strong>ผู้อนุมัติ (หัวหน้างาน)</strong>
        <div style="font-size:8.5pt;color:#64748b">สถานะ: ${req.managerApprovalStatus || "-"} · ${mgrDate}</div></td>
      <td style="width:33.33%"><div class="sig-line">............................................</div>
        <div>(${req.stockApproverName || "........................"})</div><strong>เจ้าหน้าที่พัสดุ</strong>
        <div style="font-size:8.5pt;color:#64748b">สถานะ: ${req.stockApprovalStatus || "-"} · ${stkDate}</div></td>
    </tr></table>
    <div class='footer-note'>เอกสารสร้างจากระบบ THAMC e-Material เมื่อ ${dateTimeTH(new Date(), { dateStyle: "medium", timeStyle: "short" })}</div>
    </body></html>`;
}

// ── ใบจ่ายวัสดุ ────────────────────────────────────────────────
export function buildGoodsIssueHtml(title: string, header: any, items: any[]) {
  let grandTotal = 0;
  const rows = items
    .map((it, i) => {
      const up = parseFloat(it.UnitPrice) || 0;
      const disp = parseInt(it.dispensedQuantity) || 0;
      grandTotal += disp * up;
      const dispCell = disp > 0 ? disp : it.isBackordered ? "<span style='color:#dc2626'>ค้างจ่าย</span>" : "0";
      return `<tr><td>${i + 1}</td><td>${it.itemCode || "-"}<br><small style='color:#64748b'>(${it.location || "N/A"})</small></td>
        <td style='text-align:left'>${it.itemName}${it.notesForItem ? `<br><small>หมายเหตุ: ${it.notesForItem}</small>` : ""}</td>
        <td>${it.quantity || 0}</td><td>${dispCell}</td><td>${it.unit || ""}</td>
        <td class='currency'>${up.toFixed(2)}</td><td class='currency'>${(disp * up).toFixed(2)}</td>
        <td>${it.currentInventoryQuantity >= 0 ? it.currentInventoryQuantity : 0}</td></tr>`;
    })
    .join("");

  return `<!DOCTYPE html><html lang="th"><head><meta charset="utf-8"><style>${baseStyle()}</style></head><body>
    <div class='header'>${title}</div>
    <div class='subheader'>เลขที่ใบจ่าย: ${header.goodsIssueId} · อ้างอิงใบเบิก: ${header.id}</div>
    <table class="info-table">
      <tr><td style="width:50%"><strong>วันที่เบิก:</strong> ${dateTH(header.date, { year: "numeric", month: "long", day: "numeric" })}</td>
      <td style="width:50%"><strong>วันที่จ่าย:</strong> ${dateTH(new Date(), { year: "numeric", month: "long", day: "numeric" })}</td></tr>
      <tr><td><strong>ผู้เบิก:</strong> ${header.requestorName || ""}</td><td><strong>หน่วยงาน:</strong> ${header.requestorDepartment || ""}</td></tr>
      <tr><td colspan="2"><strong>วัตถุประสงค์:</strong> ${header.purpose || ""}</td></tr>
    </table>
    <table class='item-table'><thead><tr>
      <th style='width:5%'>ลำดับ</th><th style='width:12%'>รหัส/ที่ตั้ง</th><th style='width:24%'>ชื่อวัสดุ</th>
      <th style='width:8%'>ขอเบิก</th><th style='width:8%'>จ่ายครั้งนี้</th><th style='width:7%'>หน่วย</th>
      <th style='width:10%' class='currency'>ราคา/หน่วย</th><th style='width:14%' class='currency'>มูลค่า</th><th style='width:12%'>คงเหลือ</th>
    </tr></thead><tbody>${rows}</tbody>
    <tfoot><tr class='total-row'><td colspan='7' style='text-align:right'>รวมมูลค่าที่จ่ายครั้งนี้ (บาท):</td>
    <td class='currency'>${grandTotal.toFixed(2)}</td><td></td></tr></tfoot></table>
    <table class="signature-table"><tr>
      <td style="width:50%"><div class="sig-line">............................................</div>
        <div>(${header.requestorName || "ผู้รับของ"})</div><strong>ผู้รับของ</strong>
        <div style="font-size:8.5pt;color:#64748b">วันที่: ${dateTH(new Date())}</div></td>
      <td style="width:50%"><div class="sig-line">............................................</div>
        <div>(${header.stockApproverName || "ผู้จ่ายของ"})</div><strong>ผู้จ่ายของ</strong>
        <div style="font-size:8.5pt;color:#64748b">วันที่: ${dateTH(new Date())}</div></td>
    </tr></table>
    <div class='footer-note'>เอกสารสร้างจากระบบ THAMC e-Material เมื่อ ${dateTimeTH(new Date(), { dateStyle: "medium", timeStyle: "short" })}</div>
    </body></html>`;
}

// ── สร้าง & อัปโหลดไฟล์เอกสาร (HTML) ลง bucket pdfs ─────────────
function withBom(html: string): Buffer {
  return Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from(html, "utf-8")]);
}

export async function generateRequisitionFormPDF(reqId: string, req: any, items: any[], grandTotal: number) {
  try {
    const html = buildRequisitionFormHtml("ใบเบิกวัสดุ", req, items, grandTotal);
    const path = `requisitions/${reqId}_${new Date().toISOString().slice(0, 10)}.html`;
    return await uploadFile("pdfs", path, withBom(html), "text/html");
  } catch (e) {
    console.error("generateRequisitionFormPDF:", e);
    return null;
  }
}

export async function generateGoodsIssuePDF(header: any, items: any[], title: string) {
  try {
    const html = buildGoodsIssueHtml(title, header, items);
    const path = `goods-issue/${header.goodsIssueId}.html`;
    return await uploadFile("pdfs", path, withBom(html), "text/html");
  } catch (e) {
    console.error("generateGoodsIssuePDF:", e);
    return null;
  }
}

/** สร้างเอกสารใบเบิกใหม่จากข้อมูลล่าสุด แล้วอัปเดต path ในตาราง */
export async function updateRequisitionPdf(reqId: string) {
  try {
    const { data: req } = await db.from("requisitions").select("*").eq("id", reqId).maybeSingle();
    if (!req) return null;
    const { data: items } = await db.from("requisition_items").select("*").eq("requisition_id", reqId);
    const itemIds = (items ?? []).map((i: any) => i.item_id).filter(Boolean);
    const { data: invRows } = itemIds.length
      ? await db.from("inventory").select("id,code,location").in("id", itemIds)
      : { data: [] as any[] };
    const invMap: Record<string, any> = {};
    (invRows ?? []).forEach((r: any) => (invMap[r.id.toString()] = r));

    const mappedReq = {
      id: req.id, date: req.date, purpose: req.purpose,
      requestorName: req.requestor_name, requestorDepartment: req.requestor_department, status: req.status,
      managerApproverName: req.manager_approver_name, managerApprovalStatus: req.manager_approval_status,
      managerApprovalDate: req.manager_approval_date, stockApproverName: req.stock_approver_name,
      stockApprovalStatus: req.stock_approval_status, stockApprovalDate: req.stock_approval_date,
      createdAt: req.created_at,
    };
    const itemsForPdf = (items ?? []).map((it: any) => {
      const up = parseFloat(it.unit_price) || 0;
      const qty = parseInt(it.quantity) || 0;
      const inv = invMap[it.item_id?.toString()] || {};
      return { itemId: it.item_id, itemName: it.item_name, quantity: qty, unit: it.unit,
        itemCode: inv.code || "N/A", location: inv.location || "N/A", UnitPrice: up };
    });
    const grand = itemsForPdf.reduce((s, it) => s + it.quantity * it.UnitPrice, 0);
    const path = await generateRequisitionFormPDF(reqId, mappedReq, itemsForPdf, grand);
    if (path) await db.from("requisitions").update({ requisition_pdf_path: path }).eq("id", reqId);
    return path;
  } catch (e) {
    console.error("updateRequisitionPdf:", e);
    return null;
  }
}
