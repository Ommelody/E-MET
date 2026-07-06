# THAMC e-Material — ระบบเบิกจ่ายวัสดุและพัสดุคงคลัง

ระบบนี้มี 2 ส่วนอยู่ใน repo เดียว และตอนนี้ตั้งค่าให้ **deploy รวมกันที่เดียว** ได้เลย:

| ส่วน | ไฟล์ | หน้าที่ |
|------|------|---------|
| **Frontend** (React + Vite) | `index.html`, `src/` | หน้าเว็บ |
| **Backend** (Express + Supabase) | `server.ts` | เสิร์ฟหน้าเว็บ **และ** ให้บริการ API `/api/*` |

ในโหมด production เซิร์ฟเวอร์ (`server.ts`) จะเสิร์ฟทั้งหน้าเว็บที่ build แล้วและ API จากพอร์ตเดียวกัน
หน้าเว็บเรียก API แบบ **same-origin** (โดเมนเดียวกัน) โดยอัตโนมัติ — ไม่ต้องตั้งค่า URL ใด ๆ

---

## 🚀 วิธี Deploy (แนะนำ: รวมที่เดียว บนโฮสต์ที่รัน Node.js ได้)

> GitHub Pages เสิร์ฟได้เฉพาะไฟล์ static จึง **รัน `server.ts` ไม่ได้** ถ้าต้องการเก็บ backend
> ไว้ที่เดียวกับหน้าเว็บ ให้ deploy ทั้งระบบไปที่โฮสต์ที่รัน Node ได้ ตามตัวเลือกด้านล่าง

### ตัวเลือก A — Render (ง่ายสุด ไม่ต้องรู้ Docker, มีแพลนฟรี)

1. push โค้ดขึ้น GitHub
2. ไปที่ [Render](https://render.com) → **New** → **Blueprint** → เลือก repo นี้
   (Render จะอ่าน `render.yaml` แล้วตั้งค่า build/start ให้เอง)
3. รอ build เสร็จ จะได้ลิงก์ `https://<ชื่อ>.onrender.com` ใช้งานได้ทันที

### ตัวเลือก B — Docker (ใช้ได้กับ Cloud Run, Railway, Fly.io ฯลฯ)

ในโปรเจกต์มี `Dockerfile` พร้อมแล้ว:

```bash
docker build -t thamc-e-material .
docker run -p 3000:3000 thamc-e-material
```

- **Google Cloud Run:** `gcloud run deploy --source .`
- **Railway:** New Project → Deploy from GitHub repo (ตรวจเจอ Dockerfile เอง)

โฮสต์เหล่านี้จะ inject ตัวแปร `PORT` เข้ามาเอง ซึ่งเซิร์ฟเวอร์อ่านจาก `process.env.PORT` อยู่แล้ว

### ตัวเลือก C — เครื่อง/เซิร์ฟเวอร์ของตัวเอง

```bash
npm install
npm run build     # build หน้าเว็บ + bundle เซิร์ฟเวอร์เป็น dist/server.cjs
npm start          # รัน production ที่พอร์ต 3000 (หรือค่า PORT)
```

---

## 🖥️ รันในเครื่อง (Development)

```bash
npm install
npm run dev        # Vite + Express ที่ http://localhost:3000
```

---

## 🌐 (ทางเลือก) แยกหน้าเว็บขึ้น GitHub Pages

ถ้ายังอยากใช้ GitHub Pages เฉพาะ **หน้าเว็บ** แล้วให้ backend อยู่คนละที่:

1. ตั้ง repo → **Settings → Pages → Source = GitHub Actions** (มี workflow `.github/workflows/deploy.yml` ให้แล้ว)
2. deploy `server.ts` ไว้อีกโฮสต์ (ตัวเลือก A/B ด้านบน)
3. ที่หน้าล็อกอิน กดปุ่ม **"ตั้งค่าจุดเชื่อมต่อเซิร์ฟเวอร์ API"** แล้วกรอก URL ของ backend
   (ค่าเก็บใน `localStorage` คีย์ `backend_api_url`)

> ในโหมดรวมที่เดียว (ตัวเลือก A/B/C) **ไม่ต้อง** ตั้งค่านี้ เพราะเรียก API แบบ same-origin อยู่แล้ว

---

## 🛡️ ข้อควรระวังด้านความปลอดภัย (สำคัญ)

ในไฟล์ `server.ts` มีการ **hardcode Supabase `SERVICE_KEY`** ซึ่งเป็นคีย์สิทธิ์สูงสุด (ข้ามทุก RLS)

- คีย์อยู่ฝั่ง backend แต่ถ้า push repo เป็น **public** จะเปิดเผยต่อสาธารณะ
- แนะนำ: ย้ายไปเป็น environment variable (`process.env.SUPABASE_SERVICE_KEY`) ตั้งค่าใน dashboard ของโฮสต์,
  **rotate คีย์ใหม่** หากเคย commit ขึ้นไปแล้ว, หรือระหว่างนี้ตั้ง repo เป็น **private** ไว้ก่อน
