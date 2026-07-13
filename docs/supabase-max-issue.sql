-- เพิ่มคอลัมน์ "จำนวนเบิกสูงสุดต่อครั้ง" ให้ตาราง inventory
-- รันใน Supabase Dashboard -> SQL Editor เพียงครั้งเดียว
alter table public.inventory
  add column if not exists max_issue_quantity integer;

-- ค่า null = ไม่จำกัด
comment on column public.inventory.max_issue_quantity is 'จำนวนสูงสุดที่เบิกได้ต่อครั้ง (null = ไม่จำกัด)';
