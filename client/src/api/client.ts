// Base API client — ทุก request ผ่านที่นี่
// ดึง token จาก Zustand store อัตโนมัติ ไม่ต้องส่งทุกครั้ง
import { useAppStore } from "@/store/appStore";

async function request<T>(
  method: "GET" | "POST" | "PUT" | "DELETE",
  path: string,
  body?: unknown
): Promise<T> {
  // อ่าน token จาก store โดยตรง (ใช้ getState() นอก React component ได้)
  const token = useAppStore.getState().token;

  const res = await fetch(`/api${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token && { Authorization: `Bearer ${token}` }),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(err.message || "Request failed");
  }

  return res.json();
}

export const api = {
  get:    <T>(path: string) => request<T>("GET", path),
  post:   <T>(path: string, body: unknown) => request<T>("POST", path, body),
  put:    <T>(path: string, body: unknown) => request<T>("PUT", path, body),
  delete: <T>(path: string, body?: unknown) => request<T>("DELETE", path, body),
};

// ใช้สำหรับดาวน์โหลดไฟล์ (เช่น PDF) — คืนค่าเป็น Blob แทน JSON
export async function fetchBlob(path: string): Promise<Blob> {
  const token = useAppStore.getState().token;

  const res = await fetch(`/api${path}`, {
    headers: {
      ...(token && { Authorization: `Bearer ${token}` }),
    },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(err.message || "Request failed");
  }

  return res.blob();
}
