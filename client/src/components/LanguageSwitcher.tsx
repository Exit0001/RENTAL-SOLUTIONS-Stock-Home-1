import { Languages } from "lucide-react";
import { useTranslation } from "react-i18next";

interface LanguageSwitcherProps {
  variant?: "sidebar" | "pill";
}

export const LanguageSwitcher = ({ variant = "pill" }: LanguageSwitcherProps): JSX.Element => {
  const { i18n, t } = useTranslation("nav");
  const isEn = i18n.language === "en";
  const label = isEn ? "EN" : "ไทย";
  const title = isEn ? t("switchToThai") : t("switchToEnglish");

  const toggle = () => i18n.changeLanguage(isEn ? "th" : "en");

  if (variant === "sidebar") {
    return (
      <button
        onClick={toggle}
        title={title}
        className="group relative flex flex-col items-center gap-1 py-2.5 rounded-lg w-full transition-colors duration-200 text-white/60 hover:text-white hover:bg-white/[0.04] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FFFF00]/50"
      >
        <Languages className="w-5 h-5 flex-shrink-0" />
        <span className="text-[10px] font-medium leading-none">{label}</span>
      </button>
    );
  }

  return (
    <button
      onClick={toggle}
      title={title}
      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-white/[0.08] text-xs font-semibold text-white/60 hover:text-white hover:border-white/20 transition-colors"
    >
      <Languages className="w-3.5 h-3.5" />
      {label}
    </button>
  );
};
