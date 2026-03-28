# A3 Billiards OS — Booking Specification

> Extracted from PRD v23.0 Final + TDD v1.4
> Covers: state machine · submission validation · availability engine · cron jobs · cancellation rules · limits · edge cases · error codes

---

## Table of Contents

1. [Overview](#1-overview)
2. [Booking Settings Prerequisites](#2-booking-settings-prerequisites)
3. [Customer Booking Flow](#3-customer-booking-flow)
4. [Booking State Machine](#4-booking-state-machine)
5. [submitBooking — 11 Validation Checks](#5-submitbooking--11-validation-checks)
6. [Availability Engine](#6-availability-engine)
7. [Owner Actions](#7-owner-actions)
8. [startSessionFromBooking](#8-startsessionfrombooking)
9. [Cancellation Rules](#9-cancellation-rules)
10. [Booking Limits](#10-booking-limits)
11. [Cron Job Specifications](#11-cron-job-specifications)
12. [FCM Notifications](#12-fcm-notifications)
13. [Data Written on Each Transition](#13-data-written-on-each-transition)
14. [Error Codes](#14-error-codes)
15. [Edge Cases](#15-edge-cases)

---

## 1. Overview

Bookings are **reservation-only** — no payment is collected at booking time. Billing occurs at session checkout following the existing session lifecycle.

| Property | Value |
|----------|-------|
| Payment at booking | None — Phase 2 |
| Requires owner approval | Yes — every booking |
| Max active bookings per customer per club | 2 |
| Max clubs with active bookings simultaneously | 2 |
| Max customer cancellations per club per day | 3 |
| Booking states | 7 |
| Valid transitions | 8 |
| `submitBooking` validation checks | 11 (fail-fast, ordered) |
| All times displayed in | Club's timezone (`clubs.timezone`) |
| Pending bookings block availability | Yes (conservative v1 design) |

---

## 2. Booking Settings Prerequisites

Before a club can enable online booking, all four conditions must be met. The backend validates on save and rejects with a descriptive error (`CLUB_002`) if any are unmet.

| Condition | Requirement |
|-----------|-------------|
| Bookable table types | At least 1 type selected in `bookingSettings.bookableTableTypes` |
| Bookable hours | `bookingSettings.bookableHours` must be configured (not `undefined`) |
| Operating hours | `clubs.operatingHours` must be set — null blocks the enable action with: `'Please set your club operating hours before enabling online booking'` |
| Active matching tables | At least 1 active table (`isActive=true`) whose `tableType` matches a selected bookable type |

`bookableHours` must fall **within** `operatingHours` — validated server-side on save (`CLUB_004`). Example: a club open 10 AM–12 AM may only accept bookings 10 AM–10 PM.

**`bookingSettings` defaults** (set atomically at club creation):

| Field | Default |
|-------|---------|
| `enabled` | `false` |
| `maxAdvanceDays` | `7` |
| `minAdvanceMinutes` | `60` |
| `slotDurationOptions` | `[30, 60, 90, 120]` |
| `cancellationWindowMin` | `30` |
| `approvalDeadlineMin` | `60` |
| `bookableTableTypes` | `[]` |
| `bookableHours` | `undefined` |

When `enabled` is set to `false`, the club disappears from new booking flows, but **existing confirmed bookings are NOT auto-cancelled** — the owner must cancel them manually if intended.

---

## 3. Customer Booking Flow

All dates and times are displayed in the **club's timezone** (`clubs.timezone`), not the customer's device timezone. A label (e.g., `'Times shown in IST'`) is shown if the customer is in a different timezone.

### Steps

| # | Step | Detail |
|---|------|--------|
| 1 | **Select table type** | Tappable cards for each type in `bookingSettings.bookableTableTypes`. Shows count of available tables per type. |
| 2 | **Select date** | Horizontal scrollable date strip. Next N days (`maxAdvanceDays`). Days outside `bookableHours.daysOfWeek` are greyed and unselectable. Past dates never shown. |
| 3 | **Select duration** | Buttons for each value in `slotDurationOptions` (e.g., `'30 min'`, `'1 hour'`, `'1.5 hours'`). |
| 4 | **Select time** | Grid of available start times in 30-min increments within `bookableHours`. Powered by `getAvailableSlots` reactive query. Unavailable slots are greyed. Updates in real time — a slot disappears immediately if another customer books it. |
| 4a | **Stale slot warning** | If the customer has been on the time selection step for > 5 minutes without submitting, a soft banner appears: `'Availability updates in real time — re-check your selection before submitting.'` Disappears when the customer taps a time slot. |
| 5 | **Review & submit** | Summary: club name, table type, date, time, duration, estimated cost, optional notes (max 200 chars). On submit, calls `submitBooking` mutation. |

**Estimated cost formula shown at review:**
```
estimatedCost = max(requestedDurationMin, minBillMinutes) × applicableRate
```
If `requestedDurationMin < minBillMinutes`, a prominent warning is shown: `'Minimum charge is [N] minutes. Your booking will be billed at the [N]-minute rate.'`

`applicableRate` = `specialRate.ratePerMin` if the requested start time and day-of-week fall within a `specialRate` window; otherwise `club.baseRatePerMin`. The estimate is labelled as approximate — actual billing at checkout may differ due to session duration exceeding booked duration, minimum bill minutes, discounts, and snacks.

The booking flow is a **single screen** with a step indicator. A back button lets the customer revise previous selections without losing state. A cancel/close button is always available to exit and return to the club profile. Selections are held in client-side state until submission.

---

## 4. Booking State Machine

Seven states. Every mutation verifies the current status before applying the transition. Invalid transitions throw `BOOKING_006`.

```
                    ┌─────────────────────────────────────────────┐
                    │            pending_approval                  │
                    └───┬──────────┬──────────────┬───────────────┘
                        │          │              │               │
                    confirmed   rejected   cancelled_by_    expired
                        │                   customer    (deadline cron)
          ┌─────────────┼──────────────────────┐
          │             │                      │              │
   cancelled_by_  cancelled_by_          completed        expired
     customer       club            (startSession     (no-show cron)
                                    FromBooking)
```

### Valid Transitions

| From | To | Trigger | Mutation |
|------|----|---------|----------|
| `pending_approval` | `confirmed` | Owner approves | `approveBooking` |
| `pending_approval` | `rejected` | Owner rejects | `rejectBooking` |
| `pending_approval` | `cancelled_by_customer` | Customer cancels | `cancelBooking` |
| `pending_approval` | `expired` | Approval deadline cron | `checkApprovalDeadlines` |
| `confirmed` | `cancelled_by_customer` | Customer cancels | `cancelBooking` |
| `confirmed` | `cancelled_by_club` | Owner cancels | `clubCancelBooking` |
| `confirmed` | `completed` | Staff starts session | `startSessionFromBooking` |
| `confirmed` | `expired` | No-show: 30 min past start with no session | `detectNoShows` |

No other transitions are valid. All other attempts throw `BOOKING_006`.

### Terminal States

| State | Meaning |
|-------|---------|
| `rejected` | Owner declined the request |
| `cancelled_by_customer` | Customer cancelled |
| `cancelled_by_club` | Owner cancelled |
| `expired` | Deadline or no-show triggered |
| `completed` | Converted to an active session |

---

## 5. `submitBooking` — 11 Validation Checks

Executed in order. Fail-fast — the first failing check throws and stops processing.

| # | Check | Error |
|---|-------|-------|
| 1 | Customer authenticated, `isFrozen === false`, `deletionRequestedAt === null`, `phoneVerified === true` | `AUTH_002` / `AUTH_004` / `AUTH_006` |
| 2 | `bookingSettings.enabled === true` AND `subscriptionStatus !== 'frozen'` | `BOOKING_004` / `SUB_001` |
| 3 | `tableType` is in `bookingSettings.bookableTableTypes` | `BOOKING_009` |
| 4 | `requestedDate` is not in the past AND is within `today + maxAdvanceDays` (computed in club's timezone) | `BOOKING_008` |
| 5 | `requestedStartTime` falls within `bookableHours.open`/`.close` AND day of week is in `bookableHours.daysOfWeek` | `BOOKING_008` |
| 6 | Time from now to requested start ≥ `minAdvanceMinutes` | `BOOKING_010` |
| 7 | `requestedDurationMin` is one of `slotDurationOptions` | `BOOKING_008` |
| 8 | Customer has fewer than 2 active bookings (`pending_approval` or `confirmed`) at this club | `BOOKING_001` |
| 9 | Customer has active bookings at fewer than 2 distinct clubs — checked via `bookingLogs` query **inside** the mutation body for Convex serialization (mutual exclusion) | `BOOKING_002` |
| 10 | At least 1 table of the requested type is available for the full duration — **server-side revalidation** inside the mutation (not a pre-check) to prevent race conditions | `BOOKING_003` |
| 11 | `estimatedCost` computed server-side: `max(requestedDurationMin, minBillMinutes) × applicableRate` — never trusted from client | — |

> **Check 9 must run inside the mutation body**, not as a client-side pre-check, so that Convex's mutation serialization prevents two simultaneous `submitBooking` calls from the same customer both passing it.

---

## 6. Availability Engine

### `getAvailableSlots` Query

**Type:** Reactive Convex query — all subscribed clients receive real-time updates when bookings are created, cancelled, or expire.

**Arguments:** `clubId`, `tableType`, `requestedDate` (YYYY-MM-DD), `requestedDurationMin`

**Algorithm:**

1. Load `bookingSettings.bookableHours` from the club. Return `[]` if not configured.
2. Fetch all active tables (`isActive=true`) of the requested `tableType` (stored lowercase) for the club.
3. Fetch all bookings for the club on `requestedDate` where `status` is `pending_approval` or `confirmed`.
4. Generate all possible start times in **30-minute increments** between `bookableHours.open` and `bookableHours.close`.
5. For each start time, compute `endTime = startTime + requestedDurationMin`. Skip if `endTime > bookableHours.close`.
6. Check whether **at least one** active table of the type is free for the full window:
   - Table with `currentSessionId` set (walk-in active) → **unavailable for all slots**
   - Check overlapping bookings: `NOT (endMin ≤ bStart OR startMin ≥ bEnd)` — overlap means the slot is blocked
7. Return the list of available start times as `HH:MM` strings.

**Zero-gap rule:** Adjacent bookings with no gap are permitted. A booking ending at 3:00 PM does not overlap a booking starting at 3:00 PM.

**Overlap formula:**
```
overlaps = NOT (endMin <= bStart OR startMin >= bEnd)
```

**Pending bookings block availability.** This is intentional — prevents multiple customers from submitting overlapping requests for limited tables, only for all but one to be rejected after waiting. If an owner rejects a pending booking, the slot becomes available again immediately. Trade-off: reduced apparent availability. Future: show pending slots as `'requested by another customer'` with a waitlist option.

---

## 7. Owner Actions

### `approveBooking`

- Optionally assigns a specific table from a picker (tables of matching type, available for the requested window)
- If the active staff role has `allowedTableIds` set, the picker only shows permitted tables — enforced server-side (rejects with `STAFF_002` if assigned table is outside allowed list)
- Owner can approve without assigning a table — staff picks one at arrival
- Writes `confirmedTableId` (if assigned), `approvedAt`, `approvedByRoleId`, `approvedByRoleName` (denormalised at approval time — survives role deletion for audit readability)
- Updates `bookingLogs` entry (`status`, `confirmedTableLabel`) atomically in the same mutation
- Sends FCM to customer

### `rejectBooking`

- Optional rejection reason (max 300 chars)
- Updates `bookingLogs` entry (`status`, `rejectionReason`) atomically
- Sends FCM to customer

### `clubCancelBooking`

- Optional cancellation reason (max 300 chars)
- Updates `bookingLogs` entry atomically
- Sends FCM to customer
- Does **not** increment customer's `cancellationCounts`

### Owner Bookings Tab Sections

| Section | Shows | Query |
|---------|-------|-------|
| **Pending** | All `pending_approval` for this club | Ordered by `requestedDate` ascending (most urgent first) |
| **Upcoming** | All `confirmed` where `requestedDate` ≥ today | Ordered by date and time |
| **History** | All `rejected`, `cancelled_by_customer`, `cancelled_by_club`, `expired`, `completed` | Ordered by `updatedAt` descending. Search debounced at 300ms. Filters: status, date range, customer name |

The Bookings tab is visible regardless of whether `bookingSettings.enabled` is true. Even after disabling booking, existing bookings may need to be managed.

**Pending card shows:**
- Customer name, phone, requested date, time, duration, table type, estimated cost, notes
- Booking track record — this-club stats (`customerBookingStats`) AND platform-wide stats (cross-club aggregate on `bookingLogs`): e.g., `'At this club: 2 bookings, 0 no-shows | Platform-wide: 12 bookings, 4 no-shows'`
- Time elapsed since booking was submitted
- Complaint indicator (advisory only — red warning banner listing types; does not block approval)

**Upcoming card shows:**
- Customer name, assigned table label, date, time, duration
- **Start Session button** — visible only within the window: 15 min before to 30 min after booking's start time (intentionally aligned with no-show detection threshold)
- After 30 min past start: card transitions to `'Expired'` state — `'Customer did not arrive'` — Start Session button removed; staff must create a manual walk-in instead
- **Cancel button** — optional reason (max 300 chars)

---

## 8. `startSessionFromBooking`

Converts a confirmed booking into an active session. Replaces the phone lookup + OTP step — the booking's `customerId` is used directly.

### Time Window

```
earlyBoundary = bookingStartUnix - 15 minutes
lateBoundary  = bookingStartUnix + 30 minutes
```

If `now < earlyBoundary` or `now > lateBoundary` → throws `BOOKING_011: Outside start window`.

This window is intentionally aligned with the no-show detection threshold (30 min). After the late boundary, the no-show cron will have (or will shortly) expire the booking.

### Pre-checks (in order)

| Check | Error |
|-------|-------|
| `booking.status === 'confirmed'` | `BOOKING_006` |
| Time is within start window | `BOOKING_011` |
| `customer.isFrozen === false` | `SESSION_003` |
| `customer.deletionRequestedAt === null` | `SESSION_004` |
| `targetTableId` is resolved (`confirmedTableId` or staff-selected) | `SESSION_006` |
| `table.isActive === true` | `SESSION_005` |
| `table.currentSessionId === null` | `SESSION_001` |
| Staff role `allowedTableIds` (if role set) includes `targetTableId` | `STAFF_002` |

**Complaint check (advisory):** `customer.complaints[]` is checked. If non-empty, the mutation returns `{ sessionId, hasComplaints: true }` — the client shows the same advisory warning as the walk-in flow. The session creation is not blocked.

**Table unassigned at approval:** If `confirmedTableId` is null, tapping Start Session first prompts staff to select a table of the matching type from available tables.

### What Is Written

All writes are in the same mutation transaction (atomic):

```
sessions:     INSERT new session record
              (ratePerMin locked at now using same logic as walk-in)
              (minBillMinutes locked from club.minBillMinutes)
              (currency locked from club.currency)
              (bookingId set to originating booking)

tables:       PATCH currentSessionId = sessionId

bookings:     PATCH status = 'completed', sessionId = sessionId, updatedAt = now

bookingLogs:  PATCH status = 'completed', updatedAt = now

sessionLogs:  INSERT new sessionLog entry (central DB)
```

---

## 9. Cancellation Rules

### Who Can Cancel What

| Actor | Cancellable States | Mutation | Counts Against Limit |
|-------|-------------------|----------|---------------------|
| Customer | `pending_approval`, `confirmed` | `cancelBooking` | Yes |
| Owner | `confirmed` | `clubCancelBooking` | No |
| System (account deletion) | `pending_approval`, `confirmed` | Auto-cancel in deletion mutation | No |
| System (cron expiry) | `pending_approval` → expired, `confirmed` → expired | `checkApprovalDeadlines`, `detectNoShows` | No |

### Daily Cancellation Limit

- Maximum **3 cancellations** per customer per club per day
- `date` is computed in the **club's timezone** — resets at midnight in the club's local time
- Tracked in the `cancellationCounts` table (`by_customer_club_date` index)
- Only customer-initiated cancellations increment this counter
- Reaching the limit → `cancelBooking` throws `BOOKING_005`
- When a booking is cancelled, the slot becomes available again immediately (reactive query update)

### Late Cancellation Tracking

- If a customer cancels a confirmed booking and `now` is within `cancellationWindowMin` of the booking's start time → cancellation is flagged as late
- Increments `customerBookingStats.lateCancellationCount` for this customer/club
- **No blocking effect in Phase 1** — count is visible to owner during booking review
- Will be used for penalty enforcement in Phase 2 (when booking payments are added)

### What `cancelBooking` Writes (Atomic)

```
bookings:            PATCH status = 'cancelled_by_customer', updatedAt = now
bookingLogs:         PATCH status = 'cancelled_by_customer', updatedAt = now
cancellationCounts:  UPSERT count++ for (customerId, clubId, date)
                     (only if customer-initiated)
customerBookingStats: PATCH lateCancellationCount++ if late cancel
```

---

## 10. Booking Limits

### Per-Customer Per-Club

| Limit | Value | Checked At |
|-------|-------|-----------|
| Max active bookings at one club | 2 | `submitBooking` (check #8) |
| Max cancellations per day per club | 3 | `cancelBooking` |

### Global (Cross-Club)

| Limit | Value | Checked At |
|-------|-------|-----------|
| Max clubs with active bookings | 2 | `submitBooking` (check #9) — inside mutation body |

Active bookings = status in `pending_approval` or `confirmed`.

If customer already has active bookings at 2 different clubs and tries to book a third → `BOOKING_002`: `'You already have active bookings at 2 clubs. Please complete or cancel existing bookings before booking at a new club.'`

Booking at a club where the customer already has active bookings is unaffected — the per-club max (2) applies independently.

**Important:** The max active bookings limit is checked at **submission time only**, not at approval or session start. Already-approved bookings proceed normally even if the customer submits more while they are pending.

---

## 11. Cron Job Specifications

All booking-related crons are defined in `packages/convex/crons.ts`. They use the `by_global_status` index on `bookings` for cross-club queries.

### `checkApprovalDeadlines` — every 5 minutes

**Query:** All bookings where `status === 'pending_approval'` (cross-club, `by_global_status` index).

**For each booking, two checks:**

**Check A — Halfway reminder (50% elapsed):**
```
condition:  (now - booking.createdAt) >= (approvalDeadlineMin * 60_000 / 2)
            AND booking.approvalReminderSentAt IS NULL
action:     FCM to owner:
              'Pending booking from [Customer] for [date] at [time]
               needs your response. Expires in [N] minutes.'
            SET booking.approvalReminderSentAt = now
```

**Check B — Full deadline expired:**
```
condition:  (now - booking.createdAt) >= (approvalDeadlineMin * 60_000)
action:     SET booking.status = 'expired'
            SET booking.updatedAt = now
            UPDATE bookingLogs.status = 'expired' (atomic)
            FCM to customer:
              'Booking Expired: Your booking request at [club]
               expired — the club didn't respond in time.'
```

Idempotent — only processes bookings still in `pending_approval`. If the cron already expired a booking in a previous cycle, the query filter excludes it.

---

### `detectNoShows` — every 10 minutes

**Query:** All bookings where `status === 'confirmed'` (cross-club, `by_global_status` index).

**For each booking:**
```
startUnix = computeBookingUnixTime(
  booking.requestedDate,
  booking.requestedStartTime,
  club.timezone
)

condition:  now > (startUnix + 30 * 60_000)
            AND booking.sessionId IS NULL

action:     SET booking.status = 'expired'
            SET booking.updatedAt = now
            UPDATE bookingLogs.status = 'expired' (atomic)
            INCREMENT customerBookingStats.noShowCount
              for (customerId, clubId)
            FCM to customer (see note below)
            FCM to owner (see note below)
```

**Special frozen-club handling:**
- If `club.subscriptionStatus === 'frozen'` at the time the cron fires:
  - Customer FCM: `'Your booking at [club] could not be honoured. The club is currently unavailable.'`
  - Owner FCM: **suppressed** (Owner App API calls are blocked for frozen clubs)
- If club is not frozen:
  - Customer FCM: `'Your booking at [club] at [time] has expired because you did not arrive within 30 minutes of the start time.'`
  - Owner FCM: `'[Customer] didn't show up for their [time] booking.'`

Idempotent — only processes bookings still in `confirmed`. Previous-cycle expirations are excluded by the query filter.

---

### `sendReminders` — every 5 minutes

**Query:** All bookings where `status === 'confirmed'`, `reminderSentAt IS NULL`, `sessionId IS NULL` (cross-club, `by_global_status` index).

```
startUnix = computeBookingUnixTime(
  booking.requestedDate,
  booking.requestedStartTime,
  club.timezone
)

condition:  (startUnix - now) is between 55 and 65 minutes
            (approximately 1 hour away)

action:     FCM to customer:
              'Reminder: Your booking at [club] is in 1 hour ([time]).
               See you there!'
            FCM to owner:
              'Reminder: [Customer] has a booking at [time] in 1 hour.'
            SET booking.reminderSentAt = now
              (prevents duplicate sends)
```

Skips bookings already converted to sessions (`sessionId IS NULL` filter). The 5-minute cron interval means reminders may arrive anywhere between 55 and 65 minutes before the booking.

---

### Cron Timing Summary

| Cron | Interval | Indexes Used | Max Latency Beyond Threshold |
|------|----------|-------------|------------------------------|
| `checkApprovalDeadlines` | Every 5 min | `bookings.by_global_status` | ~5 min |
| `detectNoShows` | Every 10 min | `bookings.by_global_status` | ~10 min |
| `sendReminders` | Every 5 min | `bookings.by_global_status` | ±5 min window |

The latency is acceptable for v1. Cron intervals can be reduced if tighter enforcement is needed.

**Concurrency safety:** Each cron uses an atomic status transition — it only updates bookings where `status` is still the expected value. If a previous cycle already transitioned a booking, the query filter excludes it. No double-processing occurs.

---

## 12. FCM Notifications

All booking-related FCM pushes include a `data.deepLink` or `data.screen` for navigation on tap.

| Trigger | Recipient | Title | Body | Deep Link |
|---------|-----------|-------|------|-----------|
| Booking submitted | Owner | `New Booking Request` | `[Customer] requested [tableType] on [date] at [time].` | `{ screen: 'bookings', tab: 'pending' }` |
| Booking approved | Customer | `Booking Confirmed` | `Your booking at [club] on [date] at [time] has been confirmed.` | `{ deepLink: 'a3customer://booking/{id}' }` |
| Booking rejected | Customer | `Booking Declined` | `Your booking request at [club] was declined.` + reason if provided | `{ deepLink: 'a3customer://booking/{id}' }` |
| Booking cancelled by club | Customer | `Booking Cancelled` | `Your booking at [club] on [date] at [time] was cancelled by the club.` | `{ deepLink: 'a3customer://booking/{id}' }` |
| Booking cancelled by customer | Owner | `Booking Cancelled` | `[Customer] cancelled their booking for [date] at [time].` | `{ screen: 'bookings', tab: 'history' }` |
| Approval deadline 50% elapsed | Owner | `Booking Needs Response` | `Pending booking from [Customer] for [date] at [time] needs your response. Expires in [N] minutes.` | `{ screen: 'bookings', tab: 'pending' }` |
| Booking expired (no owner response) | Customer | `Booking Expired` | `Your booking request at [club] expired — the club didn't respond in time.` | `{ deepLink: 'a3customer://booking/{id}' }` |
| No-show (normal) | Customer | `Booking Expired` | `Your booking at [club] at [time] has expired because you did not arrive within 30 minutes of the start time.` | `{ deepLink: 'a3customer://booking/{id}' }` |
| No-show (frozen club) | Customer | `Booking Could Not Be Honoured` | `Your booking at [club] could not be honoured. The club is currently unavailable.` | `{ deepLink: 'a3customer://booking/{id}' }` |
| No-show (normal) | Owner | `Customer No-Show` | `[Customer] didn't show up for their [time] booking.` | `{ screen: 'bookings', tab: 'history' }` |
| No-show (frozen club) | Owner | — | **Suppressed** | — |
| 1-hour reminder | Customer | `Booking Reminder` | `Reminder: Your booking at [club] is in 1 hour ([time]). See you there!` | `{ deepLink: 'a3customer://booking/{id}' }` |
| 1-hour reminder | Owner | `Upcoming Booking` | `Reminder: [Customer] has a booking at [time] in 1 hour.` | `{ screen: 'bookings', tab: 'upcoming' }` |
| Account deletion auto-cancels bookings | Owner | `Booking Auto-Cancelled` | `[Customer]'s account has been deleted. Their booking for [date] at [time] has been automatically cancelled.` | `{ screen: 'bookings', tab: 'history' }` |

**FCM failure handling:** If a customer or owner has no valid FCM tokens, push fails silently. Booking status still updates normally. The user sees the updated status when they next open the app.

**Tapping a booking notification** in the Customer App opens `booking/[bookingId].tsx`. If the booking no longer exists (e.g., purged after owner deletion), the app navigates to the My Bookings list instead.

---

## 13. Data Written on Each Transition

Every mutation updates **both** the club DB booking record **and** the central DB `bookingLogs` entry atomically in the same Convex transaction. If the mutation fails, neither is written.

| Transition | `bookings` fields written | `bookingLogs` fields mirrored | Other writes |
|-----------|--------------------------|-------------------------------|-------------|
| `submitBooking` | All fields created | New entry created | — |
| `approveBooking` | `status`, `confirmedTableId?`, `approvedAt`, `approvedByRoleId`, `approvedByRoleName`, `updatedAt` | `status`, `confirmedTableLabel?` | FCM to customer |
| `rejectBooking` | `status`, `rejectionReason?`, `updatedAt` | `status`, `rejectionReason?` | FCM to customer |
| `cancelBooking` (customer) | `status`, `updatedAt` | `status` | `cancellationCounts` upsert; `customerBookingStats.lateCancellationCount++` if late |
| `clubCancelBooking` | `status`, `updatedAt` | `status` | FCM to customer |
| `checkApprovalDeadlines` | `status='expired'`, `updatedAt` | `status` | FCM to customer |
| `detectNoShows` | `status='expired'`, `updatedAt` | `status` | `customerBookingStats.noShowCount++`; FCM to owner + customer |
| `startSessionFromBooking` | `status='completed'`, `sessionId`, `updatedAt` | `status` | `sessions` insert; `tables.currentSessionId` patch; `sessionLogs` insert |
| `sendReminders` | `reminderSentAt` | — | FCM to customer + owner |
| `checkApprovalDeadlines` (50%) | `approvalReminderSentAt` | — | FCM to owner |

---

## 14. Error Codes

All booking-related error codes thrown by Convex mutations/actions. Format: `CODE: message`.

| Code | Message | Thrown By |
|------|---------|-----------|
| `BOOKING_001` | Max active bookings at club (2) | `submitBooking` |
| `BOOKING_002` | Max booking clubs (2) | `submitBooking` |
| `BOOKING_003` | Slot unavailable | `submitBooking` |
| `BOOKING_004` | Club not accepting bookings | `submitBooking` |
| `BOOKING_005` | Daily cancel limit (3) | `cancelBooking` |
| `BOOKING_006` | Invalid state transition | All booking mutations |
| `BOOKING_007` | Already cancelled | `cancelBooking` |
| `BOOKING_008` | Outside bookable hours / invalid date or duration | `submitBooking` |
| `BOOKING_009` | Table type not bookable | `submitBooking` |
| `BOOKING_010` | Min advance time not met | `submitBooking` |
| `BOOKING_011` | Outside start window | `startSessionFromBooking` |
| `SESSION_003` | Customer frozen | `startSessionFromBooking` |
| `SESSION_004` | Customer deleted | `startSessionFromBooking` |
| `SESSION_005` | Table inactive | `startSessionFromBooking` |
| `SESSION_006` | No table assigned | `startSessionFromBooking` |
| `STAFF_002` | Table outside allowed set | `approveBooking`, `startSessionFromBooking` |
| `CLUB_002` | Booking preconditions unmet (enable attempt) | Settings save |
| `CLUB_004` | Bookable hours outside operating hours | Settings save |
| `SUB_001` | Subscription frozen | `submitBooking` |

**Retryable errors:** `BOOKING_003` (slot just became unavailable — customer can pick another slot), `BOOKING_006` (race condition on status — retry not meaningful, UI should refresh).

---

## 15. Edge Cases

### 15.1 Customer State Changes

| Scenario | Behaviour |
|----------|-----------|
| **Customer frozen between booking and arrival** | `startSessionFromBooking` re-checks `isFrozen`. If `true`, throws `SESSION_003`. Session creation blocked. Staff sees: `'Customer account is frozen.'` The booking record is retained. |
| **Customer deleted between booking and arrival** | Mutation checks `deletionRequestedAt`. If set, throws `SESSION_004`. Session creation blocked. Booking record retained in club DB as stale reference. |
| **Customer gets a complaint between booking and approval** | Owner sees fresh complaint data when reviewing the pending booking. No automatic rejection. Advisory only. |
| **Customer has complaints at booking time** | `submitBooking` does not block on complaints. Complaints are advisory. The owner sees them during review in the Pending section. |
| **Admin freezes customer who has confirmed bookings** | Login blocked immediately. Confirmed bookings remain in system. When staff taps Start Session, mutation re-checks `isFrozen` and blocks. Bookings eventually expire via no-show cron. Owner sees frozen status indicator on booking card. |

### 15.2 Table State Changes

| Scenario | Behaviour |
|----------|-----------|
| **Table disabled between confirmation and arrival** | `startSessionFromBooking` checks `isActive`. If `confirmedTableId` is now inactive, throws `SESSION_005`. Staff is prompted to pick a different active table of the same type. |
| **Table type changed between booking and arrival** | Booking references `confirmedTableId` directly. Session starts on the correct table regardless of type label changes. |
| **All tables of a bookable type removed** | `getAvailableSlots` returns zero slots. Existing confirmed bookings become unserviceable — staff must cancel them manually. |

### 15.3 Club State Changes

| Scenario | Behaviour |
|----------|-----------|
| **Club subscription freezes** | All Owner App API calls blocked. Pending bookings auto-expire via approval deadline cron. Confirmed bookings expire via no-show cron (30 min after start). The no-show cron still runs (system cron) but the customer notification changes to `'The club is currently unavailable'` — not the misleading `'you didn't show up'` message. Owner FCM suppressed. |
| **Club disables booking after confirmed bookings exist** | `bookingSettings.enabled = false` hides club from new booking flows. Existing confirmed bookings are NOT auto-cancelled. Owner must cancel manually if intended. |
| **Club disables booking while customer is in the flow** | `getAvailableSlots` reactive query still returns data (checks table availability, not `enabled`). When customer submits, `submitBooking` checks `enabled` and throws `BOOKING_004`. Customer is redirected back to the club profile. |
| **Club changes bookable hours or table types** | Existing bookings are not retroactively affected. Changes only affect new submissions. |
| **Club changes timezone** | Existing booking time strings are reinterpreted in the new timezone by cron jobs. Rare edge case — owner should manually review affected bookings. |
| **Club changes rates after booking submitted** | `estimatedCost` on the booking is locked at submission time and not updated. Actual billing at session checkout uses the rate in effect at session start time (existing billing logic). Estimate and actual may differ. |

### 15.4 Booking Conflicts

| Scenario | Behaviour |
|----------|-----------|
| **Two customers book the same slot simultaneously** | Convex mutation serialization ensures only one succeeds. The second mutation's availability check (inside the mutation body) sees the first booking and throws `BOOKING_003`. |
| **Owner approves a booking but the table was taken by a walk-in** | `approveBooking` checks the target table's `currentSessionId` and existing confirmed bookings. If conflict exists, mutation throws and owner must pick a different table. |
| **Walk-in seated at a table with an upcoming confirmed booking** | Table grid shows a `'Booked [time]'` indicator (blue tag, within 2 hours). When staff starts a walk-in on a table with a confirmed booking within 60 minutes, an advisory dialog fires. The 60-minute threshold exists because a walk-in typically lasts 60–120 minutes. Staff can proceed — physical operations always take priority. The booked customer must be moved to a different table on arrival. |

### 15.5 Cancellation & Expiry Edge Cases

| Scenario | Behaviour |
|----------|-----------|
| **Account deletion auto-cancels bookings** | All active bookings (`pending_approval` or `confirmed`) are auto-cancelled by the deletion mutation. These do NOT increment `cancellationCounts` and do not count toward the 3/day limit at any club. Owner FCM sent per cancelled booking. |
| **Customer cancels 3 bookings at club A, tries to book at club B** | Limit is per customer per club per day. Club A cancellations do not affect club B's limit. |
| **Cancellation count timezone** | Resets at midnight in the **club's** timezone. A booking at a club in `Asia/Kolkata` resets at midnight IST. |
| **Booking already cancelled by club when customer tries to cancel** | `cancelBooking` checks current status. If already `cancelled_by_club`, mutation rejects with `BOOKING_007`. |
| **Approval deadline expires at the moment owner taps Approve** | The cron and the owner's mutation race. If the cron runs first, the approve mutation sees status no longer `pending_approval` and rejects (`BOOKING_006`). If approve runs first, the cron skips it on the next cycle. Either outcome is consistent. |
| **No-show cron fires but customer is there and staff is slow** | The 30-minute grace period is intentional. Staff should start the session promptly after the customer arrives. If staff starts the session after the cron has already expired it, the booking is in `expired` state — staff must create a manual walk-in session instead. |
| **Customer restores account after deletion cancelled bookings** | Account is restored if the cancellation link is clicked within the 30-day grace period. But bookings that were auto-cancelled at deletion time are **not** restored — they remain `cancelled_by_customer`. Customer must submit new requests. |

### 15.6 Booking–Session Interaction

| Scenario | Behaviour |
|----------|-----------|
| **Session runs longer than requested duration** | `requestedDurationMin` is informational — it reserves the slot and computes the estimate. Once the session starts, the timer runs until staff ends it. Actual duration is billed by the standard formula. No automatic session end at booked duration. |
| **Customer arrives 20 minutes late** | Session `startTime = now` (when staff taps Start Session), not `requestedStartTime`. Customer billed for actual play time. The slot was held from booked start time, but that held time is not billed. |
| **Back-to-back bookings with no gap on the same table** | Zero-gap bookings are permitted — a booking ending at 3:00 PM does not overlap one starting at 3:00 PM. However, if the first session runs past 3:00 PM (sessions never auto-end), the second booking's table will be occupied. The walk-in conflict warning handles this scenario. |
| **Customer has an active session and tries to book at the same club** | Allowed. `submitBooking` does not check for active sessions. A customer can have an active walk-in session and a pending or confirmed booking simultaneously — the booking is for a future time slot. |
| **Max active bookings limit at session start** | The 2-booking limit is checked at **submission only**, not at approval or session start. Already-approved bookings always proceed normally. |
| **Complaint filed after booking is confirmed** | `startSessionFromBooking` re-checks `complaints[]` and returns `{ hasComplaints: true }` — the advisory warning is shown to staff. The session is not blocked. |
| **Booking converted to session, then session cancelled** | The booking record remains in `completed` status — it is not reverted to any prior state. The session follows its own lifecycle. |
| **Bookings during grace period** | Owner App works normally during `subscriptionStatus === 'grace'`. Bookings can be submitted, approved, rejected, and converted. Club discovery continues to show grace clubs. Only `frozen` blocks all Owner App API calls. |

### 15.7 Data Integrity

| Scenario | Behaviour |
|----------|-----------|
| **`bookingLogs` and `bookings` get out of sync** | Both are updated in the same Convex mutation transaction. If the mutation fails, neither is written. Convex transactions guarantee consistency. |
| **Club renames itself after bookings exist** | `bookingLogs.clubName` is denormalised at booking creation time. Historical entries retain the old name. |
| **Owner account deleted — bookings purged but bookingLogs retained** | After 30-day purge, all `bookings` in the club DB are deleted. But `bookingLogs` entries in the central DB are retained (`clubId` becomes stale). The denormalised fields (`clubName`, `clubAddress`, `thumbnailPhotoId`) remain readable. The booking detail screen shows a tombstone banner: `'This club is no longer on A3 Billiards OS.'` |
| **Club removes a table type from `bookableTableTypes` while pending bookings reference it** | Existing pending bookings for the removed type are not auto-cancelled. The owner sees them in the Pending section and can approve (assigning a specific table of any type) or reject. New bookings for the removed type are blocked at `submitBooking` check #3. |

### 15.8 Cron Timing Edge Cases

| Scenario | Behaviour |
|----------|-----------|
| **Approval deadline cron and no-show cron run at different intervals** | Up to 5-minute delay for approval expiry; up to 10-minute delay for no-show detection beyond configured thresholds. Acceptable for v1. |
| **Multiple cron cycles process the same booking** | Each cron uses an atomic status transition — only updates bookings still in the expected state. Previous-cycle transitions exclude the booking from the query filter. No double-processing. |
| **Reminder cron timing** | The 1-hour-before reminder may arrive 55–65 minutes before the booking due to the 5-minute cron interval. `reminderSentAt` prevents duplicate sends. |

---

## Appendix — Key Indexes for Booking Queries

| Index | Table | Fields | Used By |
|-------|-------|--------|---------|
| `by_club_date` | `bookings` | `["clubId", "requestedDate"]` | `getAvailableSlots` — all bookings for a club on a given date |
| `by_customer` | `bookings` | `["customerId"]` | Max active bookings check (2 per customer per club) |
| `by_status` | `bookings` | `["clubId", "status"]` | Owner's Pending/Upcoming sections |
| `by_global_status` | `bookings` | `["status"]` | All three crons — cross-club queries by status |
| `by_customer` | `bookingLogs` | `["customerId"]` | My Bookings screen; global club limit check (distinct active `clubId`s) |
| `by_customer_status` | `bookingLogs` | `["customerId", "status"]` | Global club limit check performance — filters by customer + active statuses |
| `by_bookingId` | `bookingLogs` | `["bookingId"]` | Every status-change mutation finds `bookingLog` by `bookingId` for atomic update |
| `by_customer_club_date` | `cancellationCounts` | `["customerId", "clubId", "date"]` | Daily cancellation limit check in `cancelBooking` |
| `by_customer_club` | `customerBookingStats` | `["customerId", "clubId"]` | No-show count, late cancel count, total bookings shown to owner during review |
