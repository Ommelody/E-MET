import dotenv from "dotenv";

dotenv.config();

function required(name: string): string {
  const v = process.env[name];
  if (!v) {
    throw new Error(
      `[config] ขาดตัวแปรแวดล้อม ${name} — คัดลอก .env.example เป็น .env แล้วกรอกค่าให้ครบ`
    );
  }
  return v;
}

export const config = {
  supabaseUrl: required("SUPABASE_URL"),
  supabaseServiceKey: required("SUPABASE_SERVICE_KEY"),
  port: Number(process.env.PORT) || 3000,
  isProd: process.env.NODE_ENV === "production",
};
