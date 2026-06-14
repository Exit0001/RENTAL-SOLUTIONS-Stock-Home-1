import { create } from "zustand";
import { persist } from "zustand/middleware";

type UserRole = "admin" | "manager" | "crew";

type AuthState = {
  token:        string;
  userId:       string;
  userName:     string;
  userInitials: string;
  userRole:     UserRole;
  companyId:    string;
  companyName:  string;
  avatarUrl:    string | null;
};

type SettingsTab = "general" | "team" | "profile";

type AppStore = {
  // ---- Auth (เก็บใน localStorage) ----
  auth: AuthState | null;
  setAuth:    (auth: AuthState) => void;
  clearAuth:  () => void;
  updateToken: (token: string) => void;
  updateProfile: (data: Partial<Pick<AuthState, "userName" | "userInitials" | "avatarUrl">>) => void;
  updateCompanyName: (name: string) => void;

  // shortcuts อ่านค่าจาก auth ง่ายขึ้น
  companyId:    string | null;
  companyName:  string | null;
  userRole:     UserRole | null;
  userName:     string | null;
  userInitials: string | null;
  avatarUrl:    string | null;
  token:        string | null;

  // ---- Navigation ----
  activePage: string;
  setActivePage: (page: string) => void;

  // ---- Settings UI state ----
  settingsTab:    SettingsTab;
  setSettingsTab: (tab: SettingsTab) => void;

  // ---- Containers UI state ----
  expandedContainers: string[];
  toggleContainer:    (id: string) => void;
};

export const useAppStore = create<AppStore>()(
  persist(
    (set) => ({
      // ---- Auth ----
      auth: null,
      setAuth: (auth) => set({
        auth,
        companyId:    auth.companyId,
        companyName:  auth.companyName,
        userRole:     auth.userRole,
        userName:     auth.userName,
        userInitials: auth.userInitials,
        avatarUrl:    auth.avatarUrl,
        token:        auth.token,
      }),
      clearAuth: () => set({
        auth: null,
        companyId: null, companyName: null,
        userRole: null, userName: null,
        userInitials: null, avatarUrl: null, token: null,
      }),
      // Supabase รีเฟรช access token อัตโนมัติเบื้องหลัง (ทุก ~1 ชม.) —
      // ต้อง sync token ใหม่เข้า store ไม่งั้น request จะใช้ token เก่าที่หมดอายุแล้ว → 401 Invalid token
      updateToken: (token) => set((state) => ({
        token,
        auth: state.auth ? { ...state.auth, token } : state.auth,
      })),
      // หลังบันทึกโปรไฟล์สำเร็จ — sync ชื่อ/รูปใหม่เข้า store ทันที (header อัปเดตโดยไม่ต้อง reload)
      updateProfile: (data) => set((state) => ({
        ...data,
        auth: state.auth ? { ...state.auth, ...data } : state.auth,
      })),
      updateCompanyName: (name) => set((state) => ({
        companyName: name,
        auth: state.auth ? { ...state.auth, companyName: name } : state.auth,
      })),

      // shortcuts (sync กับ auth)
      companyId:    null,
      companyName:  null,
      userRole:     null,
      userName:     null,
      userInitials: null,
      avatarUrl:    null,
      token:        null,

      // ---- Navigation ----
      activePage: "Home",
      setActivePage: (page) => set({ activePage: page }),

      // ---- Settings UI state ----
      settingsTab: "general",
      setSettingsTab: (tab) => set({ settingsTab: tab }),

      // ---- Containers UI ----
      expandedContainers: ["C1"],

      toggleContainer: (id) =>
        set((state) => ({
          expandedContainers: state.expandedContainers.includes(id)
            ? state.expandedContainers.filter((r) => r !== id)
            : [...state.expandedContainers, id],
        })),
    }),
    {
      name: "stak-store",
      partialize: (state) => ({ auth: state.auth }),
      // hydrate shortcuts จาก auth ตอน load
      onRehydrateStorage: () => (state) => {
        if (state?.auth) {
          state.companyId    = state.auth.companyId;
          state.companyName  = state.auth.companyName;
          state.userRole     = state.auth.userRole;
          state.userName     = state.auth.userName;
          state.userInitials = state.auth.userInitials;
          state.avatarUrl    = state.auth.avatarUrl ?? null;
          state.token        = state.auth.token;
        }
      },
    }
  )
);
