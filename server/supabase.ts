import { createClient } from "@supabase/supabase-js";
import { config } from "./config";

/**
 * Supabase admin client — ใช้ service_role key จึง "ข้าม RLS" ทั้งหมด
 * ใช้ได้เฉพาะฝั่งเซิร์ฟเวอร์ (Node) เท่านั้น ห้ามนำ key นี้ไป frontend
 */
export const db = createClient(config.supabaseUrl, config.supabaseServiceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

/** helper: โยน error เมื่อ query ล้มเหลว เพื่อให้ route จับได้ที่เดียว */
export function unwrap<T>(res: { data: T; error: any }): T {
  if (res.error) throw new Error(res.error.message || "Supabase query failed");
  return res.data;
}
