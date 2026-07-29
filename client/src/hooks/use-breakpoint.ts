import { useSyncExternalStore } from "react";

// Tailwind's stock breakpoints (tailwind.config.ts does not customize theme.screens):
//   mobile  <  768   (unprefixed — mobile is the base)
//   tablet  768–1023 (md:)
//   desktop >= 1024  (lg:)
// See .claude/skills/stak-mobile-responsive/SKILL.md for the full contract.
const MOBILE_QUERY = "(max-width: 767px)";
const TABLET_QUERY = "(min-width: 768px) and (max-width: 1023px)";

export type Tier = "mobile" | "tablet" | "desktop";

type Snapshot = { isMobile: boolean; isTablet: boolean };

function getSnapshot(): Snapshot {
  if (typeof window === "undefined") {
    return { isMobile: false, isTablet: false };
  }
  return {
    isMobile: window.matchMedia(MOBILE_QUERY).matches,
    isTablet: window.matchMedia(TABLET_QUERY).matches,
  };
}

function getServerSnapshot(): Snapshot {
  return { isMobile: false, isTablet: false };
}

function subscribe(callback: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const mqlMobile = window.matchMedia(MOBILE_QUERY);
  const mqlTablet = window.matchMedia(TABLET_QUERY);
  mqlMobile.addEventListener("change", callback);
  mqlTablet.addEventListener("change", callback);
  return () => {
    mqlMobile.removeEventListener("change", callback);
    mqlTablet.removeEventListener("change", callback);
  };
}

// Cache the last snapshot object so useSyncExternalStore doesn't think the
// store changed on every render (matchMedia().matches returns a fresh
// primitive read each call, but we need referential stability for the
// {isMobile, isTablet} snapshot object itself — recompute only on subscribe).
let cached: Snapshot | null = null;
let cachedIsMobile: boolean | null = null;
let cachedIsTablet: boolean | null = null;
function getCachedSnapshot(): Snapshot {
  const next = getSnapshot();
  if (cached === null || cachedIsMobile !== next.isMobile || cachedIsTablet !== next.isTablet) {
    cached = next;
    cachedIsMobile = next.isMobile;
    cachedIsTablet = next.isTablet;
  }
  return cached;
}

/**
 * The single source of truth for responsive tier in this app.
 * Correct on the FIRST paint (synchronous matchMedia read, no useEffect delay),
 * unlike the old `useIsMobile` which returned `false` until after mount.
 */
export function useBreakpoint(): {
  tier: Tier;
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  isMobileOrTablet: boolean;
} {
  const { isMobile, isTablet } = useSyncExternalStore(subscribe, getCachedSnapshot, getServerSnapshot);
  const isDesktop = !isMobile && !isTablet;
  const tier: Tier = isMobile ? "mobile" : isTablet ? "tablet" : "desktop";
  return { tier, isMobile, isTablet, isDesktop, isMobileOrTablet: isMobile || isTablet };
}
