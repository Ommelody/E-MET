import { Router } from "express";
import { getSignedUrl } from "../lib/storage";
import { db } from "../supabase";

export const documentsRouter = Router();

/**
 * เปิดดูเอกสารในบัคเก็ต (โดยเฉพาะ pdfs ที่เป็น private)
 * แปลง path -> signed URL แล้ว redirect ไปยังไฟล์จริง
 * ใช้โดยลิงก์ RequisitionPDFLink / GoodsIssuePDFLinks จาก frontend
 */
documentsRouter.get("/view", async (req, res) => {
  const bucket = (req.query.bucket as string) || "pdfs";
  const path = req.query.path as string;
  if (!path) return res.status(400).send("missing path");
  try {
    const url = await getSignedUrl(bucket, path, 3600);
    if (!url) return res.status(404).send("ไม่พบเอกสาร");
    res.redirect(url);
  } catch (e: any) {
    res.status(500).send("ไม่สามารถเปิดเอกสารได้: " + e.message);
  }
});

/** คืน signed URL เป็น JSON (กรณี frontend อยากได้ url ตรง ๆ) */
documentsRouter.get("/signed-url", async (req, res) => {
  const bucket = (req.query.bucket as string) || "pdfs";
  const path = req.query.path as string;
  if (!path) return res.status(400).json({ error: "missing path" });
  const url = await getSignedUrl(bucket, path, 3600);
  res.json({ url });
});

/** ประวัติเอกสารของใบเบิก (ใบเบิก + ใบจ่ายทั้งหมด) */
documentsRouter.get("/requisition/:id", async (req, res) => {
  const { data: r } = await db
    .from("requisitions")
    .select("id,requisition_pdf_path,goods_issue_pdf_links")
    .eq("id", req.params.id)
    .maybeSingle();
  if (!r) return res.status(404).json({ error: "ไม่พบใบเบิก" });

  const view = (p: string) => `/api/documents/view?bucket=pdfs&path=${encodeURIComponent(p)}`;
  const raw = r.goods_issue_pdf_links;
  const gi = raw ? (typeof raw === "string" ? JSON.parse(raw) : raw) : [];
  res.json({
    requisitionForm: r.requisition_pdf_path ? view(r.requisition_pdf_path) : null,
    goodsIssues: (gi as any[]).map((g) => ({ ...g, url: g.path ? view(g.path) : null })),
  });
});
