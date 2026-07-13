import express from "express";
import path from "path";
import { config } from "./config";
import { authRouter } from "./modules/auth";
import { inventoryRouter } from "./modules/inventory";
import { requisitionsRouter } from "./modules/requisitions";
import { goodsReceiptRouter } from "./modules/goodsReceipt";
import { dashboardRouter } from "./modules/dashboard";
import { reportsRouter } from "./modules/reports";
import { adminRouter } from "./modules/admin";
import { documentsRouter } from "./modules/documents";
import { announcementsRouter } from "./modules/announcements";
import { movementRouter } from "./modules/movement";
import { purchasingRouter } from "./modules/purchasing";
import { auditRouter } from "./modules/audit";

const app = express();
app.use(express.json({ limit: "50mb" }));

// ── API routes ───────────────────────────────────────────────
// (แต่ละโมดูลใหม่จะมาต่อ .use(...) ตรงนี้: inventory, requisitions, ฯลฯ)
app.use("/api/auth", authRouter);
app.use("/api/inventory", inventoryRouter);
app.use("/api/requisitions", requisitionsRouter);
app.use("/api/goods-receipt", goodsReceiptRouter);
app.use("/api/dashboard", dashboardRouter);
app.use("/api/reports", reportsRouter);
app.use("/api/admin", adminRouter);
app.use("/api/documents", documentsRouter);
app.use("/api/announcements", announcementsRouter);
app.use("/api/movement", movementRouter);
app.use("/api/purchasing", purchasingRouter);
app.use("/api/audit", auditRouter);

app.get("/api/health", (_req, res) => res.json({ ok: true }));

// ── เสิร์ฟหน้าเว็บ ─────────────────────────────────────────────
async function start() {
  if (config.isProd) {
    // production: เสิร์ฟไฟล์ที่ build แล้วจาก dist/ (frontend + backend โดเมนเดียวกัน)
    const dist = path.join(process.cwd(), "dist");
    app.use(express.static(dist));
    app.get("*", (_req, res) => res.sendFile(path.join(dist, "index.html")));
  } else {
    // development: ให้ Vite เป็น middleware (HMR)
    const { createServer } = await import("vite");
    const vite = await createServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  }

  app.listen(config.port, "0.0.0.0", () => {
    console.log(`THAMC e-Material v2 → http://0.0.0.0:${config.port}`);
  });
}

start();
