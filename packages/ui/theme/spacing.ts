/**
 * @a3/ui — Spacing & Layout System
 * 4dp base unit. Touch targets minimum 44×44pt — TDD §9.2
 */

export const spacing = {
    0: 0, 0.5: 2, 1: 4, 1.5: 6, 2: 8, 3: 12,
    4: 16, 5: 20, 6: 24, 7: 28, 8: 32,
    10: 40, 12: 48, 16: 64, 20: 80,
  } as const;
  
  export const radius = {
    none: 0, xs: 4, sm: 6, md: 8,
    lg: 12, xl: 16, '2xl': 20, full: 9999,
  } as const;
  
  export const shadows = {
    none: {},
    sm: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.3, shadowRadius: 2, elevation: 2 },
    md: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.4, shadowRadius: 4, elevation: 4 },
    lg: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.5, shadowRadius: 8, elevation: 8 },
  } as const;
  
  export const layout = {
    touchTarget:         44,
    screenPadding:       16,
    cardPadding:         16,
    tabBarHeight:        56,
    headerHeight:        56,
    buttonHeight:        52,
    inputHeight:         52,
    chipHeight:          32,
    tableCardWidth:     140,
    tableCardHeight:    100,
    clubCardImageHeight: 180,
    dateStripItemWidth:   56,
    dateStripHeight:      72,
    timeSlotItemHeight:   48,
    modalMaxWidth:       480,
  } as const;
  
  export const zIndex = {
    base: 0, card: 10, dropdown: 50,
    sticky: 100, overlay: 200, modal: 300, toast: 400,
  } as const;
  
  export default { spacing, radius, shadows, layout, zIndex };