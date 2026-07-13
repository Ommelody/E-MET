import { Router } from "express";
import { db } from "../supabase";

export const announcementsRouter = Router();

const KEY = "announcements";

// เนื้อหาเริ่มต้น (เหมือนระบบเดิม) ใช้เมื่อยังไม่เคยตั้งค่า
const DEFAULT_ANNOUNCEMENTS = {
  cards: [
    {
      id: "c1", accent: "indigo", icon: "calendar",
      title: "รอบการตัด-จ่ายพัสดุประจำสัปดาห์",
      body:
        "รอบการเบิกพัสดุของศูนย์การแพทย์จำกัดที่ 1 ครั้งต่อสัปดาห์\n" +
        "• คีย์ใบเบิกสำเร็จภายในวันพุธ ก่อนเวลา 10:00 น. เพื่อรับพัสดุในวันศุกร์ถัดไป\n" +
        "• หากทำรายการเบิกหลังเวลาดังกล่าว คลังสินค้าจะยกยอดจ่ายไปจัดส่งพร้อมรอบใบเบิกของสัปดาห์ถัดไปโดยอัตโนมัติ",
    },
    {
      id: "c2", accent: "amber", icon: "alert",
      title: 'แจ้งเตือนสถานะสินค้า "ค้างจ่าย"',
      body:
        'ในกรณีที่พัสดุในคลังมีปริมาณน้อยกว่ายอดเบิกจ่ายพัสดุ เจ้าหน้าที่คลังจะลงบันทึกในใบเบิกพัสดุของท่านเป็นสถานะ "ค้างจ่าย (Backorder)"\n' +
        "เมื่อมีการเติมสินค้าพัสดุเข้าคลังเรียบร้อยแล้ว แผนกคลังพัสดุจะจัดส่งตามจ่ายของค้างจ่ายนั้นโดยตรงโดยที่ท่านไม่จำเป็นต้องสร้างใบเบิกใบใหม่",
    },
  ],
  contact: {
    title: "ติดต่อสอบถามข้อมูลระบบขัดข้อง",
    subtitle: "หากพบปัญหาการเบิกจ่ายหรือติดปัญหาใช้งาน กรุณาติดต่อสายด่วน",
    phone: "02-078-0056",
    ext: "ต่อสายเบอร์ภายในแผนก: 0050",
  },
};

// GET — อ่านประกาศ (ถ้ายังไม่มีตาราง/ค่า จะคืนค่าเริ่มต้น)
announcementsRouter.get("/", async (_req, res) => {
  try {
    const { data, error } = await db.from("app_settings").select("value").eq("key", KEY).maybeSingle();
    if (error) {
      // ตาราง app_settings อาจยังไม่ถูกสร้าง — คืนค่าเริ่มต้นไปก่อน
      return res.json({ ...DEFAULT_ANNOUNCEMENTS, _needsSetup: true });
    }
    res.json(data?.value || DEFAULT_ANNOUNCEMENTS);
  } catch {
    res.json({ ...DEFAULT_ANNOUNCEMENTS, _needsSetup: true });
  }
});

// PUT — บันทึกประกาศ (เฉพาะ Admin)
announcementsRouter.put("/", async (req, res) => {
  const { actorRole, value } = req.body ?? {};
  if (actorRole !== "Admin") return res.status(403).json({ error: "เฉพาะผู้ดูแลระบบ (Admin) เท่านั้น" });
  if (!value) return res.status(400).json({ error: "ไม่มีข้อมูลประกาศ" });

  const { error } = await db
    .from("app_settings")
    .upsert({ key: KEY, value, updated_at: new Date().toISOString() }, { onConflict: "key" });
  if (error) {
    return res.status(500).json({
      error:
        "บันทึกไม่สำเร็จ — อาจยังไม่ได้สร้างตาราง app_settings ในฐานข้อมูล กรุณารัน SQL ในไฟล์ docs/supabase-app-settings.sql (" +
        error.message + ")",
    });
  }
  res.json({ success: true });
});
