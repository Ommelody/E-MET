-- ============================================================
-- Indexes สำหรับเร่งความเร็วคำสั่ง query ที่ใช้บ่อย
-- (รายงาน, ค้นหาประวัติ, filter สถานะ, การเคลื่อนไหวพัสดุ)
-- รันใน Supabase Dashboard -> SQL Editor เพียงครั้งเดียว
-- ปลอดภัย รันซ้ำได้ (IF NOT EXISTS)
-- ============================================================

-- เปิด extension สำหรับค้นหาข้อความบางส่วน (ILIKE '%...%') ให้เร็วขึ้น
-- ต้องรันก่อนสร้าง index gin_trgm_ops ด้านล่าง
create extension if not exists pg_trgm;

-- requisitions: filter ตามสถานะ, ผู้เบิก, แผนก, วันที่, เรียงตาม created_at
create index if not exists idx_requisitions_status        on public.requisitions (status);
create index if not exists idx_requisitions_requested_by  on public.requisitions (requested_by);
create index if not exists idx_requisitions_department    on public.requisitions (requestor_department);
create index if not exists idx_requisitions_date          on public.requisitions (date);
create index if not exists idx_requisitions_created_at    on public.requisitions (created_at desc);

-- requisition_items: join กับใบเบิก + join กับพัสดุ + filter ค้างจ่าย
create index if not exists idx_req_items_requisition_id   on public.requisition_items (requisition_id);
create index if not exists idx_req_items_item_id          on public.requisition_items (item_id);
create index if not exists idx_req_items_backordered      on public.requisition_items (is_backordered) where is_backordered = true;

-- transaction_logs: หน้าการเคลื่อนไหว / รายงาน (filter ตามพัสดุ, ประเภท, ช่วงเวลา)
create index if not exists idx_txn_item_id      on public.transaction_logs (item_id);
create index if not exists idx_txn_type         on public.transaction_logs (type);
create index if not exists idx_txn_timestamp    on public.transaction_logs (timestamp desc);
create index if not exists idx_txn_reference_no on public.transaction_logs (reference_no);

-- inventory: ค้นหาด้วยรหัส/ชื่อ (ใช้ ilike ในหลายหน้า) + หมวดหมู่
create index if not exists idx_inventory_code       on public.inventory (code);
create index if not exists idx_inventory_category   on public.inventory (category);
create index if not exists idx_inventory_name_trgm  on public.inventory using gin (name gin_trgm_ops);
create index if not exists idx_inventory_code_trgm  on public.inventory using gin (code gin_trgm_ops);

-- catalog: join กับ inventory
create index if not exists idx_catalog_item_id on public.catalog (item_id);

-- users: ใช้ join กับ requisitions (FK อยู่แล้วแต่เพิ่ม index ตรง ๆ ให้ join เร็วขึ้น)
create index if not exists idx_users_department on public.users (department);

-- หมายเหตุ: ถ้า Supabase project ของคุณไม่มีสิทธิ์สร้าง extension (พบได้น้อยมาก)
-- ให้ลบ/คอมเมนต์บรรทัด `create extension` ด้านบน และ 2 บรรทัด index gin_trgm_ops
-- ระบบยังทำงานได้ปกติ เพียงแต่การค้นหาบางส่วน (ILIKE) จะไม่เร็วเท่าที่ควรเมื่อข้อมูลเยอะ
