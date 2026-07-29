import { Languages } from "lucide-react";
import { useTranslation } from "react-i18next";

interface LanguageSwitcherProps {
  variant?: "sidebar" | "pill" | "drawer";
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
        className="group relative flex flex-col items-center gap-1 py-2.5 rounded-lg w-full transition-colors duration-200 text-fg/60 hover:text-fg hover:bg-fg/[0.04] focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/50"
      >
        <Languages className="w-5 h-5 flex-shrink-0" />
        <span className="text-[10px] font-medium leading-none">{label}</span>
      </button>
    );
  }

  // Full-width left-aligned row matching AppNavDrawer's nav-button style — the
  // "sidebar" variant is a vertical icon+label stack tuned for the 64px desktop
  // rail; reused verbatim in the 280px-wide drawer it renders as an orphaned
  // centered block instead of a row, which reads as broken.
  if (variant === "drawer") {
    return (
      <button
        onClick={toggle}
        title={title}
        className="flex items-center gap-3 min-h-[48px] w-full px-3 rounded-lg text-sm font-medium transition-colors text-fg/70 hover:text-fg hover:bg-fg/[0.04]"
      >
        <Languages className="w-5 h-5 flex-shrink-0" aria-hidden="true" />
        {label}
      </button>
    );
  }

  return (
    <button
      onClick={toggle}
      title={title}
      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-fg/[0.08] text-xs font-semibold text-fg/60 hover:text-fg hover:border-fg/20 transition-colors"
    >
      <Languages className="w-3.5 h-3.5" />
      {label}
    </button>
  );
};
