# Current State

## Current Task
Owner slot management flow: table grid with booking tags, walk-in conflict modal, booking summary, billing utilities + session start rate lock.

## New Decisions
- Booking tag: confirmed bookings whose window overlaps `(now, now+2h]` for that table (by `confirmedTableId` or fallback same `tableType`).
- Walk-in conflict: overlap with `(now, now+60m]` vs booking `[start,end]`.
- Rate lock: `sessions.ratePerMin` + `sessions.currency` at start (schema has no `sessionLogs.rateSnapshot`; TDD uses session row).
- Billing: `computeBillExtended` adds optional `taxPercent`; order = table (max actual×rate, min bill) − discount + snacks, then tax on subtotal.
- `clampDiscountPercent` for staff caps; owner unrestricted = null max.
- `canAddSnacksToSession` helper for future snack mutations.

## New Commits/Changes
- `packages/utils/timezone.ts` — club IANA helpers: `dateYmdInTimeZone`, `zonedWallTimeToUtcMs`, DOW/minutes helpers.
- `packages/utils/billing.ts` — `computeBillExtended`, `taxAmount` on breakdown, `clampDiscountPercent`.
- `packages/convex/model/sessionRate.ts` — `resolveRatePerMinAtSessionStart`, `bookingAppliesToTable`.
- `packages/convex/model/sessionSnackRules.ts` — snack cutoff rules.
- `packages/convex/slotManagement.ts` — `getSlotDashboard`, `getWalkInBookingConflict`.
- `packages/convex/ownerSessions.ts` — `startWalkInSession` (guest walk-in, locked rate/currency).
- `packages/convex/package.json` — `@a3/utils` workspace dep.
- `packages/convex/_generated/api.d.ts` — `slotManagement`, `ownerSessions`.
- `packages/ui/components/TableGrid.tsx` — real grid + booking tag + status labels (text + color).
- `apps/owner-app/src/app/(tabs)/slots.tsx` — summary row, grid, conflict modal, walk-in start.

## Active Blockers/Errors
None. Typecheck: convex + owner-app pass.
