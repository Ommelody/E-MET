export const STATUS_LABELS: Record<string, string> = {
  "Pending Manager Approval": "รออนุมัติ (หัวหน้างาน)",
  "Pending Stock Approval": "รอจ่ายพัสดุ",
  "Partially Completed": "จ่ายบางส่วน",
  Completed: "เสร็จสิ้น",
  "Rejected by Manager": "ปฏิเสธ (หัวหน้างาน)",
  "Rejected by Stock": "ปฏิเสธ (พัสดุ)",
};

export const STATUS_STYLES: Record<string, { bg: string; color: string }> = {
  "Pending Manager Approval": { bg: "#fef3c7", color: "#b45309" },
  "Pending Stock Approval": { bg: "#dbeafe", color: "#1d4ed8" },
  "Partially Completed": { bg: "#fae8ff", color: "#a21caf" },
  Completed: { bg: "#dcfce7", color: "#15803d" },
  "Rejected by Manager": { bg: "#fee2e2", color: "#b91c1c" },
  "Rejected by Stock": { bg: "#fee2e2", color: "#b91c1c" },
};

export function statusLabel(s: string) {
  return STATUS_LABELS[s] || s;
}

export function fmtBaht(n: number | string | null | undefined) {
  const v = Number(n) || 0;
  return v.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function fmtNumber(n: number | string | null | undefined) {
  return (Number(n) || 0).toLocaleString("th-TH");
}

export function fmtDate(v: any) {
  if (!v) return "-";
  const d = new Date(v);
  return isNaN(d.getTime()) ? String(v) : d.toLocaleDateString("th-TH", { year: "numeric", month: "short", day: "numeric" });
}

export function fmtDateTime(v: any) {
  if (!v) return "-";
  const d = new Date(v);
  return isNaN(d.getTime()) ? String(v) : d.toLocaleString("th-TH", { dateStyle: "short", timeStyle: "short" });
}

export function todayISO() {
  return new Date().toISOString().slice(0, 10);
}
