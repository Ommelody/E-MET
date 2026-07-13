-- ตารางเก็บการตั้งค่าทั่วไปของแอป (ใช้กับ "ประกาศข่าวสาร" ที่แอดมินแก้ได้)
-- รันใน Supabase Dashboard -> SQL Editor เพียงครั้งเดียว
create table if not exists public.app_settings (
  key         text primary key,
  value       jsonb,
  updated_at  timestamptz default now()
);

-- backend ใช้ service_role (ข้าม RLS) — เปิด RLS แบบ default-deny เพื่อกัน client แตะตรง
alter table public.app_settings enable row level security;
