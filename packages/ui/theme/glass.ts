/**
 * Liquid-glass design tokens — Figma "A3 Billiards OS" (33:8218, Section 1).
 *
 * Shared across admin / owner / customer apps. Mimics frosted layered glass:
 * deep navy canvas, soft ambient orbs (see `GlassPageBackground`), translucent
 * cards with top sheen, floating pill navigation.
 */
export const glass = {
  /** Page-level deep gradient endpoints (top → bottom). */
  pageBgTop: "#0a1128",
  pageBgBottom: "#050810",
  /** Slightly lifted base for stack screens without gradient wrapper */
  pageBgFlat: "#060912",

  /** Ambient glow orbs — used by `GlassPageBackground` (layered circles). */
  orbBlue: "rgba(56, 189, 248, 0.09)",
  orbViolet: "rgba(99, 102, 241, 0.07)",
  orbGreen: "rgba(67, 160, 71, 0.06)",
  /** Bottom vignette — pools depth like liquid at the base */
  vignetteBottom: "rgba(0, 0, 0, 0.45)",

  /** Glass card — primary surface */
  cardBg: "rgba(30, 41, 59, 0.52)",
  cardBorder: "rgba(148, 163, 184, 0.22)",
  /** Second hairline for extra depth (optional outer rim feel) */
  cardBorderOuter: "rgba(15, 23, 42, 0.55)",
  /** Top-edge inset highlight (the "liquid sheen") */
  cardInnerHighlight: "rgba(226, 232, 240, 0.14)",
  cardRadius: 24,
  cardRadiusSmall: 18,
  cardShadow: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.55,
    shadowRadius: 28,
    elevation: 14,
  } as const,

  /** In-card / auth fields — sunken glass */
  inputBg: "rgba(15, 23, 42, 0.65)",
  inputBorder: "rgba(148, 163, 184, 0.18)",
  inputBorderFocus: "rgba(56, 189, 248, 0.45)",
  inputPlaceholder: "rgba(148, 163, 184, 0.45)",

  /** Icon tile (40×40 rounded square inside cards) */
  iconTileBg: "rgba(51, 65, 85, 0.45)",
  iconTileBorder: "rgba(148, 163, 184, 0.16)",
  iconTileRadius: 14,
  iconTileSize: 40,

  /** Brand mark tile (login logo) */
  logoTileBg: "rgba(67, 160, 71, 0.14)",
  logoTileBorder: "rgba(134, 239, 172, 0.28)",

  /** Floating tab-bar pill */
  tabPillBg: "rgba(22, 30, 45, 0.94)",
  tabPillBorder: "rgba(148, 163, 184, 0.2)",
  tabPillInnerHighlight: "rgba(226, 232, 240, 0.12)",
  tabPillRadius: 9999,
  tabPillBody: 64,
  tabPillShadow: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.65,
    shadowRadius: 28,
    elevation: 18,
  } as const,

  /** Primary CTA on glass (filled) */
  ctaBg: "#43A047",
  ctaBgPressed: "#2e7d32",
  ctaText: "#ffffff",

  /** Text colors used inside glass surfaces */
  textPrimary: "#f8fafc",
  textMuted: "rgba(148, 163, 184, 0.82)",
  textLabel: "rgba(148, 163, 184, 0.58)",

  /** Accents */
  accentBlue: "#60a5fa",
  accentBlueDeep: "#1e3a8a",
  accentSky: "#7dd3fc",
  trendPositive: "#4ade80",
  trendNegative: "#f87171",
  chartLine: "#60a5fa",
} as const;

export type GlassTokens = typeof glass;
