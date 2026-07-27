import { Palette } from "lucide-react";
import { useAppStore, type ThemeKey } from "@/store/appStore";

interface ThemeSwitcherProps {
  variant?: "sidebar" | "pill";
}

const NEXT_THEME: Record<ThemeKey, ThemeKey> = { yellow: "red", red: "yellow" };
const LABEL: Record<ThemeKey, string> = { yellow: "ดำ-เหลือง", red: "ดำ-แดง" };

export const ThemeSwitcher = ({ variant = "pill" }: ThemeSwitcherProps): JSX.Element => {
  const { theme, setTheme } = useAppStore();
  const label = LABEL[theme];
  const title = `ธีมปัจจุบัน: ${label} — คลิกเพื่อสลับเป็น ${LABEL[NEXT_THEME[theme]]}`;

  const toggle = () => setTheme(NEXT_THEME[theme]);

  if (variant === "sidebar") {
    return (
      <button
        onClick={toggle}
        title={title}
        className="group relative flex flex-col items-center gap-1 py-2.5 rounded-lg w-full transition-colors duration-200 text-fg/60 hover:text-fg hover:bg-fg/[0.04] focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/50"
      >
        <Palette className="w-5 h-5 flex-shrink-0" />
        <span className="text-[9px] font-medium leading-none">{label}</span>
      </button>
    );
  }

  return (
    <button
      onClick={toggle}
      title={title}
      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-fg/[0.08] text-xs font-semibold text-fg/60 hover:text-fg hover:border-fg/20 transition-colors"
    >
      <Palette className="w-3.5 h-3.5" />
      {label}
    </button>
  );
};
