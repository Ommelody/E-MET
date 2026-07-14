import { useEffect, useRef, useState } from "react";
import { X, Camera, Loader2 } from "lucide-react";
import { loadScannerLib } from "../lib/qr";

// โมดัลสแกน QR — เมื่อสแกนเจอจะปิดกล้องอัตโนมัติแล้วส่งค่ากลับผ่าน onFound
export default function QRScanner({ onFound, onClose }: { onFound: (text: string) => void; onClose: () => void }) {
  const [status, setStatus] = useState("กำลังเปิดกล้อง…");
  const [error, setError] = useState("");
  const scannerRef = useRef<any>(null);
  const stoppedRef = useRef(false);
  const elId = "qr-reader-box";

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await loadScannerLib();
        if (cancelled) return;
        const Html5Qrcode = (window as any).Html5Qrcode;
        const scanner = new Html5Qrcode(elId);
        scannerRef.current = scanner;
        await scanner.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 220, height: 220 } },
          (decodedText: string) => {
            if (stoppedRef.current) return;
            stoppedRef.current = true;
            setStatus("พบรหัสแล้ว กำลังปิดกล้อง…");
            scanner.stop().then(() => scanner.clear()).catch(() => {}).finally(() => onFound(decodedText));
          },
          () => {}
        );
        if (!cancelled) setStatus("เล็งกล้องไปที่ QR Code");
      } catch (e: any) {
        setError(e?.message || "ไม่สามารถเปิดกล้องได้ — ตรวจสอบสิทธิ์การใช้กล้องของเบราว์เซอร์");
      }
    })();
    return () => {
      cancelled = true;
      const s = scannerRef.current;
      if (s && !stoppedRef.current) { try { s.stop().then(() => s.clear()).catch(() => {}); } catch {} }
    };
  }, []);

  const close = () => {
    const s = scannerRef.current;
    if (s && !stoppedRef.current) { stoppedRef.current = true; try { s.stop().then(() => s.clear()).catch(() => {}); } catch {} }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-900/70 p-4 backdrop-blur-sm" style={{ paddingTop: "max(1rem, env(safe-area-inset-top))" }}>
      <div className="w-full max-w-sm overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5">
          <h3 className="flex items-center gap-2 text-base font-bold text-slate-800"><Camera className="h-5 w-5 text-[#5b4df6]" />สแกน QR พัสดุ</h3>
          <button onClick={close} className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border-none bg-transparent text-slate-400 hover:bg-slate-100"><X className="h-4 w-4" /></button>
        </div>
        <div className="p-4">
          {error ? (
            <div className="rounded-xl border border-rose-100 bg-rose-50 p-4 text-center text-sm text-rose-600">{error}</div>
          ) : (
            <>
              <div id={elId} className="mx-auto overflow-hidden rounded-xl bg-black" style={{ width: "100%", minHeight: 260 }} />
              <div className="mt-3 flex items-center justify-center gap-2 text-xs text-slate-500"><Loader2 className="h-3.5 w-3.5 animate-spin" />{status}</div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
