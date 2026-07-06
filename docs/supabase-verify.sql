-- ============================================================
-- THAMC e-Material v2 — ยืนยัน schema จริงในฐานข้อมูล
-- สถาปัตยกรรมใหม่: มี backend (Express) ถือ service key ฝั่งเซิร์ฟเวอร์
-- => backend ใช้ service_role ซึ่ง "ข้าม RLS" อยู่แล้ว
--    จึงเปิด RLS ทิ้งไว้แบบ default-deny ได้ (client ไม่แตะ DB ตรง)
-- รันใน Supabase Dashboard -> SQL Editor (อ่านอย่างเดียว ไม่แก้ข้อมูล)
-- เอาผลลัพธ์มาเทียบกับ docs/SCHEMA.md
-- ============================================================

-- 1) คอลัมน์ + ชนิด ของทุกตารางใน public
select table_name, column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_schema = 'public'
order by table_name, ordinal_position;

-- 2) คีย์หลัก / คีย์นอก
select tc.table_name, tc.constraint_type, kcu.column_name
from information_schema.table_constraints tc
join information_schema.key_column_usage kcu
  on tc.constraint_name = kcu.constraint_name
where tc.table_schema = 'public'
  and tc.constraint_type in ('PRIMARY KEY','FOREIGN KEY')
order by tc.table_name;

-- 3) generated columns (เช็กว่า total_price เป็น generated จริงไหม)
select table_name, column_name, generation_expression
from information_schema.columns
where table_schema = 'public' and is_generated = 'ALWAYS';

-- 4) storage buckets
select id, name, public from storage.buckets;


-- ────────────────────────────────────────────────────────────
-- (แนะนำ) เปิด RLS ทุกตารางแบบ default-deny เพื่อกันการเข้าถึงตรงจาก
-- anon/public key — backend ใช้ service_role จึงยังทำงานได้ตามปกติ
-- ────────────────────────────────────────────────────────────
alter table public.users              enable row level security;
alter table public.departments        enable row level security;
alter table public.inventory          enable row level security;
alter table public.catalog            enable row level security;
alter table public.requisitions       enable row level security;
alter table public.requisition_items  enable row level security;
alter table public.transaction_logs   enable row level security;
alter table public.id_counters        enable row level security;
-- ไม่ต้องสร้าง policy ใด ๆ: client ไม่มีสิทธิ์แตะ DB ตรง, backend ข้าม RLS เอง
