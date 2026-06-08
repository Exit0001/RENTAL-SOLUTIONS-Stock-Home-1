import { useState, useEffect } from "react";
import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import { StockHome } from "@/pages/StockHome";
import { AuthEntryPage } from "@/pages/AuthEntryPage";
import { LoginPage } from "@/pages/LoginPage";
import { RegisterPage } from "@/pages/RegisterPage";
import { InvitePage } from "@/pages/InvitePage";
import { useAppStore } from "@/store/appStore";
import { supabase } from "@/lib/supabase";

type AuthView = "entry" | "login" | "register";

function AuthGate() {
  const { token, updateToken } = useAppStore();
  const [view, setView]       = useState<AuthView>("entry");
  const [isInvite, setIsInvite] = useState(false);

  useEffect(() => {
    // Supabase ส่ง type=invite มาใน URL hash เมื่อพนักงานคลิก link คำเชิญ
    const hash = new URLSearchParams(window.location.hash.substring(1));
    if (hash.get("type") === "invite") {
      setIsInvite(true);
    }
  }, []);

  useEffect(() => {
    // Supabase รีเฟรช access token เบื้องหลังให้อัตโนมัติ (ทุก ~1 ชม. ก่อนหมดอายุ)
    // แต่ token ที่ใช้ยิง API เก็บแยกไว้ใน Zustand store — ต้อง sync ตามทุกครั้งที่ refresh
    // ไม่งั้น store จะถือ token เก่าที่หมดอายุแล้วไปเรื่อยๆ → ได้ 401 "Invalid token" ซ้ำๆ
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.access_token) {
        updateToken(session.access_token);
      }
    });
    return () => subscription.unsubscribe();
  }, [updateToken]);

  // พนักงานคลิก invite link จากอีเมล
  if (isInvite && !token) return <InvitePage />;

  if (!token) {
    if (view === "login")    return <LoginPage    onBack={() => setView("entry")} />;
    if (view === "register") return <RegisterPage onBack={() => setView("entry")} />;
    return (
      <AuthEntryPage
        onLogin={()    => setView("login")}
        onRegister={()  => setView("register")}
      />
    );
  }

  return (
    <Switch>
      <Route path="/" component={StockHome} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <AuthGate />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
