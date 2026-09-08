import { glass } from "@a3/ui/theme";

/**
 * Owner app shell — extends shared `glass` tokens.
 */
export const ownerShell = {
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

export function ownerTabBarTotalInset(bottomSafeInset: number): number {
  return ownerShell.tabBarBody + Math.max(bottomSafeInset, 10) + 24;
}
