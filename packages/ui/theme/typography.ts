/**
 * @a3/ui — Typography Scale
 * React Native / Expo SDK 55 — Dark mode only
 */

const FONT_REGULAR  = 'System';
const FONT_MEDIUM   = 'System';
const FONT_SEMIBOLD = 'System';
const FONT_BOLD     = 'System';
const FONT_MONO     = 'monospace';

export const scale = {
  xs: 11, sm: 13, base: 15, md: 17,
  lg: 20, xl: 24, '2xl': 28, '3xl': 34,
} as const;

export const typography = {
  heading1:     { fontFamily: FONT_BOLD,     fontSize: 34, lineHeight: 42, fontWeight: '700' as const, letterSpacing: -0.5 },
  heading2:     { fontFamily: FONT_BOLD,     fontSize: 28, lineHeight: 36, fontWeight: '700' as const, letterSpacing: -0.3 },
  heading3:     { fontFamily: FONT_SEMIBOLD, fontSize: 24, lineHeight: 32, fontWeight: '600' as const, letterSpacing: -0.2 },
  heading4:     { fontFamily: FONT_SEMIBOLD, fontSize: 20, lineHeight: 28, fontWeight: '600' as const },
  bodyLarge:    { fontFamily: FONT_REGULAR,  fontSize: 17, lineHeight: 24, fontWeight: '400' as const },
  body:         { fontFamily: FONT_REGULAR,  fontSize: 15, lineHeight: 22, fontWeight: '400' as const },
  bodySmall:    { fontFamily: FONT_REGULAR,  fontSize: 13, lineHeight: 18, fontWeight: '400' as const },
  label:        { fontFamily: FONT_MEDIUM,   fontSize: 15, lineHeight: 22, fontWeight: '500' as const },
  labelSmall:   { fontFamily: FONT_MEDIUM,   fontSize: 13, lineHeight: 18, fontWeight: '500' as const, letterSpacing: 0.1 },
  caption:      { fontFamily: FONT_REGULAR,  fontSize: 11, lineHeight: 16, fontWeight: '400' as const, letterSpacing: 0.2 },
  button:       { fontFamily: FONT_SEMIBOLD, fontSize: 15, lineHeight: 22, fontWeight: '600' as const, letterSpacing: 0.1 },
  buttonLarge:  { fontFamily: FONT_SEMIBOLD, fontSize: 17, lineHeight: 24, fontWeight: '600' as const, letterSpacing: 0.2 },
  mono:         { fontFamily: FONT_MONO,     fontSize: 15, lineHeight: 22, fontWeight: '400' as const },
  monoLarge:    { fontFamily: FONT_MONO,     fontSize: 24, lineHeight: 32, fontWeight: '700' as const },
  pin:          { fontFamily: FONT_BOLD,     fontSize: 34, lineHeight: 42, fontWeight: '700' as const, letterSpacing: 8 },
  tabLabel:     { fontFamily: FONT_MEDIUM,   fontSize: 11, lineHeight: 16, fontWeight: '500' as const, letterSpacing: 0.3 },
  sectionHeader:{ fontFamily: FONT_SEMIBOLD, fontSize: 11, lineHeight: 16, fontWeight: '600' as const, letterSpacing: 1.2, textTransform: 'uppercase' as const },
} as const;

export default typography;