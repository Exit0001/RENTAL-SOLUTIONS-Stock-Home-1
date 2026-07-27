import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, Users, User, LogOut, Shield, Trash2, Send, Loader2, Camera, Bell, Download, Database } from "lucide-react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/lib/supabase";
import { useAppStore } from "@/store/appStore";
import { authApi, pushApi, backupApi } from "@/api";
import { FileUploadField, uploadAttachment } from "@/components/FileUploadField";

// แปลง VAPID public key (base64url) เป็น Uint8Array สำหรับ pushManager.subscribe()
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

type SettingsTab = "general" | "team" | "profile";

const tabs: { key: SettingsTab; labelKey: string; icon: typeof Building2 }[] = [
  { key: "general", labelKey: "tabCompany", icon: Building2 },
  { key: "team",    labelKey: "tabTeam",    icon: Users },
  { key: "profile", labelKey: "tabProfile", icon: User },
];

const roleColors: Record<string, string> = {
  admin:   "bg-brand/10 text-brand",
  manager: "bg-blue-500/10 text-blue-400",
  crew:    "bg-fg/5 text-fg/60",
};

export const SettingsPage = (): JSX.Element => {
  const { t } = useTranslation("settings");
  const { t: tc } = useTranslation("common");
  const {
    companyName, companyId, userName, userInitials, userRole, avatarUrl,
    token, clearAuth, settingsTab, setSettingsTab, updateProfile, updateCompanyName, updateCompanyLogoUrl,
  } = useAppStore();
  const qc = useQueryClient();
  const [editName, setEditName]     = useState(companyName || "");
  const [companyMsg, setCompanyMsg] = useState("");
  const [lineToken, setLineToken]   = useState("");
  const [lineGroupId, setLineGroupId] = useState("");
  const [lineMsg, setLineMsg]       = useState("");
  const [logoUrl, setLogoUrl]       = useState<string | null>(null);
  const [logoMsg, setLogoMsg]       = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName]   = useState("");
  const [inviteRole, setInviteRole]   = useState<"manager" | "crew">("crew");
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteMsg, setInviteMsg]     = useState("");

  // Profile tab
  const [profileName, setProfileName]           = useState(userName || "");
  const [profileAvatarUrl, setProfileAvatarUrl] = useState(avatarUrl);
  const [avatarUploading, setAvatarUploading]   = useState(false);
  const [profileMsg, setProfileMsg]             = useState("");
  const avatarInputRef = useRef<HTMLInputElement>(null);

  // Push notifications
  const [pushSupported, setPushSupported] = useState(true);
  const [pushSubscribed, setPushSubscribed] = useState(false);
  const [pushLoading, setPushLoading]     = useState(false);
  const [pushMsg, setPushMsg]             = useState("");

  // Backup / export data
  const [backupLoading, setBackupLoading] = useState(false);
  const [backupMsg, setBackupMsg]         = useState("");

  const handleExportBackup = async () => {
    setBackupLoading(true);
    setBackupMsg("");
    try {
      const blob = await backupApi.exportData();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const stamp = new Date().toISOString().slice(0, 10);
      a.download = `stak-backup-${(companyName || "company").replace(/[^a-zA-Z0-9ก-๙_-]+/g, "_")}-${stamp}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setBackupMsg("✓ " + t("backupDone"));
    } catch (err: any) {
      setBackupMsg(err?.message ?? "Export failed");
    } finally {
      setBackupLoading(false);
    }
  };

  const { data: team = [], isLoading: teamLoading } = useQuery({
    queryKey: ["team"], queryFn: authApi.getTeam, enabled: !!token,
  });

  const removeMember = useMutation({
    mutationFn: (userId: string) => authApi.removeMember(userId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["team"] }),
  });

  const handleLogout = async () => {
    await supabase.auth.signOut();
    clearAuth();
  };

  const handleAvatarFile = async (file: File | undefined) => {
    if (!file || !companyId) return;
    setAvatarUploading(true);
    setProfileMsg("");
    try {
      const url = await uploadAttachment(file, "avatars", companyId);
      setProfileAvatarUrl(url);
    } catch (err: any) {
      setProfileMsg(`✗ ${err.message}`);
    } finally {
      setAvatarUploading(false);
      if (avatarInputRef.current) avatarInputRef.current.value = "";
    }
  };

  const saveCompany = useMutation({
    mutationFn: () => authApi.updateCompany({ name: editName }),
    onSuccess: (res) => {
      updateCompanyName(res.name);
      setEditName(res.name);
      setCompanyMsg(`✓ ${t("companySaved")}`);
    },
    onError: (err: any) => setCompanyMsg(`✗ ${err.message}`),
  });

  const { data: companySettings } = useQuery({
    queryKey: ["company-settings"],
    queryFn: authApi.getCompany,
    enabled: !!token && userRole === "admin",
  });

  useEffect(() => {
    if (!companySettings) return;
    setLineToken(companySettings.lineChannelAccessToken || "");
    setLineGroupId(companySettings.lineGroupId || "");
    setLogoUrl(companySettings.companyLogoUrl ?? null);
  }, [companySettings]);

  const saveLine = useMutation({
    mutationFn: () => authApi.updateCompany({ lineChannelAccessToken: lineToken, lineGroupId }),
    onSuccess: () => setLineMsg(`✓ ${t("lineSaved")}`),
    onError: (err: any) => setLineMsg(`✗ ${err.message}`),
  });

  const saveLogo = useMutation({
    mutationFn: (url: string | null) => authApi.updateCompany({ companyLogoUrl: url }),
    onSuccess: (_res, url) => {
      updateCompanyLogoUrl(url);
      setLogoMsg(`✓ ${t("logoSaved")}`);
    },
    onError: (err: any) => setLogoMsg(`✗ ${err.message}`),
  });

  const saveProfile = useMutation({
    mutationFn: () => authApi.updateMe({ name: profileName, avatarUrl: profileAvatarUrl }),
    onSuccess: (res) => {
      updateProfile({ userName: res.name, userInitials: res.initials, avatarUrl: res.avatarUrl });
      setProfileMsg(`✓ ${t("profileSaved")}`);
    },
    onError: (err: any) => setProfileMsg(`✗ ${err.message}`),
  });

  useEffect(() => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setPushSupported(false);
      return;
    }
    navigator.serviceWorker.register("/sw.js")
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => setPushSubscribed(!!sub))
      .catch(() => setPushSupported(false));
  }, []);

  const enablePush = async () => {
    setPushLoading(true);
    setPushMsg("");
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setPushMsg(`✗ ${t("pushPermissionDenied")}`);
        return;
      }
      const registration = await navigator.serviceWorker.register("/sw.js");
      const { publicKey } = await pushApi.getVapidKey();
      const sub = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });
      const json = sub.toJSON();
      await pushApi.subscribe({
        endpoint: json.endpoint!,
        keys: { p256dh: json.keys!.p256dh, auth: json.keys!.auth },
      });
      setPushSubscribed(true);
      setPushMsg(`✓ ${t("pushEnabled")}`);
    } catch (err: any) {
      setPushMsg(`✗ ${err.message}`);
    } finally {
      setPushLoading(false);
    }
  };

  const disablePush = async () => {
    setPushLoading(true);
    setPushMsg("");
    try {
      const registration = await navigator.serviceWorker.getRegistration();
      const sub = await registration?.pushManager.getSubscription();
      if (sub) {
        await pushApi.unsubscribe(sub.endpoint);
        await sub.unsubscribe();
      }
      setPushSubscribed(false);
      setPushMsg(`✓ ${t("pushDisabled")}`);
    } catch (err: any) {
      setPushMsg(`✗ ${err.message}`);
    } finally {
      setPushLoading(false);
    }
  };

  const handleInvite = async () => {
    if (!inviteEmail) { setInviteMsg(t("pleaseEnterEmail")); return; }
    setInviteLoading(true); setInviteMsg("");
    try {
      const res = await fetch("/api/auth/invite", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ email: inviteEmail, name: inviteName, role: inviteRole }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setInviteMsg(`✓ ${data.message}`);
      setInviteEmail(""); setInviteName("");
    } catch (err: any) {
      setInviteMsg(`✗ ${err.message}`);
    } finally {
      setInviteLoading(false);
    }
  };

  return (
    <div className="flex-1 overflow-auto p-6 max-w-3xl" data-testid="page-settings">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-fg">{t("pageTitle")}</h1>
          <p className="text-xs text-fg/60 mt-0.5">{t("pageSubtitle")}</p>
        </div>
        <button onClick={handleLogout}
          className="flex items-center gap-2 px-3 py-2 rounded-lg border border-fg/[0.08] text-xs text-fg/60 hover:text-red-400 hover:border-red-400/20 transition-all">
          <LogOut className="w-3.5 h-3.5" /> {tc("logout")}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-fg/[0.06] mb-6">
        {tabs.map((tab) => (
          <button key={tab.key} onClick={() => setSettingsTab(tab.key)}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition-colors ${
              settingsTab === tab.key ? "border-brand text-brand" : "border-transparent text-fg/60 hover:text-fg"
            }`}>
            <tab.icon className="w-3.5 h-3.5" />{t(tab.labelKey)}
          </button>
        ))}
      </div>

      {/* ─── General ─────────────────────────────────────── */}
      {settingsTab === "general" && (
        <div className="space-y-4">
          <div className="bg-surface-1 border border-fg/[0.06] rounded-xl p-5 space-y-4">
            <h3 className="text-sm font-semibold text-fg/70">{t("companyInformation")}</h3>
            <div>
              <label className="block text-xs text-fg/60 mb-1.5">{t("companyName")}</label>
              <input value={editName} onChange={(e) => setEditName(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg bg-fg/[0.04] border border-fg/[0.08] text-sm text-fg focus:outline-none focus:border-brand/40" />
            </div>
            <div>
              <label className="block text-xs text-fg/60 mb-1.5">{t("planLabel")}</label>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-brand/10 text-brand">{t("freeBadge")}</span>
                <span className="text-xs text-fg/60">{t("upgradeHint")}</span>
              </div>
            </div>

            {companyMsg && (
              <p className={`text-xs px-3 py-2 rounded-lg ${companyMsg.startsWith("✓") ? "text-emerald-400 bg-emerald-400/10" : "text-red-400 bg-red-400/10"}`}>
                {companyMsg}
              </p>
            )}

            <button onClick={() => saveCompany.mutate()} disabled={saveCompany.isPending || !editName.trim()}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-brand/10 text-brand text-xs font-semibold hover:bg-brand/20 transition-colors disabled:opacity-50">
              {saveCompany.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {tc("saveChanges")}
            </button>
          </div>

          {userRole === "admin" && (
            <div className="bg-surface-1 border border-fg/[0.06] rounded-xl p-5 space-y-4">
              <h3 className="text-sm font-semibold text-fg/70">{t("lineIntegration")}</h3>
              <p className="text-xs text-fg/50 leading-relaxed">{t("lineHelpText")}</p>

              <div>
                <label className="block text-xs text-fg/60 mb-1.5">{t("lineTokenLabel")}</label>
                <textarea rows={2} value={lineToken} onChange={(e) => setLineToken(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg bg-fg/[0.04] border border-fg/[0.08] text-sm text-fg font-mono resize-none focus:outline-none focus:border-brand/40" />
              </div>
              <div>
                <label className="block text-xs text-fg/60 mb-1.5">{t("lineGroupIdLabel")}</label>
                <input value={lineGroupId} onChange={(e) => setLineGroupId(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg bg-fg/[0.04] border border-fg/[0.08] text-sm text-fg font-mono focus:outline-none focus:border-brand/40" />
              </div>

              {lineMsg && (
                <p className={`text-xs px-3 py-2 rounded-lg ${lineMsg.startsWith("✓") ? "text-emerald-400 bg-emerald-400/10" : "text-red-400 bg-red-400/10"}`}>
                  {lineMsg}
                </p>
              )}

              <button onClick={() => saveLine.mutate()} disabled={saveLine.isPending}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-brand/10 text-brand text-xs font-semibold hover:bg-brand/20 transition-colors disabled:opacity-50">
                {saveLine.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {tc("saveChanges")}
              </button>
            </div>
          )}

          {userRole === "admin" && (
            <div className="bg-surface-1 border border-fg/[0.06] rounded-xl p-5 space-y-4">
              <h3 className="text-sm font-semibold text-fg/70">{t("logoTitle")}</h3>
              <p className="text-xs text-fg/50 leading-relaxed">{t("logoHelpText")}</p>

              {companyId && (
                <FileUploadField
                  label={t("logoLabel")}
                  folder="logos"
                  companyId={companyId}
                  value={logoUrl}
                  onChange={(url) => { setLogoUrl(url); saveLogo.mutate(url); }}
                />
              )}

              {(logoMsg || saveLogo.isPending) && (
                <p className={`text-xs px-3 py-2 rounded-lg ${saveLogo.isPending ? "text-fg/50 bg-fg/[0.04]" : logoMsg.startsWith("✓") ? "text-emerald-400 bg-emerald-400/10" : "text-red-400 bg-red-400/10"}`}>
                  {saveLogo.isPending ? `${tc("saving")}...` : logoMsg}
                </p>
              )}
            </div>
          )}

          {userRole === "admin" && (
            <div className="bg-surface-1 border border-fg/[0.06] rounded-xl p-5 space-y-4">
              <div className="flex items-center gap-2">
                <Database className="w-4 h-4 text-brand/70" />
                <h3 className="text-sm font-semibold text-fg/70">{t("backupTitle")}</h3>
              </div>
              <p className="text-xs text-fg/50 leading-relaxed">{t("backupHelpText")}</p>

              {backupMsg && (
                <p className={`text-xs px-3 py-2 rounded-lg ${backupMsg.startsWith("✓") ? "text-emerald-400 bg-emerald-400/10" : "text-red-400 bg-red-400/10"}`}>
                  {backupMsg}
                </p>
              )}

              <button onClick={handleExportBackup} disabled={backupLoading}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-brand/10 text-brand text-xs font-semibold hover:bg-brand/20 transition-colors disabled:opacity-50">
                {backupLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                {t("backupExportBtn")}
              </button>
            </div>
          )}
        </div>
      )}

      {/* ─── Team ────────────────────────────────────────── */}
      {settingsTab === "team" && (
        <div className="space-y-4">
          {/* Invite */}
          {userRole === "admin" && (
            <div className="bg-surface-1 border border-fg/[0.06] rounded-xl p-5">
              <h3 className="text-sm font-semibold text-fg/70 mb-3">{t("inviteNewMember")}</h3>
              <div className="space-y-2">
                <div className="flex gap-2">
                  <input value={inviteName} onChange={(e) => setInviteName(e.target.value)}
                    placeholder={t("memberNamePlaceholder")}
                    className="flex-1 px-3 py-2 rounded-lg bg-fg/[0.04] border border-fg/[0.08] text-sm text-fg placeholder:text-fg/60 focus:outline-none focus:border-brand/40" />
                </div>
                <div className="flex gap-2">
                  <input value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder={t("memberEmailPlaceholder")}
                    type="email"
                    className="flex-1 px-3 py-2 rounded-lg bg-fg/[0.04] border border-fg/[0.08] text-sm text-fg placeholder:text-fg/60 focus:outline-none focus:border-brand/40" />
                  <select value={inviteRole} onChange={(e) => setInviteRole(e.target.value as any)}
                    className="px-3 py-2 rounded-lg bg-fg/[0.04] border border-fg/[0.08] text-sm text-fg/70 focus:outline-none focus:border-brand/40 transition-colors appearance-none cursor-pointer">
                    <option value="crew" className="bg-surface-1">{t("roles.crew")}</option>
                    <option value="manager" className="bg-surface-1">{t("roles.manager")}</option>
                  </select>
                  <button onClick={handleInvite} disabled={inviteLoading}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-brand text-black text-xs font-bold hover:opacity-90 disabled:opacity-50">
                    {inviteLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                    {tc("send")}
                  </button>
                </div>
                {inviteMsg && (
                  <p className={`text-xs px-3 py-2 rounded-lg ${inviteMsg.startsWith("✓") ? "text-emerald-400 bg-emerald-400/10" : "text-red-400 bg-red-400/10"}`}>
                    {inviteMsg}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Team list */}
          <div className="bg-surface-1 border border-fg/[0.06] rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-fg/[0.06] flex items-center gap-2">
              <Shield className="w-4 h-4 text-brand" />
              <span className="text-xs font-bold text-brand tracking-widest uppercase">{t("allMembers")}</span>
              <span className="ml-auto text-[10px] text-fg/60">{t("membersCount", { count: team.length })}</span>
            </div>
            <div className="divide-y divide-fg/[0.04]">
              {teamLoading && (
                <div className="px-4 py-6 text-center text-xs text-fg/60">{tc("loading")}</div>
              )}
              {team.map((member) => (
                <div key={member.id} className="flex items-center gap-4 px-4 py-3">
                  {member.avatarUrl ? (
                    <img src={member.avatarUrl} alt={member.name} className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-brand/10 flex items-center justify-center text-xs font-bold text-brand/70 flex-shrink-0">
                      {member.initials}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-fg/80">{member.name}</p>
                    <p className="text-xs text-fg/60">{member.email}</p>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${roleColors[member.role]}`}>
                    {t(`roles.${member.role}`)}
                  </span>
                  {userRole === "admin" && member.role !== "admin" && (
                    <button onClick={() => removeMember.mutate(member.id)}
                      disabled={removeMember.isPending && removeMember.variables === member.id}
                      className="p-1.5 rounded-lg text-fg/60 hover:text-red-400 hover:bg-red-400/10 transition-colors disabled:opacity-50">
                      {removeMember.isPending && removeMember.variables === member.id
                        ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        : <Trash2 className="w-3.5 h-3.5" />}
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Role guide */}
          <div className="bg-surface-1 border border-fg/[0.06] rounded-xl p-4">
            <p className="text-xs font-semibold text-fg/50 mb-2">{t("roleGuideTitle")}</p>
            <div className="space-y-1.5 text-xs text-fg/60">
              <div className="flex gap-2"><span className="text-brand font-semibold w-16">{t("roles.admin")}</span>{t("roleAdminDesc")}</div>
              <div className="flex gap-2"><span className="text-blue-400 font-semibold w-16">{t("roles.manager")}</span>{t("roleManagerDesc")}</div>
              <div className="flex gap-2"><span className="text-fg/60 font-semibold w-16">{t("roles.crew")}</span>{t("roleCrewDesc")}</div>
            </div>
          </div>
        </div>
      )}

      {/* ─── Profile ─────────────────────────────────────── */}
      {settingsTab === "profile" && (
        <div className="space-y-4">
          <div className="bg-surface-1 border border-fg/[0.06] rounded-xl p-5 space-y-4">
            <div className="flex items-center gap-4">
              <input ref={avatarInputRef} type="file" accept="image/*" className="hidden"
                onChange={(e) => handleAvatarFile(e.target.files?.[0])} />
              <button type="button" onClick={() => avatarInputRef.current?.click()} disabled={avatarUploading}
                className="relative w-14 h-14 rounded-full group cursor-pointer disabled:cursor-wait flex-shrink-0">
                {profileAvatarUrl ? (
                  <img src={profileAvatarUrl} alt={userName || ""} className="w-14 h-14 rounded-full object-cover" />
                ) : (
                  <div className="w-14 h-14 rounded-full bg-brand/10 flex items-center justify-center text-lg font-bold text-brand">
                    {userInitials || "?"}
                  </div>
                )}
                <div className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  {avatarUploading ? <Loader2 className="w-4 h-4 text-fg animate-spin" /> : <Camera className="w-4 h-4 text-fg" />}
                </div>
              </button>
              <div>
                <p className="font-semibold text-fg">{userName}</p>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${roleColors[userRole || "crew"]}`}>
                  {t(`roles.${userRole || "crew"}`)}
                </span>
              </div>
            </div>

            <div>
              <label className="block text-xs text-fg/60 mb-1.5">{t("fullName")}</label>
              <input value={profileName} onChange={(e) => setProfileName(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg bg-fg/[0.04] border border-fg/[0.08] text-sm text-fg focus:outline-none focus:border-brand/40" />
            </div>

            <div className="pt-3 border-t border-fg/[0.06]">
              <label className="block text-xs text-fg/60 mb-1.5">{t("changePassword")}</label>
              <div className="space-y-2">
                <input type="password" placeholder={t("newPasswordPlaceholder")}
                  className="w-full px-3 py-2.5 rounded-lg bg-fg/[0.04] border border-fg/[0.08] text-sm text-fg placeholder:text-fg/60 focus:outline-none focus:border-brand/40" />
                <input type="password" placeholder={t("confirmPasswordPlaceholder")}
                  className="w-full px-3 py-2.5 rounded-lg bg-fg/[0.04] border border-fg/[0.08] text-sm text-fg placeholder:text-fg/60 focus:outline-none focus:border-brand/40" />
              </div>
            </div>

            {profileMsg && (
              <p className={`text-xs px-3 py-2 rounded-lg ${profileMsg.startsWith("✓") ? "text-emerald-400 bg-emerald-400/10" : "text-red-400 bg-red-400/10"}`}>
                {profileMsg}
              </p>
            )}

            <button onClick={() => saveProfile.mutate()} disabled={saveProfile.isPending}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-brand/10 text-brand text-xs font-semibold hover:bg-brand/20 transition-colors disabled:opacity-50">
              {saveProfile.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {tc("save")}
            </button>
          </div>

          <div className="bg-surface-1 border border-fg/[0.06] rounded-xl p-5 space-y-4">
            <h3 className="text-sm font-semibold text-fg/70 flex items-center gap-2">
              <Bell className="w-4 h-4 text-brand" />
              {t("pushNotifications")}
            </h3>
            <p className="text-xs text-fg/50 leading-relaxed">{t("pushHelpText")}</p>

            {!pushSupported ? (
              <p className="text-xs text-fg/40">{t("pushUnsupported")}</p>
            ) : (
              <>
                {pushMsg && (
                  <p className={`text-xs px-3 py-2 rounded-lg ${pushMsg.startsWith("✓") ? "text-emerald-400 bg-emerald-400/10" : "text-red-400 bg-red-400/10"}`}>
                    {pushMsg}
                  </p>
                )}
                <button onClick={() => (pushSubscribed ? disablePush() : enablePush())} disabled={pushLoading}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50 ${
                    pushSubscribed ? "bg-fg/[0.06] text-fg/70 hover:bg-fg/[0.1]" : "bg-brand/10 text-brand hover:bg-brand/20"
                  }`}>
                  {pushLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  {pushSubscribed ? t("disablePush") : t("enablePush")}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
