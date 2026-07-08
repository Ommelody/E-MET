import bcrypt from "bcryptjs";

/**
 * รองรับรหัสผ่าน 2 รูปแบบระหว่างช่วงเปลี่ยนผ่าน:
 * - แบบเดิม: "hashed_" + plaintext  (ระบบเก่า ไม่ปลอดภัย)
 * - แบบใหม่: bcrypt hash ("$2a$"/"$2b$" นำหน้า)
 *
 * ผู้ใช้เดิมยังล็อกอินได้ตามปกติ — ระบบจะ "อัปเกรด" รหัสผ่านเป็น bcrypt
 * ให้อัตโนมัติเบื้องหลังทันทีที่ล็อกอินสำเร็จครั้งแรกหลังอัปเดต (ไม่ต้องทำอะไรเพิ่ม)
 */

const BCRYPT_ROUNDS = 10;
const LEGACY_PREFIX = "hashed_";

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

function isBcryptHash(stored: string): boolean {
  return /^\$2[aby]\$/.test(stored);
}

/** true ถ้ารหัสผ่านที่กรอกตรงกับที่เก็บไว้ (รองรับทั้ง legacy และ bcrypt) */
export async function verifyPassword(plain: string, stored: string): Promise<boolean> {
  if (!stored) return false;
  if (isBcryptHash(stored)) return bcrypt.compare(plain, stored);
  // legacy format
  return stored === LEGACY_PREFIX + plain;
}

/** true ถ้ารหัสผ่านที่เก็บอยู่ยังเป็นรูปแบบเก่า ควรอัปเกรดเป็น bcrypt */
export function needsUpgrade(stored: string): boolean {
  return !!stored && !isBcryptHash(stored);
}
