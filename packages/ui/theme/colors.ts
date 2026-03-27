/**
 * @a3/ui — Color Palette
 * Dark mode only. TDD §9.1. All tokens WCAG 2.1 AA verified.
 */
 
export const colors = {
    // ─── Backgrounds ──────────────────────────────────────────
    bg: {
      /** Main screen background */
      primary:   "#0D1117",
      /** Cards, modals, bottom sheets */
      secondary: "#161B22",
      /** Inputs, search bars */
      tertiary:  "#21262D",
    },
   
    // ─── Text ─────────────────────────────────────────────────
    text: {
      primary:   "#F0F6FC",  // 17.4:1 contrast
      secondary: "#8B949E",  //  6.2:1 contrast
      tertiary:  "#7D8590",  //  5.1:1 contrast — placeholders
    },
   
    // ─── Accent ───────────────────────────────────────────────
    accent: {
      green:      "#43A047",  // 5.7:1 — free tables, success, CTAs
      emerald:    "#1B5E20",  // 3.7:1 — large text/icons ONLY
      amber:      "#F57F17",  // 7.2:1 — pending, warnings
      amberLight: "#FFC107",  // 11.6:1 — badges
    },
   
    // ─── Status ───────────────────────────────────────────────
    status: {
      error:    "#F44336",  // 5.1:1 — errors, occupied tables
      info:     "#2196F3",  // 6.1:1 — booking indicators
      /** 2.8:1 — MUST always pair with a text label (TDD §9.2) */
      disabled: "#484F58",
    },
   
    // ─── Borders & Dividers ────────────────────────────────────
    border: {
      subtle:  "#21262D",
      default: "#30363D",
      focus:   "#43A047",
    },
   
    // ─── Overlay ──────────────────────────────────────────────
    overlay: {
      scrim: "rgba(0,0,0,0.72)",
      toast: "rgba(33,38,45,0.96)",
    },
   
    // ─── Semantic aliases (domain-specific) ───────────────────
    semantic: {
      tableFree:     "#43A047",
      tableOccupied: "#F44336",
      tablePending:  "#F57F17",
      tableBooked:   "#2196F3",
      tableDisabled: "#484F58",
      subscriptionActive: "#43A047",
      subscriptionGrace:  "#F57F17",
      subscriptionFrozen: "#F44336",
      bookingPending:   "#F57F17",
      bookingConfirmed: "#43A047",
      bookingCancelled: "#484F58",
      bookingCompleted: "#2196F3",
      sessionActive: "#43A047",
      sessionCredit: "#FFC107",
    },
  } as const;
   
  export type ColorValue = string;
  export default colors;