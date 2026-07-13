// สคริปต์สำรองข้อมูลทุกตารางจาก Supabase เป็นไฟล์ JSON
// ใช้: node scripts/backup.mjs   (รันจาก root ของโปรเจกต์ thamc-v2)
// ต้องมีไฟล์ .env ที่มี SUPABASE_URL และ SUPABASE_SERVICE_KEY

import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";

dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error("❌ ขาด SUPABASE_URL หรือ SUPABASE_SERVICE_KEY ใน .env");
  process.exit(1);
}

const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// รายชื่อตารางทั้งหมดที่ต้องสำรอง
const TABLES = [
  "users",
  "departments",
  "inventory",
  "catalog",
  "requisitions",
  "requisition_items",
  "transaction_logs",
  "id_counters",
  "app_settings",
];

async function fetchAllRows(table) {
  const pageSize = 1000;
  let from = 0;
  const out = [];
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { data, error } = await db.from(table).select("*").range(from, from + pageSize - 1);
    if (error) {
      console.warn(`  ⚠️  ข้าม "${table}" (${error.message})`);
      return null;
    }
    out.push(...(data || []));
    if (!data || data.length < pageSize) break;
    from += pageSize;
  }
  return out;
}

async function main() {
  const dateStr = new Date().toISOString().slice(0, 10);
  const outDir = path.join(process.cwd(), "backups", dateStr);
  fs.mkdirSync(outDir, { recursive: true });

  console.log(`📦 เริ่มสำรองข้อมูล → ${outDir}\n`);

  let totalRows = 0;
  for (const table of TABLES) {
    process.stdout.write(`  ดึงข้อมูลตาราง "${table}"... `);
    const rows = await fetchAllRows(table);
    if (rows === null) continue;
    fs.writeFileSync(path.join(outDir, `${table}.json`), JSON.stringify(rows, null, 2), "utf-8");
    totalRows += rows.length;
    console.log(`✅ ${rows.length} แถว`);
  }

  const manifest = {
    backupDate: new Date().toISOString(),
    tables: TABLES,
    totalRows,
    note: "สำรองด้วย scripts/backup.mjs — เก็บไฟล์นี้ไว้ในที่ปลอดภัยแยกจาก Supabase",
  };
  fs.writeFileSync(path.join(outDir, "_manifest.json"), JSON.stringify(manifest, null, 2), "utf-8");

  console.log(`\n✅ สำรองสำเร็จ รวม ${totalRows} แถว → ${outDir}`);
  console.log(`   อย่าลืมคัดลอกโฟลเดอร์นี้ไปเก็บที่อื่น (Google Drive / ที่เก็บสำรองภายนอก)`);
}

main().catch((e) => {
  console.error("❌ สำรองข้อมูลล้มเหลว:", e);
  process.exit(1);
});
