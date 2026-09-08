import { glass } from "@a3/ui/theme";

/**
 * Admin app shell — extends shared `glass` tokens for app-specific sizing.
 */
export const adminShell = {
  bgDeep: glass.pageBgBottom,
  bgScreen: glass.pageBgFlat,
  cardBg: glass.cardBg,
  cardBorder: glass.cardBorder,
  cardInnerHighlight: glass.cardInnerHighlight,
  iconTileBg: glass.iconTileBg,
  iconTileBorder: glass.iconTileBorder,
  textMuted: glass.textMuted,
  textLabel: glass.textLabel,
  accentBlue: glass.accentBlueDeep,
  chartLine: glass.chartLine,
  trendPositive: glass.trendPositive,
  radiusHero: glass.cardRadius,
  radiusIcon: glass.iconTileRadius,
  tabBarBody: glass.tabPillBody,
} as const;

export function adminTabBarTotalInset(bottomSafeInset: number): number {
  return adminShell.tabBarBody + Math.max(bottomSafeInset, 10) + 24;
}
