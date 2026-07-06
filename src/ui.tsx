import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import { X, Check, AlertTriangle, Info, Loader2 } from "lucide-react";

/* ── ปุ่ม ─────────────────────────────────────────────────── */
export function Button({
  children, variant = "primary", size = "md", className = "", ...props
}: {
  children: ReactNode; variant?: "primary" | "ghost" | "danger" | "success" | "outline"; size?: "sm" | "md";
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const base = "inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer border";
  const sizes = { sm: "px-3 py-1.5 text-xs", md: "px-4 py-2.5 text-sm" };
  const variants = {
    primary: "border-transparent bg-[#5b4df6] text-white hover:bg-[#4c3fe0] shadow-sm",
    success: "border-transparent bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm",
    danger: "border-transparent bg-rose-600 text-white hover:bg-rose-700 shadow-sm",
    ghost: "border-transparent bg-transparent text-slate-600 hover:bg-slate-100",
    outline: "border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
  };
  return (
    <button className={`${base} ${sizes[size]} ${variants[variant]} ${className}`} {...props}>
      {children}
    </button>
  );
}

/* ── การ์ด ─────────────────────────────────────────────────── */
export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-2xl border border-slate-200/70 bg-white shadow-[0_1px_3px_rgba(15,23,42,.04)] ${className}`}>{children}</div>;
}

/* ── ป้ายสถานะ ─────────────────────────────────────────────── */
export function Badge({ children, bg, color }: { children: ReactNode; bg: string; color: string }) {
  return <span className="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold" style={{ background: bg, color }}>{children}</span>;
}

/* ── ช่องกรอก ─────────────────────────────────────────────── */
export const inputClass =
  "w-full rounded-lg border-[1.5px] border-slate-200 bg-slate-50/70 px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-[#5b4df6] focus:bg-white focus:shadow-[0_0_0_3px_rgba(91,77,246,.14)]";

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold text-slate-600">{label}</span>
      {children}
    </label>
  );
}

/* ── สถานะว่าง ─────────────────────────────────────────────── */
export function EmptyState({ icon, title, hint }: { icon?: ReactNode; title: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">{icon || <Info className="h-6 w-6" />}</div>
      <div className="text-sm font-semibold text-slate-700">{title}</div>
      {hint && <div className="max-w-xs text-xs text-slate-400">{hint}</div>}
    </div>
  );
}

export function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-slate-400">
      <Loader2 className="h-7 w-7 animate-spin" />
      {label && <span className="text-xs">{label}</span>}
    </div>
  );
}

/* ── Modal ─────────────────────────────────────────────────── */
export function Modal({ open, onClose, title, children, width = "max-w-lg" }: {
  open: boolean; onClose: () => void; title: string; children: ReactNode; width?: string;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/40 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className={`my-8 w-full ${width} rounded-2xl bg-white shadow-2xl`} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <h3 className="text-base font-bold text-slate-800">{title}</h3>
          <button onClick={onClose} className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border-none bg-transparent text-slate-400 hover:bg-slate-100"><X className="h-4 w-4" /></button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  );
}

/* ── Toast ─────────────────────────────────────────────────── */
type Toast = { id: number; type: "success" | "error" | "info"; msg: string };
const ToastCtx = createContext<{ push: (t: Omit<Toast, "id">) => void }>({ push: () => {} });
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((t: Omit<Toast, "id">) => {
    const id = Date.now() + Math.random();
    setToasts((cur) => [...cur, { ...t, id }]);
    setTimeout(() => setToasts((cur) => cur.filter((x) => x.id !== id)), 3800);
  }, []);
  const icons = { success: <Check className="h-4 w-4" />, error: <AlertTriangle className="h-4 w-4" />, info: <Info className="h-4 w-4" /> };
  const colors = { success: "bg-emerald-600", error: "bg-rose-600", info: "bg-slate-800" };
  return (
    <ToastCtx.Provider value={{ push }}>
      {children}
      <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-2">
        {toasts.map((t) => (
          <div key={t.id} className={`flex items-center gap-2.5 rounded-xl ${colors[t.type]} px-4 py-3 text-sm font-medium text-white shadow-lg`} style={{ animation: "slideIn .2s ease" }}>
            {icons[t.type]}{t.msg}
          </div>
        ))}
      </div>
      <style>{`@keyframes slideIn{from{opacity:0;transform:translateX(20px)}to{opacity:1;transform:translateX(0)}}`}</style>
    </ToastCtx.Provider>
  );
}

/* ── หัวข้อหน้า ─────────────────────────────────────────────── */
export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="m-0 text-2xl font-bold tracking-tight text-slate-800">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
