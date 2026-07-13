import { Router } from "express";
import { db } from "../supabase";

export const dashboardRouter = Router();

// ── สรุปตัวเลขหน้าแดชบอร์ด ─────────────────────────────────────
dashboardRouter.get("/", async (req, res) => {
  try {
    const { username = "", role = "" } = req.query as any;
    const isStaff = ["Admin", "Manager", "Staff"].includes(role);

    const { data: inv } = await db.from("inventory").select("id,name,code,quantity,min_quantity,unit_price");
    const totalItems = (inv ?? []).length;
    const totalValue = (inv ?? []).reduce((s: number, i: any) => s + (i.quantity || 0) * (i.unit_price || 0), 0);
    const lowStock = (inv ?? []).filter((i: any) => (i.quantity || 0) <= (i.min_quantity || 0));

    let reqQuery = db.from("requisitions").select("id,status,requested_by,created_at,requestor_name");
    if (!isStaff) reqQuery = reqQuery.eq("requested_by", username);
    const { data: reqs } = await reqQuery;

    const countByStatus: Record<string, number> = {};
    (reqs ?? []).forEach((r: any) => (countByStatus[r.status] = (countByStatus[r.status] || 0) + 1));

    const pendingManager = countByStatus["Pending Manager Approval"] || 0;
    const pendingStock = countByStatus["Pending Stock Approval"] || 0;
    const partiallyCompleted = countByStatus["Partially Completed"] || 0;
    const completed = countByStatus["Completed"] || 0;

    const recent = (reqs ?? [])
      .slice()
      .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 8)
      .map((r: any) => ({ id: r.id, status: r.status, requestorName: r.requestor_name, createdAt: r.created_at }));

    res.json({
      totalItems,
      totalValue,
      lowStockCount: lowStock.length,
      lowStockItems: lowStock.slice(0, 10).map((i: any) => ({ id: i.id.toString(), name: i.name, code: i.code, quantity: i.quantity, minQuantity: i.min_quantity })),
      totalRequisitions: (reqs ?? []).length,
      pendingManager,
      pendingStock,
      partiallyCompleted,
      completed,
      statusBreakdown: countByStatus,
      recentRequisitions: recent,
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});
