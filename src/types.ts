export type Role = "Admin" | "Manager" | "Staff" | "User";

export interface User {
  username: string;
  name: string;
  department: string;
  role: Role;
}

export interface RegisterPayload {
  username: string;
  password: string;
  name: string;
  department: string;
  role?: Role;
}
