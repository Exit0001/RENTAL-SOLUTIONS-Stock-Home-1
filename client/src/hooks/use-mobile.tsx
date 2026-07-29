import { useBreakpoint } from "./use-breakpoint";

// Kept as a thin re-export so existing imports (client/src/components/ui/sidebar.tsx)
// keep compiling. Do NOT reimplement this — the old version returned `false` on the
// first render (state started `undefined`), causing a desktop-layout flash on mobile.
// useBreakpoint() fixes that with a synchronous matchMedia read. See
// .claude/skills/stak-mobile-responsive/SKILL.md.
export function useIsMobile(): boolean {
  return useBreakpoint().isMobile;
}
