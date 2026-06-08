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
};

type AppStore = {
  // ---- Auth (เก็บใน localStorage) ----
  auth: AuthState | null;
  setAuth:    (auth: AuthState) => void;
  clearAuth:  () => void;
  updateToken: (token: string) => void;

  // shortcuts อ่านค่าจาก auth ง่ายขึ้น
  companyId:    string | null;
  companyName:  string | null;
  userRole:     UserRole | null;
  userName:     string | null;
  userInitials: string | null;
  token:        string | null;

  // ---- Navigation ----
  activePage: string;
  setActivePage: (page: string) => void;

  // ---- Containers UI state ----
  expandedContainers:   string[];
  checkedOutContainers: Set<string>;
  toggleContainer:  (id: string) => void;
  toggleCheckout:   (id: string) => void;
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
        token:        auth.token,
      }),
      clearAuth: () => set({
        auth: null,
        companyId: null, companyName: null,
        userRole: null, userName: null,
        userInitials: null, token: null,
      }),
      // Supabase รีเฟรช access token อัตโนมัติเบื้องหลัง (ทุก ~1 ชม.) —
      // ต้อง sync token ใหม่เข้า store ไม่งั้น request จะใช้ token เก่าที่หมดอายุแล้ว → 401 Invalid token
      updateToken: (token) => set((state) => ({
        token,
        auth: state.auth ? { ...state.auth, token } : state.auth,
      })),

      // shortcuts (sync กับ auth)
      companyId:    null,
      companyName:  null,
      userRole:     null,
      userName:     null,
      userInitials: null,
      token:        null,

      // ---- Navigation ----
      activePage: "Home",
      setActivePage: (page) => set({ activePage: page }),

      // ---- Containers UI ----
      expandedContainers:   ["C1"],
      checkedOutContainers: new Set(),

      toggleContainer: (id) =>
        set((state) => ({
          expandedContainers: state.expandedContainers.includes(id)
            ? state.expandedContainers.filter((r) => r !== id)
            : [...state.expandedContainers, id],
        })),

      toggleCheckout: (id) =>
        set((state) => {
          const next = new Set(state.checkedOutContainers);
          if (next.has(id)) next.delete(id); else next.add(id);
          return { checkedOutContainers: next };
        }),
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
          state.token        = state.auth.token;
        }
      },
    }
  )
);
