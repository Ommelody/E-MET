-- ============================================================
-- THAMC e-Material — ฟีเจอร์ใหม่: จุดสั่งซื้ออัตโนมัติ + Audit Log
-- รันใน Supabase Dashboard -> SQL Editor เพียงครั้งเดียว
-- ============================================================

-- ── 1) ค่าพารามิเตอร์คำนวณจุดสั่งซื้อ (ตั้งได้รายวัสดุ) ──────────
-- lead_time_days   = ระยะเวลารอสินค้าหลังสั่งซื้อ (วัน)
-- safety_stock     = สต๊อกสำรองกันของขาด (หน่วย)
-- avg_daily_usage  = อัตราการใช้เฉลี่ยต่อวัน (ถ้าไม่กรอก ระบบจะคำนวณจากประวัติจ่ายจริงให้)
alter table public.inventory
  add column if not exists lead_time_days   integer,
  add column if not exists safety_stock     integer,
  add column if not exists avg_daily_usage  numeric;

comment on column public.inventory.lead_time_days is 'ระยะเวลารอของหลังสั่งซื้อ (วัน) สำหรับคำนวณจุดสั่งซื้อ';
comment on column public.inventory.safety_stock  is 'สต๊อกสำรอง (หน่วย)';
comment on column public.inventory.avg_daily_usage is 'อัตราใช้เฉลี่ย/วัน (null = ให้ระบบคำนวณจากประวัติ)';


-- ── 2) ตาราง Audit Log ────────────────────────────────────────
create table if not exists public.audit_logs (
  id           bigint generated always as identity primary key,
  timestamp    timestamptz default now(),
  actor        text,          -- username ผู้กระทำ
  actor_name   text,          -- ชื่อผู้กระทำ
  actor_role   text,          -- สิทธิ์ขณะกระทำ
  action       text,          -- ประเภท: LOGIN, CREATE_REQUISITION, APPROVE, DISPENSE, GOODS_RECEIPT, UPDATE_INVENTORY, DELETE_INVENTORY, UPDATE_USER, ...
  entity_type  text,          -- ชนิดข้อมูล: requisition, inventory, user, ...
  entity_id    text,          -- id อ้างอิง
  detail       text,          -- รายละเอียดสรุป (ข้อความไทย)
  ip_address   text
);

create index if not exists idx_audit_timestamp on public.audit_logs (timestamp desc);
create index if not exists idx_audit_actor on public.audit_logs (actor);
create index if not exists idx_audit_action on public.audit_logs (action);

-- backend ใช้ service_role (ข้าม RLS) — เปิด RLS แบบ default-deny
alter table public.audit_logs enable row level security;
