import { db } from "../supabase";

/** REQ-YYNNNN (running ต่อปี, ดูจาก id ล่าสุด) */
export async function generateRequisitionId(): Promise<string> {
  const yy = new Date().getFullYear().toString().slice(-2);
  const prefix = `REQ-${yy}`;
  const { data, error } = await db
    .from("requisitions")
    .select("id")
    .like("id", `${prefix}%`)
    .order("id", { ascending: false })
    .limit(1);
  if (error) throw new Error(error.message);
  if (!data || data.length === 0) return prefix + "0001";
  const lastNum = parseInt(data[0].id.slice(prefix.length)) || 0;
  return prefix + (lastNum + 1).toString().padStart(4, "0");
}

/** ใบจ่าย: <PREFIX>-YYNNNN โดยใช้ตาราง id_counters (atomic ต่อ prefix+ปี) */
export async function generateGoodsIssueId(prefix: string): Promise<string> {
  const yy = new Date().getFullYear().toString().slice(-2);
  const { data: row } = await db
    .from("id_counters")
    .select("*")
    .eq("prefix", prefix)
    .eq("year", yy)
    .maybeSingle();

  let next: number;
  if (!row) {
    await db.from("id_counters").insert({ prefix, year: yy, last_counter: 1 });
    next = 1;
  } else {
    next = (row.last_counter || 0) + 1;
    await db.from("id_counters").update({ last_counter: next }).eq("prefix", prefix).eq("year", yy);
  }
  return `${prefix}-${yy}${next.toString().padStart(4, "0")}`;
}

/** <PREFIX>-YYMMDDNNNN สำหรับ transaction log รายวัน */
export async function generateDailyTransactionId(prefix = "TRN"): Promise<string> {
  const now = new Date();
  const yy = now.getFullYear().toString().slice(-2);
  const mm = (now.getMonth() + 1).toString().padStart(2, "0");
  const dd = now.getDate().toString().padStart(2, "0");
  const dateStr = `${prefix}-${yy}${mm}${dd}`;
  const { data } = await db
    .from("transaction_logs")
    .select("transaction_id")
    .like("transaction_id", `${dateStr}%`);
  const next = (data ? data.length : 0) + 1;
  return dateStr + next.toString().padStart(4, "0");
}
