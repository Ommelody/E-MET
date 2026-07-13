import { db } from "../supabase";

/**
 * บันทึก Audit Log — เรียกจาก route ต่าง ๆ เมื่อมีการกระทำสำคัญ
 * ไม่ throw error (การ log ล้มเหลวต้องไม่ทำให้งานหลักพัง)
 */
export async function logAudit(entry: {
  actor?: string;
  actorName?: string;
  actorRole?: string;
  action: string;
  entityType?: string;
  entityId?: string;
  detail?: string;
  ip?: string;
}) {
  try {
    await db.from("audit_logs").insert({
      actor: entry.actor || null,
      actor_name: entry.actorName || null,
      actor_role: entry.actorRole || null,
      action: entry.action,
      entity_type: entry.entityType || null,
      entity_id: entry.entityId ? String(entry.entityId) : null,
      detail: entry.detail || null,
      ip_address: entry.ip || null,
    });
  } catch (e) {
    // ไม่ให้กระทบงานหลัก — แค่เตือนใน log เซิร์ฟเวอร์
    console.warn("[audit] บันทึกไม่สำเร็จ:", (e as Error).message);
  }
}
