# THAMC e-Material v2 (rewrite)

เขียนใหม่ทั้งระบบ — React + Vite (frontend) + Express + `@supabase/supabase-js` (backend)
ใช้ **ฐานข้อมูล Supabase เดิม** โดย service key อยู่ฝั่งเซิร์ฟเวอร์ (อ่านจาก env)

## โครงสร้าง
```
thamc-v2/
├─ .env.example          # ก๊อปเป็น .env แล้วกรอกค่า Supabase
├─ Dockerfile / render.yaml
├─ docs/
│  ├─ SCHEMA.md          # โครงสร้างฐานข้อมูล (ยืนยันกับ DB จริงแล้ว)
│  └─ supabase-verify.sql
├─ server/               # backend
│  ├─ config.ts          # โหลด/ตรวจ env
│  ├─ supabase.ts        # admin client (service_role, ข้าม RLS)
│  ├─ index.ts           # Express + เสิร์ฟหน้าเว็บ
│  └─ modules/auth.ts    # /api/auth (login, register, profile, departments)
└─ src/                  # frontend (React)
   ├─ lib/api.ts         # เรียก API แบบ same-origin
   ├─ screens/Login.tsx  # หน้าล็อกอินดีไซน์ใหม่
   └─ App.tsx
```

## รันในเครื่อง
```bash
cd thamc-v2
cp .env.example .env      # แล้วกรอก SUPABASE_URL + SUPABASE_SERVICE_KEY
npm install
npm run dev               # http://localhost:3000
```

## Deploy (รวม frontend+backend ที่เดียว)
- **Render:** New → Blueprint → เลือก repo → ตั้ง env `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`
- **Docker:** `docker build -t thamc-v2 . && docker run -p 3000:3000 --env-file .env thamc-v2`

## สถานะการพัฒนา
- [x] Backend foundation (config, supabase client, express)
- [x] โมดูล Auth (login / register / profile / departments)
- [x] Frontend scaffold + หน้าล็อกอิน (ต่อ API จริง)
- [x] โมดูล Inventory (คลังพัสดุ + CRUD + รูป + ตัดสต๊อก)
- [x] โมดูล Requisitions + การอนุมัติ (หัวหน้างาน → พัสดุ → จ่ายของ/ค้างจ่าย)
- [x] Goods Receipt (รับวัสดุเข้าคลัง)
- [x] Dashboard, Reports (7 รายงาน + CSV), Admin, Profile
- [x] ระบบเอกสาร (ใบเบิก/ใบจ่าย) ผ่าน signed URL (bucket pdfs เป็น private)

> ⚠️ เอกสารสร้างเป็น HTML (เปิดในเบราว์เชอร์แล้วสั่ง Print → Save as PDF ได้) เหมือนระบบเดิม
