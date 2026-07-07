import type { RegisterPayload, User } from "../types";

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`/api${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data && (data as any).error) || "เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์");
  }
  return data as T;
}

const qs = (params: Record<string, any>) => {
  const clean: Record<string, string> = {};
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "") clean[k] = String(v);
  });
  const s = new URLSearchParams(clean).toString();
  return s ? `?${s}` : "";
};

export const authApi = {
  departments: () => request<string[]>("/auth/departments"),
  login: (username: string, password: string) =>
    request<User>("/auth/login", { method: "POST", body: JSON.stringify({ username, password }) }),
  register: (payload: RegisterPayload) =>
    request<{ success: boolean }>("/auth/register", { method: "POST", body: JSON.stringify(payload) }),
  updateProfile: (payload: Partial<User> & { password?: string }) =>
    request<{ success: boolean }>("/auth/profile", { method: "PUT", body: JSON.stringify(payload) }),
};

export const inventoryApi = {
  list: () => request<any[]>("/inventory"),
  create: (body: any) => request<any>("/inventory", { method: "POST", body: JSON.stringify(body) }),
  update: (id: string, body: any) => request<any>(`/inventory/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  remove: (id: string) => request<any>(`/inventory/${id}`, { method: "DELETE" }),
  uploadImage: (id: string, base64: string, mimeType: string) =>
    request<any>(`/inventory/${id}/image`, { method: "POST", body: JSON.stringify({ base64, mimeType }) }),
  removeImage: (id: string) => request<any>(`/inventory/${id}/image`, { method: "DELETE" }),
};

export const requisitionApi = {
  create: (requisition: any, items: any[]) =>
    request<any>("/requisitions", { method: "POST", body: JSON.stringify({ requisition, items }) }),
  list: (filters: any, user: User) =>
    request<any[]>(`/requisitions${qs({ ...filters, username: user.username, role: user.role })}`),
  pending: (user: User) => request<any[]>(`/requisitions/pending${qs({ username: user.username, role: user.role })}`),
  details: (id: string) => request<any>(`/requisitions/${id}`),
  batchList: (filters: any, user: User) =>
    request<any[]>("/requisitions/batch/list", { method: "POST", body: JSON.stringify({ filters, user }) }),
  approve: (id: string, body: any) =>
    request<any>(`/requisitions/${id}/approve`, { method: "POST", body: JSON.stringify(body) }),
  batchApprove: (body: any) =>
    request<any>("/requisitions/batch/approve", { method: "POST", body: JSON.stringify(body) }),
  batchByItem: (body: any) =>
    request<any>("/requisitions/batch/by-item", { method: "POST", body: JSON.stringify(body) }),
  complete: (id: string, user: User) =>
    request<any>(`/requisitions/${id}/complete`, { method: "POST", body: JSON.stringify({ user }) }),
  export: (filters: any, user: User) =>
    request<any[]>(`/requisitions/export${qs({ ...filters, username: user.username, role: user.role })}`),
};

export const goodsReceiptApi = {
  submit: (body: any) => request<any>("/goods-receipt", { method: "POST", body: JSON.stringify(body) }),
};

export const dashboardApi = {
  summary: (user: User) => request<any>(`/dashboard${qs({ username: user.username, role: user.role })}`),
};

export const reportsApi = {
  run: (type: string, filters: any) => request<any[]>(`/reports/${type}${qs(filters)}`),
  quick: (days = 30) => request<any>(`/reports/quick${qs({ days })}`),
  categories: () => request<string[]>("/reports/categories"),
  goodIssueSAP: (filters: any) => request<{ rows: any[] }>(`/reports/goodIssueSAP${qs(filters)}`),
};

export const movementApi = {
  search: (query: string) => request<any>(`/movement${qs({ query })}`),
};

export const announcementsApi = {
  get: () => request<any>("/announcements"),
  update: (actor: User, value: any) =>
    request<any>("/announcements", { method: "PUT", body: JSON.stringify({ actorRole: actor.role, value }) }),
};

export const adminApi = {
  users: (actor: User) => request<any[]>(`/admin/users${qs({ actorRole: actor.role })}`),
  updateUser: (username: string, actor: User, body: any) =>
    request<any>(`/admin/users/${username}`, { method: "PUT", body: JSON.stringify({ ...body, actorRole: actor.role }) }),
  deleteUser: (username: string, actor: User) =>
    request<any>(`/admin/users/${username}${qs({ actorRole: actor.role, actorUsername: actor.username })}`, { method: "DELETE" }),
  departments: (actor: User) => request<any[]>(`/admin/departments${qs({ actorRole: actor.role })}`),
  addDepartment: (actor: User, name: string) =>
    request<any>("/admin/departments", { method: "POST", body: JSON.stringify({ name, actorRole: actor.role }) }),
  removeDepartment: (actor: User, id: number) =>
    request<any>(`/admin/departments/${id}${qs({ actorRole: actor.role })}`, { method: "DELETE" }),
};

export const docUrl = (path: string) => path; // ลิงก์เอกสารเป็น /api/documents/view อยู่แล้ว
