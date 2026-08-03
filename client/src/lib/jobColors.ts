// Per-job colours for the schedule views.
//
// Bars used to be coloured by STATUS, which meant every "scheduled" job was the same
// blue — on a month grid with several concurrent jobs you could not tell them apart.
// Colour now identifies the JOB; status is conveyed by dimming instead.
//
// The palette is opaque mid-tone colour with an explicit text colour per entry, so the
// chips stay readable on both themes (dark #0f0f0f and light #f7f7f7 surfaces) without
// needing theme-specific variants.

export interface JobColor {
  /** chip background */
  bg: string;
  /** readable text on that background */
  fg: string;
  /** slightly stronger edge, for borders/dots */
  border: string;
}

export const PALETTE: JobColor[] = [
  { bg: "#3b82f6", fg: "#ffffff", border: "#60a5fa" }, // blue
  { bg: "#f97316", fg: "#ffffff", border: "#fb923c" }, // orange
  { bg: "#10b981", fg: "#052e21", border: "#34d399" }, // emerald
  { bg: "#a855f7", fg: "#ffffff", border: "#c084fc" }, // purple
  { bg: "#ec4899", fg: "#ffffff", border: "#f472b6" }, // pink
  { bg: "#06b6d4", fg: "#04303a", border: "#22d3ee" }, // cyan
  { bg: "#eab308", fg: "#2a2000", border: "#facc15" }, // yellow
  { bg: "#6366f1", fg: "#ffffff", border: "#818cf8" }, // indigo
  { bg: "#14b8a6", fg: "#04302c", border: "#2dd4bf" }, // teal
  { bg: "#f43f5e", fg: "#ffffff", border: "#fb7185" }, // rose
  { bg: "#84cc16", fg: "#1a2e05", border: "#a3e635" }, // lime
  { bg: "#8b5cf6", fg: "#ffffff", border: "#a78bfa" }, // violet
  { bg: "#0ea5e9", fg: "#ffffff", border: "#38bdf8" }, // sky
  { bg: "#d946ef", fg: "#ffffff", border: "#e879f9" }, // fuchsia
  { bg: "#f59e0b", fg: "#2a1a00", border: "#fbbf24" }, // amber
  { bg: "#22c55e", fg: "#052e16", border: "#4ade80" }, // green
];

/** Stable string hash — same job id always yields the same colour across reloads. */
function hash(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) {
    h = (h << 5) - h + id.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

/** Perceived brightness (YIQ) — picks black vs white text for an arbitrary hex. */
function readableText(hex: string): string {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 >= 150 ? "#111111" : "#ffffff";
}

const isHex = (v: string) => /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(v);

/**
 * `color` is the user's explicit choice (jobs.color). When it's absent we fall back to a
 * stable hash of the id, so every job still gets a distinct colour out of the box.
 */
export function jobColor(jobId: string, color?: string | null): JobColor {
  if (color && isHex(color)) {
    const known = PALETTE.find((p) => p.bg.toLowerCase() === color.toLowerCase());
    if (known) return known;
    return { bg: color, fg: readableText(color), border: color };
  }
  return PALETTE[hash(jobId) % PALETTE.length];
}

/**
 * Inline style for a job chip/bar. Status no longer picks the hue — it only decides how
 * prominent the chip is, so a cancelled job still reads as "that job" but recedes.
 */
export function jobChipStyle(jobId: string, status?: string, color?: string | null): React.CSSProperties {
  const c = jobColor(jobId, color);
  if (status === "cancelled") {
    return { backgroundColor: `${c.bg}26`, color: `${c.bg}`, borderColor: `${c.bg}55`, textDecoration: "line-through" };
  }
  if (status === "completed") {
    return { backgroundColor: `${c.bg}80`, color: c.fg, borderColor: c.border };
  }
  if (status === "draft") {
    // draft = planned but not confirmed — same hue, hollow treatment
    return { backgroundColor: `${c.bg}33`, color: c.border, borderColor: `${c.bg}66` };
  }
  return { backgroundColor: c.bg, color: c.fg, borderColor: c.border };
}
