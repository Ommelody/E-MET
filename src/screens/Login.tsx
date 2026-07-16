import { useEffect, useState } from "react";
import { Boxes, User as UserIcon, Lock, Eye, EyeOff, Settings } from "lucide-react";
import { authApi } from "../lib/api";
import type { User } from "../types";

const ACCENT = "#5b4df6";

export default function Login({ onLogin }: { onLogin: (u: User) => void }) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [departments, setDepartments] = useState<string[]>([]);

  // login fields
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  // register fields
  const [regUsername, setRegUsername] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regName, setRegName] = useState("");
  const [regDepartment, setRegDepartment] = useState("");

  useEffect(() => {
    authApi.departments().then(setDepartments).catch(() => setDepartments([]));
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const user = await authApi.login(username, password);
      onLogin(user);
    } catch (err) {
      setError(err instanceof Error ? err.message : "เข้าสู่ระบบไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await authApi.register({
        username: regUsername,
        password: regPassword,
        name: regName,
        department: regDepartment,
      });
      setMode("login");
      setUsername(regUsername);
      setPassword("");
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "ลงทะเบียนไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  };

  const isLogin = mode === "login";

  const fieldClass =
    "w-full rounded-xl border-[1.5px] border-[#e4e2ee] bg-[#fafafd] px-3.5 py-2.5 text-sm text-[#171438] outline-none transition focus:border-[#5b4df6] focus:shadow-[0_0_0_3px_rgba(91,77,246,.18)]";

  return (
    <div className="grid min-h-screen font-sans md:grid-cols-[1.05fr_1fr]" style={{ background: "#f6f7fb" }}>
      {/* BRAND PANEL */}
      <div
        className="relative hidden flex-col justify-between overflow-hidden p-11 text-white md:flex"
        style={{ background: "#141034" }}
      >
        <div
          className="absolute inset-0 opacity-70"
          style={{
            backgroundImage: "radial-gradient(circle at 1px 1px, rgba(255,255,255,.09) 1px, transparent 0)",
            backgroundSize: "22px 22px",
          }}
        />
        <div
          className="absolute -right-32 -top-32 h-96 w-96 rounded-full blur-lg"
          style={{ background: `radial-gradient(circle, ${ACCENT}88, transparent 70%)` }}
        />

        <div className="relative flex items-center gap-3">
          <div
            className="flex h-11 w-11 items-center justify-center rounded-xl"
            style={{ background: ACCENT, boxShadow: `0 8px 24px ${ACCENT}73` }}
          >
            <Boxes className="h-6 w-6" strokeWidth={2.2} />
          </div>
          <div>
            <div className="text-base font-bold tracking-tight">THAMC e-Material</div>
            <div className="text-[11px] tracking-wide" style={{ color: "#a5a1c9" }}>
              Inventory Management
            </div>
          </div>
        </div>

        {/* warehouse illustration */}
        <svg className="relative mx-auto w-full max-w-md" viewBox="0 0 400 320" fill="none">
          <ellipse cx="200" cy="300" rx="170" ry="14" fill="#000" opacity="0.25" />
          {/* shelf frame */}
          <rect x="30" y="60" width="90" height="200" rx="4" stroke="#6f66c9" strokeWidth="2" opacity="0.5" />
          <line x1="30" y1="120" x2="120" y2="120" stroke="#6f66c9" strokeWidth="2" opacity="0.5" />
          <line x1="30" y1="180" x2="120" y2="180" stroke="#6f66c9" strokeWidth="2" opacity="0.5" />
          <line x1="30" y1="240" x2="120" y2="240" stroke="#6f66c9" strokeWidth="2" opacity="0.5" />
          <rect x="40" y="75" width="26" height="26" rx="3" fill={ACCENT} opacity="0.55" />
          <rect x="80" y="75" width="26" height="26" rx="3" fill="#8b7cf6" opacity="0.4" />
          <rect x="40" y="135" width="26" height="26" rx="3" fill="#8b7cf6" opacity="0.4" />
          <rect x="40" y="195" width="26" height="26" rx="3" fill={ACCENT} opacity="0.55" />
          <rect x="80" y="195" width="26" height="26" rx="3" fill="#8b7cf6" opacity="0.4" />

          <rect x="280" y="60" width="90" height="200" rx="4" stroke="#6f66c9" strokeWidth="2" opacity="0.5" />
          <line x1="280" y1="120" x2="370" y2="120" stroke="#6f66c9" strokeWidth="2" opacity="0.5" />
          <line x1="280" y1="180" x2="370" y2="180" stroke="#6f66c9" strokeWidth="2" opacity="0.5" />
          <line x1="280" y1="240" x2="370" y2="240" stroke="#6f66c9" strokeWidth="2" opacity="0.5" />
          <rect x="290" y="75" width="26" height="26" rx="3" fill="#8b7cf6" opacity="0.4" />
          <rect x="330" y="75" width="26" height="26" rx="3" fill={ACCENT} opacity="0.55" />
          <rect x="290" y="195" width="26" height="26" rx="3" fill="#8b7cf6" opacity="0.4" />
          <rect x="330" y="135" width="26" height="26" rx="3" fill={ACCENT} opacity="0.55" />

          {/* central stacked boxes (isometric) */}
          <g transform="translate(150,150)">
            <polygon points="50,10 95,35 50,60 5,35" fill={ACCENT} opacity="0.9" />
            <polygon points="5,35 50,60 50,110 5,85" fill="#4c3fe0" opacity="0.9" />
            <polygon points="95,35 50,60 50,110 95,85" fill="#3a2fc0" opacity="0.9" />
            <line x1="50" y1="10" x2="50" y2="60" stroke="#2c229c" strokeWidth="1.5" opacity="0.6" />
            <line x1="5" y1="35" x2="50" y2="60" stroke="#2c229c" strokeWidth="1.5" opacity="0.6" />
          </g>
          {/* forklift silhouette */}
          <g transform="translate(190,225)" opacity="0.7">
            <rect x="0" y="10" width="44" height="22" rx="4" fill="#8b7cf6" />
            <rect x="34" y="-16" width="6" height="48" fill="#8b7cf6" />
            <rect x="40" y="-6" width="16" height="4" fill="#8b7cf6" />
            <rect x="40" y="6" width="16" height="4" fill="#8b7cf6" />
            <circle cx="10" cy="34" r="7" fill="#4c3fe0" />
            <circle cx="34" cy="34" r="7" fill="#4c3fe0" />
          </g>
          {/* floating check badges */}
          <circle cx="70" cy="40" r="14" fill="#1c1650" stroke="#8b7cf6" strokeWidth="1.5" />
          <path d="M64 40l4 4 8-8" stroke="#a5f3c0" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="340" cy="45" r="14" fill="#1c1650" stroke="#8b7cf6" strokeWidth="1.5" />
          <path d="M334 45l4 4 8-8" stroke="#a5f3c0" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </svg>

        <div className="relative text-center">
          <div className="text-lg font-semibold" style={{ color: "#d6d3f0" }}>
            บริหารจัดการคลังพัสดุอย่างเป็นระบบ
          </div>
          <div className="mt-1 text-[13px]" style={{ color: "#8f8ab8" }}>
            เบิก · อนุมัติ · จ่าย · ตรวจสอบย้อนหลังได้ทุกขั้นตอน
          </div>
        </div>
      </div>

      {/* FORM SIDE */}
      <div className="flex min-h-screen flex-col px-8 py-10" style={{ background: "#f6f7fb", paddingTop: "max(2.5rem, env(safe-area-inset-top))", paddingBottom: "max(2.5rem, env(safe-area-inset-bottom))" }}>
        <div className="flex flex-1 items-center justify-center">
          <div className="w-full max-w-[400px]">
            <div className="mb-6 text-center">
              <h2 className="m-0 mb-1.5 text-2xl font-bold tracking-tight" style={{ color: "#171438" }}>
                {isLogin ? "ยินดีต้อนรับกลับ" : "สร้างบัญชีผู้ใช้"}
              </h2>
              <p className="m-0 text-[13.5px]" style={{ color: "#7c799a" }}>
                {isLogin ? "ลงชื่อเข้าใช้เพื่อจัดการคลังพัสดุ" : "ลงทะเบียนเพื่อเริ่มเบิกจ่ายพัสดุ"}
              </p>
            </div>

            {/* segmented toggle */}
            <div className="mb-6 grid grid-cols-2 gap-1 rounded-xl bg-[#ececf3] p-1">
              {(["login", "register"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => {
                    setMode(m);
                    setError("");
                  }}
                  className="cursor-pointer rounded-[9px] border-none py-2.5 text-[13.5px] font-semibold transition"
                  style={
                    mode === m
                      ? { background: "#fff", color: "#171438", boxShadow: "0 1px 3px rgba(30,20,80,.12)" }
                      : { background: "transparent", color: "#8a879f" }
                  }
                >
                  {m === "login" ? "เข้าสู่ระบบ" : "ลงทะเบียน"}
                </button>
              ))}
            </div>

            <div className="rounded-[18px] border border-[#eceaf2] bg-white p-6 shadow-[0_12px_40px_-18px_rgba(30,20,80,.28)]">
              {isLogin ? (
                <form onSubmit={handleLogin} className="flex flex-col gap-4">
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold" style={{ color: "#5b5878" }}>
                      ชื่อผู้ใช้ (Username)
                    </label>
                    <div className="relative flex items-center">
                      <UserIcon className="absolute left-3.5 h-4 w-4" style={{ color: "#a4a1bb" }} />
                      <input
                        className={fieldClass + " pl-9"}
                        placeholder="กรอกชื่อผู้ใช้"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        required
                      />
                    </div>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold" style={{ color: "#5b5878" }}>
                      รหัสผ่าน (Password)
                    </label>
                    <div className="relative flex items-center">
                      <Lock className="absolute left-3.5 h-4 w-4" style={{ color: "#a4a1bb" }} />
                      <input
                        type={showPw ? "text" : "password"}
                        className={fieldClass + " pl-9 pr-11"}
                        placeholder="กรอกรหัสผ่าน"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPw((v) => !v)}
                        className="absolute right-2.5 flex cursor-pointer border-none bg-transparent p-1"
                        style={{ color: "#a4a1bb" }}
                      >
                        {showPw ? <EyeOff className="h-[17px] w-[17px]" /> : <Eye className="h-[17px] w-[17px]" />}
                      </button>
                    </div>
                  </div>
                  {error && (
                    <p className="m-0 rounded-lg border border-rose-100 bg-rose-50 p-2 text-center text-xs font-semibold text-rose-600">
                      {error}
                    </p>
                  )}
                  <button
                    type="submit"
                    disabled={loading}
                    className="mt-1 cursor-pointer rounded-xl border-none py-3 text-[14.5px] font-bold text-white transition hover:-translate-y-px disabled:opacity-60"
                    style={{ background: ACCENT, boxShadow: `0 10px 26px -10px ${ACCENT}cc` }}
                  >
                    {loading ? "กำลังเข้าสู่ระบบ…" : "เข้าสู่ระบบ"}
                  </button>
                </form>
              ) : (
                <form onSubmit={handleRegister} className="flex flex-col gap-3.5">
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold" style={{ color: "#5b5878" }}>
                      ชื่อผู้ใช้ (Username)
                    </label>
                    <input className={fieldClass} placeholder="เช่น user_name" value={regUsername} onChange={(e) => setRegUsername(e.target.value)} required />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold" style={{ color: "#5b5878" }}>
                      รหัสผ่าน (Password)
                    </label>
                    <input type="password" className={fieldClass} placeholder="กรอกรหัสความปลอดภัย" value={regPassword} onChange={(e) => setRegPassword(e.target.value)} required />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold" style={{ color: "#5b5878" }}>
                      ชื่อ–นามสกุล
                    </label>
                    <input className={fieldClass} placeholder="ชื่อสกุลผู้เบิก" value={regName} onChange={(e) => setRegName(e.target.value)} required />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold" style={{ color: "#5b5878" }}>
                      แผนก
                    </label>
                    <select className={fieldClass} value={regDepartment} onChange={(e) => setRegDepartment(e.target.value)} required>
                      <option value="" disabled>
                        -- เลือกแผนก --
                      </option>
                      {departments.map((d) => (
                        <option key={d} value={d}>
                          {d}
                        </option>
                      ))}
                    </select>
                  </div>
                  {error && (
                    <p className="m-0 rounded-lg border border-rose-100 bg-rose-50 p-2 text-center text-xs font-semibold text-rose-600">
                      {error}
                    </p>
                  )}
                  <button
                    type="submit"
                    disabled={loading}
                    className="mt-1 cursor-pointer rounded-xl border-none bg-emerald-600 py-3 text-[14.5px] font-bold text-white shadow-[0_10px_26px_-12px_rgba(22,163,74,.7)] transition hover:-translate-y-px hover:bg-emerald-700 disabled:opacity-60"
                  >
                    {loading ? "กำลังลงทะเบียน…" : "ลงทะเบียน"}
                  </button>
                </form>
              )}
            </div>

            <p className="mt-5 text-center text-[12.5px]" style={{ color: "#9a97b5" }}>
              {isLogin ? "ยังไม่มีบัญชีผู้ใช้?" : "มีบัญชีอยู่แล้ว?"}{" "}
              <button
                onClick={() => {
                  setMode(isLogin ? "register" : "login");
                  setError("");
                }}
                className="cursor-pointer border-none bg-transparent p-0 text-[12.5px] font-bold"
                style={{ color: ACCENT }}
              >
                {isLogin ? "ลงทะเบียนผู้ใช้ใหม่" : "กลับเข้าสู่ระบบ"}
              </button>
            </p>
          </div>
        </div>

        <div className="pt-5 text-center text-[10.5px] leading-[1.7]" style={{ color: "#b6b3ca" }}>
          © 2025 THAMC e-Material System
          <br />
          Finance and Accounting Division
        </div>
      </div>
    </div>
  );
}
