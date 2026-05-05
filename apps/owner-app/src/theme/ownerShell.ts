/**
 * Owner app shell — visual tokens aligned with Figma “Owner App Layout Design” (dark glass).
 * Keeps @a3/ui typography usage elsewhere; these are owner-specific surfaces.
 */

export const ownerShell = {
  bgDeep: "#05080f",
  bgScreen: "#080b12",
  /** Glass card stack */
  cardBg: "rgba(26, 32, 44, 0.72)",
  cardBorder: "rgba(71, 85, 105, 0.35)",
  cardInnerHighlight: "rgba(148, 163, 184, 0.1)",
  iconTileBg: "rgba(71, 85, 105, 0.35)",
  iconTileBorder: "rgba(100, 116, 139, 0.22)",
  textMuted: "rgba(148, 163, 184, 0.75)",
  textLabel: "rgba(148, 163, 184, 0.62)",
  /** Figma active tab / chart accent */
  accentBlue: "#1e3a8a",
  chartLine: "#60a5fa",
  trendPositive: "#4ade80",
  radiusHero: 24,
  radiusIcon: 14,
  /** Floating tab bar body height (excluding safe-area inset) */
  tabBarBody: 64,
} as const;

export function ownerTabBarTotalInset(bottomSafeInset: number): number {
  return ownerShell.tabBarBody + Math.max(bottomSafeInset, 10) + 24;
}
