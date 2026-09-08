import { glass } from "@a3/ui/theme";

/**
 * Customer-app shell — brand green + shared liquid glass from Figma.
 */
export const customerShell = {
  bgDeep: glass.pageBgBottom,
  bgScreen: glass.pageBgFlat,
  cardBg: glass.cardBg,
  cardBorder: glass.cardBorder,
  cardInnerHighlight: glass.cardInnerHighlight,
  iconTileBg: glass.iconTileBg,
  iconTileBorder: glass.iconTileBorder,
  textMuted: glass.textMuted,
  textLabel: glass.textLabel,
  accentGreen: glass.ctaBg,
  accentGreenLight: "#86efac",
  accentBlue: glass.accentBlue,
  trendPositive: glass.trendPositive,
  radiusHero: glass.cardRadius,
  radiusIcon: glass.iconTileRadius,
  tabBarBody: glass.tabPillBody,
} as const;

export function customerTabBarTotalInset(bottomSafeInset: number): number {
  return customerShell.tabBarBody + Math.max(bottomSafeInset, 10) + 24;
}
