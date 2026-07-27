import { Building2, LogIn, Mail, ChevronRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";

interface AuthEntryPageProps {
  onLogin:    () => void;
  onRegister: () => void;
}

export const AuthEntryPage = ({ onLogin, onRegister }: AuthEntryPageProps) => {
  const { t } = useTranslation("auth");

  return (
    <div className="min-h-screen bg-surface-0 flex items-center justify-center p-6">
      <div className="absolute top-4 right-4">
        <LanguageSwitcher />
      </div>

      <div className="w-full max-w-sm space-y-6">

        {/* Branding */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-brand/10 border border-brand/20 mb-2">
            <span className="text-3xl font-black text-brand leading-none">S</span>
          </div>
          <h1 className="text-2xl font-black text-fg tracking-tight">STAK</h1>
          <p className="text-xs text-fg/60">{t("tagline")}</p>
        </div>

        {/* ─── ฝั่งบริษัท ─── */}
        <div className="space-y-3">
          <p className="text-[10px] text-fg/60 uppercase tracking-widest text-center">{t("hasAccount")}</p>

          <button
            onClick={onLogin}
            className="w-full flex items-center justify-between px-4 py-3.5 rounded-xl bg-brand text-black text-sm font-bold hover:opacity-90 active:scale-[0.99] transition-all"
          >
            <span className="flex items-center gap-2.5">
              <LogIn className="w-4 h-4" />
              {t("login")}
            </span>
            <ChevronRight className="w-4 h-4 opacity-50" />
          </button>

          <button
            onClick={onRegister}
            className="w-full flex items-center justify-between px-4 py-3.5 rounded-xl bg-transparent border border-fg/[0.08] text-fg/60 text-sm font-medium hover:border-fg/20 hover:text-fg/80 active:scale-[0.99] transition-all"
          >
            <span className="flex items-center gap-2.5">
              <Building2 className="w-4 h-4" />
              {t("createCompany")}
            </span>
            <ChevronRight className="w-4 h-4 opacity-30" />
          </button>
        </div>

        {/* Divider */}
        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-fg/[0.05]" />
          <span className="text-[10px] text-fg/40 uppercase tracking-widest">{t("staff")}</span>
          <div className="flex-1 h-px bg-fg/[0.05]" />
        </div>

        {/* ─── ฝั่งพนักงาน ─── */}
        <div className="flex items-start gap-3.5 p-4 rounded-xl bg-fg/[0.02] border border-fg/[0.06]">
          <div className="w-8 h-8 rounded-lg bg-brand/8 flex items-center justify-center flex-shrink-0 mt-0.5">
            <Mail className="w-4 h-4 text-brand/50" />
          </div>
          <div className="space-y-1">
            <p className="text-xs font-semibold text-fg/50">{t("inviteTitle")}</p>
            <p className="text-[11px] text-fg/60 leading-relaxed">
              {t("inviteBodyPrefix")}{" "}
              <span className="text-brand/40 font-medium">"{t("acceptInvite")}"</span>
              {" "}{t("inviteBodySuffix")}
            </p>
          </div>
        </div>

      </div>
    </div>
  );
};
