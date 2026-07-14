// โหลดไลบรารีสร้าง QR (qrcode UMD) จาก CDN แบบครั้งเดียว
let qrPromise: Promise<void> | null = null;
export function loadQRLib(): Promise<void> {
  if (qrPromise) return qrPromise;
  qrPromise = new Promise((resolve, reject) => {
    if ((window as any).QRCode?.toDataURL) return resolve();
    const s = document.createElement("script");
    s.src = "https://cdn.jsdelivr.net/npm/qrcode@1.5.3/build/qrcode.min.js";
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("โหลดไลบรารี QR ไม่สำเร็จ"));
    document.head.appendChild(s);
  });
  return qrPromise;
}

export async function qrDataUrl(text: string, size = 220): Promise<string> {
  await loadQRLib();
  return (window as any).QRCode.toDataURL(text, { margin: 1, width: size, errorCorrectionLevel: "M" });
}

// โหลด html5-qrcode สำหรับสแกน (ทำงานบน iOS Safari ได้)
let scanPromise: Promise<void> | null = null;
export function loadScannerLib(): Promise<void> {
  if (scanPromise) return scanPromise;
  scanPromise = new Promise((resolve, reject) => {
    if ((window as any).Html5Qrcode) return resolve();
    const s = document.createElement("script");
    s.src = "https://unpkg.com/html5-qrcode@2.3.8/html5-qrcode.min.js";
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("โหลดไลบรารีสแกน QR ไม่สำเร็จ"));
    document.head.appendChild(s);
  });
  return scanPromise;
}

// สร้าง & เปิดหน้าต่างพิมพ์ป้าย Location (ขนาด 9cm x 5cm แนวนอน ตามตัวอย่าง)
export async function printLocationLabel(item: {
  code: string; name: string; unit: string; location: string;
}) {
  const dataUrl = await qrDataUrl(item.code || item.name, 240);
  const w = window.open("", "_blank", "width=520,height=340");
  if (!w) { alert("กรุณาอนุญาตป๊อปอัปเพื่อพิมพ์ป้าย"); return; }
  const esc = (s: string) => (s || "").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  w.document.write(`<!doctype html><html lang="th"><head><meta charset="utf-8">
  <title>ป้าย ${esc(item.code)}</title>
  <link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@400;600;700&display=swap" rel="stylesheet">
  <style>
    @page { size: 9cm 5cm; margin: 0; }
    *{box-sizing:border-box;margin:0;padding:0}
    html,body{font-family:'Sarabun',sans-serif}
    .label{width:9cm;height:5cm;padding:0.35cm 0.4cm;display:grid;grid-template-columns:1fr auto;grid-template-rows:auto auto auto;column-gap:0.3cm;align-content:center;position:relative;overflow:hidden}
    .wm{position:absolute;left:0;right:0;bottom:0.2cm;text-align:center;font-size:1.6cm;font-weight:700;color:#f1f1f1;letter-spacing:.1cm;z-index:0}
    .row{display:flex;align-items:center;gap:0.25cm;z-index:1}
    .ic{width:0.85cm;height:0.85cm;flex:none}
    .loc{font-size:0.62cm;font-weight:700}
    .code{font-size:0.55cm;font-weight:700;letter-spacing:.02cm}
    .qr{grid-row:1 / span 2;align-self:center;z-index:1}
    .qr img{width:2.4cm;height:2.4cm;display:block}
    .name{grid-column:1 / span 2;margin-top:0.2cm;font-size:0.42cm;z-index:1;border-top:1px solid #ddd;padding-top:0.15cm}
    .name b{text-decoration:underline}
    .prtbar{position:fixed;top:8px;right:8px;display:flex;gap:6px}
    .prtbar button{font-family:'Sarabun';font-size:13px;padding:7px 12px;border:none;border-radius:6px;cursor:pointer}
    .b1{background:#4f46e5;color:#fff}.b2{background:#e2e8f0}
    @media print{.prtbar{display:none}}
  </style></head><body>
  <div class="prtbar"><button class="b2" onclick="window.close()">ปิด</button><button class="b1" onclick="window.print()">พิมพ์</button></div>
  <div class="label">
    <div class="wm">THAMC</div>
    <div class="row"><svg class="ic" viewBox="0 0 24 24" fill="#111"><path d="M12 3 2 12h3v8h6v-6h2v6h6v-8h3z"/></svg><span class="loc">${esc(item.location) || "-"}</span></div>
    <div class="row"><svg class="ic" viewBox="0 0 24 24" fill="#111"><path d="M14 2l-1.4 1.4 2.6 2.6L6 15.8V18h2.2l8.8-8.8 2.6 2.6L21 10.4z"/></svg><span class="code">${esc(item.code)}</span></div>
    <div class="qr"><img src="${dataUrl}" alt="QR"></div>
    <div class="name"><b>Name :</b> ${esc(item.name)} : ${esc(item.unit)}</div>
  </div>
  <script>window.onload=function(){setTimeout(function(){window.print();},400);};<\/script>
  </body></html>`);
  w.document.close();
}
