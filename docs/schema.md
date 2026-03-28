# A3 Billiards OS — Convex Schema Reference

> **Source:** `packages/convex/schema.ts` · PRD v22.0 Final + TDD v1.3 · Audited March 2026

Two logical namespaces share one Convex deployment. All IDs are Convex auto-generated document IDs. All timestamps are Unix milliseconds.

---

## Namespaces

| Namespace | Tables |
|-----------|--------|
| **Central DB** (10 tables) | `users`, `complaints`, `adminNotifications`, `passwordResetTokens`, `adminMfaCodes`, `adminAuditLog`, `otpRecords`, `sessionLogs`, `bookingLogs`, `paymentReceipts` |
| **Club DB** (9 tables) | `clubs`, `tables`, `sessions`, `bookings`, `snacks`, `staffRoles`, `cancellationCounts`, `customerBookingStats`, `sessions_archive` |

---

## Shared Validators

These union types are reused across multiple tables.

| Validator | Values |
|-----------|--------|
| `userRole` | `"admin"` · `"owner"` · `"customer"` |
| `sessionStatus` | `"active"` · `"completed"` · `"cancelled"` |
| `paymentStatus` | `"pending"` · `"paid"` · `"credit"` |
| `paymentMethod` | `"cash"` · `"upi"` · `"card"` · `"credit"` |
| `creditResolveMethod` | `"cash"` · `"upi"` · `"card"` *(excludes `"credit"` — resolves FROM credit TO a real method)* |
| `bookingStatus` | `"pending_approval"` · `"confirmed"` · `"rejected"` · `"cancelled_by_customer"` · `"cancelled_by_club"` · `"expired"` · `"completed"` |
| `subscriptionStatus` | `"active"` · `"grace"` · `"frozen"` |
| `complaintType` | `"violent_behaviour"` · `"theft"` · `"runaway_without_payment"` · `"late_credit_payment"` |
| `notificationTargetType` | `"all"` · `"selected"` · `"role"` |
| `resetTokenType` | `"accountPassword"` · `"settingsPasscode"` |
| `adminAuditAction` | `"phone_update"` · `"user_freeze"` · `"user_unfreeze"` · `"password_reset"` · `"passcode_reset"` · `"role_change"` · `"complaint_dismiss"` · `"session_force_end"` |
| `deliveryStatusValue` | `"sent"` · `"delivered"` · `"failed"` |

### Shared Object Shapes

**`snackOrder`**
```
{ snackId: Id<"snacks">, name: string, qty: number, priceAtOrder: number }
```

**`specialRate`**
```
{
  id: string,              // UUID (crypto.randomUUID())
  ratePerMin: number,
  startTime: string,       // HH:MM — midnight-crossing supported (endTime < startTime)
  endTime: string,         // HH:MM
  daysOfWeek: number[],    // 0=Sun … 6=Sat
  label: string
}
```

**`locationObj`**
```
{ lat: number, lng: number }
```

**`operatingHoursObj`**
```
{ open: string, close: string, daysOfWeek: number[] }   // HH:MM
```

**`bookableHoursObj`**
```
{ open: string, close: string, daysOfWeek: number[] }
// Must fall within operatingHours — validated server-side on save (CLUB_004)
```

**`bookingSettingsObj`**
```
{
  enabled: boolean,               // Default: false
  maxAdvanceDays: number,          // Default: 7
  minAdvanceMinutes: number,       // Default: 60
  slotDurationOptions: number[],   // Default: [30, 60, 90, 120]
  cancellationWindowMin: number,   // Default: 30
  approvalDeadlineMin: number,     // Default: 60
  bookableTableTypes: string[],    // Default: [] — owner must select ≥1 before enabling
  bookableHours?: bookableHoursObj // Default: undefined — must be configured before enabling
}
```

---

## Central Database

### `users`

All roles (`admin`, `owner`, `customer`) share one table. Field relevance varies by role.

> **RLS:** Any authenticated user can read. Only admin or self can modify.
> **Defaults at creation:** `isFrozen=false`, `settingsPasscodeSet=false`, `complaints=[]`, `fcmTokens=[]`, `consentGiven=true`, `consentGivenAt=Date.now()`

| Field | Type | Notes |
|-------|------|-------|
| `phone` | `string?` | **Unique.** Mandatory for customers (WhatsApp OTP verified). Contact ref for owners. Absent for admins. |
| `phoneVerified` | `boolean` | Must be `true` before a customer account is active. Gates booking submission and session start from booking. |
| `name` | `string` | 2–100 chars. Leading/trailing whitespace stripped server-side. |
| `age` | `number` | Age at registration. Minimum: 18. Not updated afterward. |
| `email` | `string?` | Required for email/password login or Google Sign-In. Editing also updates the Convex Auth identity. |
| `googleId` | `string?` | Google OAuth subject ID. Used for primary lookup in `verifyGoogleToken` flow. |
| `fcmTokens` | `string[]` | FCM device tokens — one per active device/session. Stale tokens auto-removed on Firebase invalid response. Deduped server-side on login. |
| `settingsPasscodeHash` | `string?` | bcrypt hash (10 rounds) of 6-digit settings PIN. Owner only. Null until first setup. |
| `settingsPasscodeSet` | `boolean` | `false` until first-login passcode setup completed. Clearing this (via email reset) forces re-setup on next login. |
| `complaints` | `Id<"complaints">[]` | Live array of active complaint IDs. Non-empty triggers banner alert on customer login. Checked at session start (advisory only). |
| `isFrozen` | `boolean` | Blocks all panel logins at Convex auth layer. Set exclusively by admin action — subscription expiry never modifies this. |
| `role` | `userRole` | Determines panel access. Set at creation. Valid transition: `owner → admin` only. |
| `deletionRequestedAt` | `number?` | Unix ms. Triggers 30-day grace period. Login blocked immediately when set. |
| `deletionCancelToken` | `string?` | SHA-256 hashed token for email cancellation link. Single-use. |
| `consentGiven` | `boolean` | Explicit Privacy Policy/ToS consent. Required `true` before account creation (server-enforced). Always `true` for legacy accounts. |
| `consentGivenAt` | `number?` | Unix ms when consent was given. Null for pre-consent legacy accounts. |
| `createdAt` | `number` | Unix ms. |

**Indexes**

| Index | Fields | Used For |
|-------|--------|---------|
| `by_phone` | `["phone"]` | Phone duplicate detection, OTP flow, customer lookup |
| `by_email` | `["email"]` | Google Sign-In email fallback, email/password lookup |
| `by_googleId` | `["googleId"]` | Google Sign-In primary lookup |

---

### `complaints`

Cross-club customer flags. Filed by owners, visible to all clubs on customer lookup.

> Cannot be filed against anonymous guest sessions (no central identity).
> On removal: sets `removedAt` + `removedById`, pulls ID from `users.complaints[]`.
> Customer deletion: complaint records retained 90 days for affected clubs.

| Field | Type | Notes |
|-------|------|-------|
| `userId` | `Id<"users">` | The reported customer. |
| `reportedByClubId` | `Id<"clubs">` | Club that filed the complaint. |
| `sessionId` | `Id<"sessions">?` | Optional reference to the incident session. |
| `type` | `complaintType` | `violent_behaviour` · `theft` · `runaway_without_payment` · `late_credit_payment` |
| `description` | `string` | Free-text detail notes. |
| `removedAt` | `number?` | Unix ms. Soft-delete timestamp. |
| `removedById` | `Id<"users">?` | Admin or owner who removed the complaint. |
| `dismissalReason` | `string?` | Max 500 chars. Required for admin dismiss; optional for owner retraction. |
| `createdAt` | `number` | Unix ms. |

**Indexes**

| Index | Fields | Used For |
|-------|--------|---------|
| `by_userId` | `["userId"]` | Admin complaint management filters by customer |
| `by_reportedByClubId` | `["reportedByClubId"]` | Admin complaint filter by club; owner views own club's complaints |

---

### `adminNotifications`

Admin broadcast push notifications with per-recipient delivery tracking.

> Rate-limited: max 10 broadcasts per hour per admin (fixed hour boundary).
> Frozen accounts (`isFrozen=true`) excluded from `'all'` and `'role'` targets.

| Field | Type | Notes |
|-------|------|-------|
| `sentByAdminId` | `Id<"users">` | Admin who composed the broadcast. |
| `title` | `string` | Push notification title. |
| `body` | `string` | Push notification body. |
| `targetType` | `notificationTargetType` | `"all"` · `"selected"` · `"role"` |
| `targetUserIds` | `Id<"users">[]?` | Populated when `targetType === "selected"`. |
| `targetRole` | `"owner" \| "customer"?` | Populated when `targetType === "role"`. |
| `deliveryStatus` | `Record<string, deliveryStatusValue>` | `Map<userId, "sent"\|"delivered"\|"failed">`. Per-recipient delivery tracking. |
| `createdAt` | `number` | Unix ms. |

*No indexes on this table.*

---

### `passwordResetTokens`

SHA-256 hashed tokens for password and passcode resets.

> Generated as 32-byte hex via `crypto.randomBytes` in a Convex action.
> 1-hour expiry. Single-use — marked `used=true` immediately on redemption.
> Reset links open a page on the A3 Billiards OS web domain (not deep links).

| Field | Type | Notes |
|-------|------|-------|
| `userId` | `Id<"users">` | Account the token belongs to. |
| `tokenHash` | `string` | SHA-256 hash of the raw 32-byte hex token. |
| `type` | `resetTokenType` | `"accountPassword"` · `"settingsPasscode"` |
| `expiresAt` | `number` | Unix ms — 1 hour from creation. |
| `used` | `boolean` | Marked `true` on redemption; reuse rejected. |
| `createdAt` | `number` | Unix ms. |

**Indexes**

| Index | Fields | Used For |
|-------|--------|---------|
| `by_tokenHash` | `["tokenHash"]` | `verifyAndConsumeToken` token redemption lookup |

---

### `adminMfaCodes`

SHA-256 hashed 6-digit MFA codes for admin login. 10-minute expiry.

> Requesting a new code invalidates all existing unused codes for that admin.

| Field | Type | Notes |
|-------|------|-------|
| `adminId` | `Id<"users">` | Admin user the code was issued to. |
| `codeHash` | `string` | SHA-256 hash of the 6-digit code. |
| `expiresAt` | `number` | Unix ms — 10 minutes from creation. |
| `used` | `boolean` | Marked `true` on successful verification. |
| `createdAt` | `number` | Unix ms. |

**Indexes**

| Index | Fields | Used For |
|-------|--------|---------|
| `by_admin` | `["adminId"]` | `storeMfaCode` + `checkMfaCode` lookup; invalidate existing codes |

---

### `adminAuditLog`

Immutable audit trail for sensitive admin actions. DPDP Act 2023 compliance.

| Field | Type | Notes |
|-------|------|-------|
| `adminId` | `Id<"users">` | Admin who performed the action. |
| `action` | `adminAuditAction` | `phone_update` · `user_freeze` · `user_unfreeze` · `password_reset` · `passcode_reset` · `role_change` · `complaint_dismiss` · `session_force_end` |
| `targetUserId` | `Id<"users">?` | User the action was performed on. |
| `previousValue` | `string?` | Previous value (e.g. old phone number). |
| `newValue` | `string?` | New value (e.g. new phone number). |
| `notes` | `string?` | Optional context or reason (e.g. force-end reason, max 300 chars). |
| `createdAt` | `number` | Unix ms. |

**Indexes**

| Index | Fields | Used For |
|-------|--------|---------|
| `by_admin` | `["adminId"]` | Audit log filtering by admin |

> No `by_targetUserId` index — admin dashboard filters by admin, not target.

---

### `otpRecords`

WhatsApp OTP verification records. bcrypt-hashed codes (10 rounds, in action).

> 10-minute expiry. Max 3 incorrect attempts → 5-minute cooldown.
> Rate-limited: max 5 dispatches per phone per hour (sliding window).

| Field | Type | Notes |
|-------|------|-------|
| `phone` | `string` | Phone number the OTP was sent to (E.164 format). |
| `otpHash` | `string` | bcrypt hash of the 6-digit code. |
| `attempts` | `number` | Incorrect attempt counter. Blocked after 3. |
| `cooldownUntil` | `number?` | Unix ms — set to `now + 5 min` after 3 failed attempts. |
| `expiresAt` | `number` | Unix ms — 10 minutes from creation. |
| `used` | `boolean` | Marked `true` on successful verification. |
| `createdAt` | `number` | Unix ms. |

**Indexes**

| Index | Fields | Used For |
|-------|--------|---------|
| `by_phone` | `["phone"]` | Rate-limit check — count dispatches in the last hour |

---

### `sessionLogs`

Lightweight cross-club session references. Powers customer session history across all clubs without exposing club billing data.

> Written atomically in the same Convex mutation that creates/updates the club DB session.
> **Guest sessions are NEVER written here** — they have no central identity.

| Field | Type | Notes |
|-------|------|-------|
| `sessionId` | `Id<"sessions">` | Reference to full session record in club DB. |
| `customerId` | `Id<"users">` | Verified customer. Non-nullable (guest sessions excluded). |
| `clubId` | `Id<"clubs">` | Which club. |
| `clubName` | `string` | Denormalised at session creation time. |
| `tableLabel` | `string` | Denormalised table label. |
| `startTime` | `number` | Unix ms. |
| `endTime` | `number?` | Unix ms. Null while active. |
| `billTotal` | `number?` | Copied from club DB on session completion. |
| `currency` | `string?` | ISO 4217 denormalised at session creation. Optional for backward compatibility with pre-existing records. |
| `paymentStatus` | `paymentStatus` | `"pending"` · `"paid"` · `"credit"` |
| `paymentMethod` | `paymentMethod?` | `"cash"` · `"upi"` · `"card"` · `"credit"` |
| `status` | `sessionStatus` | `"active"` · `"completed"` · `"cancelled"` |
| `createdAt` | `number` | Unix ms when sessionLog entry was created. |
| `updatedAt` | `number` | Unix ms of last status change (completion, credit resolve). |

**Indexes**

| Index | Fields | Used For |
|-------|--------|---------|
| `by_customer` | `["customerId"]` | Customer session history across all clubs (PRD §8.6) |
| `by_customer_club` | `["customerId", "clubId"]` | "You've played here 5 times" on club profile (PRD §8.3) |
| `by_sessionId` | `["sessionId"]` | Session completion and credit-resolve mutations find sessionLog by sessionId |

---

### `bookingLogs`

Lightweight cross-club booking references. Powers the customer "My Bookings" screen across all clubs.

> Written atomically in the same Convex mutation that creates/updates the club DB booking.
> Updated whenever booking status changes.
> When a club is deleted/purged, `bookingLogs` entries are **retained** — `clubId` becomes stale but denormalised fields (`clubName`, `clubAddress`, `thumbnailPhotoId`) remain readable.

| Field | Type | Notes |
|-------|------|-------|
| `bookingId` | `Id<"bookings">` | Reference to full booking record in club DB. |
| `customerId` | `Id<"users">` | Customer who submitted the booking. |
| `clubId` | `Id<"clubs">` | Which club. |
| `clubName` | `string` | Denormalised at booking creation time. Retained after club rename. |
| `clubAddress` | `string?` | Denormalised at submission. Fallback when `getClubProfile` returns null. |
| `thumbnailPhotoId` | `string?` | Convex file storage ID of first club photo at submission. Fallback thumbnail. |
| `tableType` | `string` | Denormalised requested table type. |
| `status` | `bookingStatus` | Mirrored from club DB booking on every status change. |
| `rejectionReason` | `string?` | Mirrored on rejection. Customer sees reason without cross-DB lookup. |
| `confirmedTableLabel` | `string?` | Denormalised table label. Set when status transitions to `"confirmed"`. |
| `estimatedCost` | `number?` | `ratePerMin × duration` at submission time. Not updated if rates change. |
| `currency` | `string` | ISO 4217 locked at booking submission from `clubs.currency`. |
| `notes` | `string?` | Customer-provided notes denormalised at submission (max 200 chars). Required for booking detail screen when club is deleted/purged. |
| `requestedDate` | `string` | `YYYY-MM-DD` in club timezone. |
| `requestedStartTime` | `string` | `HH:MM` in club timezone. |
| `requestedDurationMin` | `number` | Requested duration in minutes. |
| `createdAt` | `number` | Unix ms. |
| `updatedAt` | `number` | Unix ms. |

**Indexes**

| Index | Fields | Used For |
|-------|--------|---------|
| `by_customer` | `["customerId"]` | My Bookings screen; global booking club limit check (distinct active `clubId`s in `submitBooking`) |
| `by_customer_status` | `["customerId", "status"]` | Global club limit check (`submitBooking`) — filters by `customerId + status` for active bookings |
| `by_bookingId` | `["bookingId"]` | `startSessionFromBooking` + every status-change mutation looks up `bookingLog` by `bookingId` |

---

### `paymentReceipts`

Razorpay webhook idempotency table.

> Before updating `subscriptionExpiresAt`, the webhook handler checks for the `paymentId`. If it exists → return `200` immediately. If not → write receipt, then update.
> Guarantees exactly-once processing even if Razorpay fires the webhook multiple times.

| Field | Type | Notes |
|-------|------|-------|
| `paymentId` | `string` | Razorpay `payment_id`. Unique (enforced via index check). |
| `ownerId` | `Id<"users">` | Owner whose subscription was renewed. |
| `clubId` | `Id<"clubs">` | Club whose subscription was renewed. |
| `amountPaid` | `number` | Amount in Razorpay processing currency (INR). Informational/audit only. |
| `processedAt` | `number` | Unix ms when webhook was first successfully processed. |

**Indexes**

| Index | Fields | Used For |
|-------|--------|---------|
| `by_paymentId` | `["paymentId"]` | Idempotency check: does this `paymentId` already exist? |
| `by_owner` | `["ownerId"]` | Club lookup: find club record for this owner |

---

## Club Database

### `clubs`

One record per club. Created atomically with payment on the Onboarding Website.

> **Subscription lifecycle:** `active → grace` (at expiry) `→ frozen` (24 h later).
> **Renewal formula:** `newExpiresAt = max(currentSubscriptionExpiresAt, now) + purchasedPeriod`
> — early renewal from active preserves unused time; grace/frozen renewal: `max() = now`.
> Subscription freeze enforced at Convex auth layer — blocks all Owner App API calls.

| Field | Type | Notes |
|-------|------|-------|
| `ownerId` | `Id<"users">` | The owner user. One club per owner account. |
| `name` | `string` | Club display name. |
| `address` | `string` | Club address as entered during onboarding. |
| `subscriptionStatus` | `subscriptionStatus` | `"active"` · `"grace"` · `"frozen"` |
| `subscriptionExpiresAt` | `number` | Unix ms. Checked daily by `subscriptionCheck` cron. |
| `baseRatePerMin` | `number` | Must be > 0 (validated server-side). |
| `currency` | `string` | ISO 4217. Applies to all new sessions. Historical sessions retain their locked `currency`. |
| `minBillMinutes` | `number` | Must be ≥ 1 (validated server-side). |
| `timezone` | `string` | IANA identifier (e.g. `"Asia/Kolkata"`). Used for bookable hours, cancellation day reset, date attribution. |
| `specialRates` | `specialRate[]` | Time-based rate overrides. Backend rejects overlapping rules. Midnight-crossing supported. Each has UUID `id` for targeted edits/deletes. |
| `isDiscoverable` | `boolean` | Controls customer search visibility. Default: `false`. Only clubs with `subscriptionStatus` `"active"` or `"grace"` appear in results. |
| `location` | `locationObj?` | Geocoded `lat`/`lng` from club address. Adjustable via pin drag in Settings. Missing = name search only, no location-based results. |
| `description` | `string?` | Short club bio/tagline. Max 500 chars. |
| `photos` | `string[]?` | Convex file storage IDs. Max 5. Max 5 MB per image. JPEG/PNG/WebP. |
| `amenities` | `string[]?` | Predefined values (`AC`, `Parking`, `Cafe`, `WiFi`, `Lounge`, `Restrooms`) + custom entries. |
| `operatingHours` | `operatingHoursObj?` | Displayed on club profile. Required before enabling booking. |
| `bookingSettings` | `bookingSettingsObj` | Online booking configuration. All defaults set at creation. Enable requires: ≥1 `bookableTableType`, `bookableHours` configured, `operatingHours` configured, ≥1 active table matching a bookable type. |
| `createdAt` | `number` | Unix ms. |

**Indexes**

| Index | Fields | Used For |
|-------|--------|---------|
| `by_owner` | `["ownerId"]` | Webhook → club lookup, renewal, owner-scoped queries |
| `by_subscriptionStatus` | `["subscriptionStatus"]` | `subscriptionCheck` cron queries clubs by status to find expiring/grace subscriptions |

---

### `tables`

Physical billiards tables. Soft delete via `isActive` preserves session history.

> A table with an active session cannot be disabled until the session is ended or cancelled.
> `tableType` stored normalised to **lowercase** at write time. UI shows capitalised.

| Field | Type | Notes |
|-------|------|-------|
| `clubId` | `Id<"clubs">` | Parent club. |
| `label` | `string` | e.g. `"Table 1"`, `"VIP Table"`. |
| `isActive` | `boolean` | Soft delete. `false` = disabled. Preserves session history. |
| `currentSessionId` | `Id<"sessions">?` | Non-null when occupied. Cleared to `null` in the same mutation that marks session completed/cancelled. |
| `tableLock` | `string?` | Lock token (UUID) written when booking modal opens. Standard: 30 s. OTP flow: 3 min. |
| `tableLockExpiry` | `number?` | Unix ms expiry. Concurrent attempts check this. Cleaned up via `ctx.scheduler`. Token matching prevents stale cleanup. |
| `tableType` | `string?` | Free-text. Stored lowercase. e.g. `"french"`, `"snooker"`, `"8-ball"`. |
| `floor` | `string?` | Floor label (e.g. `"Ground Floor"`, `"Level 2"`). |

**Indexes**

| Index | Fields | Used For |
|-------|--------|---------|
| `by_club` | `["clubId"]` | Table grid loads all tables for a club (Slots tab, table management) |
| `by_club_type` | `["clubId", "tableType"]` | Availability engine: `getAvailableSlots` filters by club + table type |

---

### `sessions`

A single table usage from start to checkout/billing.

> **Sessions are NEVER auto-completed.** Left running indefinitely if staff forgets to end them.
> **Rate and `minBillMinutes` locked at session start** — mid-session club changes ignored.

**Billing formula:**
```
actualMinutes   = ceil((endTime - startTime) / 60000)
billableMinutes = max(actualMinutes, session.minBillMinutes)
tableSubtotal   = billableMinutes × session.ratePerMin
discountedTable = tableSubtotal × (1 − discount% / 100)
snackTotal      = Σ(snackPrice × qty)   // never discounted
FINAL_BILL      = discountedTable + snackTotal
```

| Field | Type | Notes |
|-------|------|-------|
| `tableId` | `Id<"tables">` | Which table. |
| `clubId` | `Id<"clubs">` | Parent club. |
| `customerId` | `Id<"users">?` | Null for anonymous guest sessions. |
| `guestName` | `string?` | Name for anonymous guests. |
| `guestAge` | `number?` | Age for anonymous guests. |
| `isGuest` | `boolean` | `true` for OTP fallback anonymous flow. |
| `startTime` | `number` | Unix ms. Timer runs server-side from this. |
| `endTime` | `number?` | Unix ms. Null while active. |
| `billableMinutes` | `number?` | Null while active; set at checkout. |
| `ratePerMin` | `number` | Locked at session start. Uses `specialRate.ratePerMin` if `startTime` falls within a special rate window (matching time-of-day and day-of-week); otherwise `club.baseRatePerMin`. |
| `minBillMinutes` | `number` | Locked at session start from `club.minBillMinutes`. Checkout uses this locked value. |
| `currency` | `string` | ISO 4217 locked at session start. |
| `snackOrders` | `snackOrder[]` | Items added during session. Cannot add after paid. Credit sessions editable until resolved. |
| `billTotal` | `number?` | Final computed total. Null while active. |
| `discount` | `number?` | 0–100. Null = no discount. Applies to table subtotal only, never snacks. |
| `paymentMethod` | `paymentMethod?` | `"cash"` · `"upi"` · `"card"` · `"credit"`. Set at checkout. |
| `paymentStatus` | `paymentStatus` | `"pending"` at creation; `"paid"` or `"credit"` at checkout. |
| `status` | `sessionStatus` | `"active"` · `"completed"` · `"cancelled"` |
| `cancellationReason` | `string?` | `"admin_force_end"` for force-ended sessions. Null for normal staff cancellations. Max 300 chars for admin force-end. |
| `timerAlertMinutes` | `number?` | FCM alert fires when elapsed ≥ this value. Updatable mid-session. |
| `timerAlertFiredAt` | `number?` | Unix ms. Prevents duplicate alerts on app restart. Cleared when `timerAlertMinutes` is updated so alert can refire. |
| `creditResolvedAt` | `number?` | Unix ms when credit is resolved (Mark as Paid action). |
| `creditResolvedMethod` | `creditResolveMethod?` | `"cash"` · `"upi"` · `"card"`. Excludes `"credit"`. |
| `staffAcknowledgedComplaint` | `boolean?` | `true` when staff tapped "Acknowledge and proceed" on a complaint warning. |
| `acknowledgedByRoleId` | `Id<"staffRoles">?` | Active role at acknowledgement. Null if owner (unrestricted) mode. |
| `acknowledgedAt` | `number?` | Unix ms when complaint was acknowledged. |
| `bookingId` | `Id<"bookings">?` | Reference to originating booking. Null for walk-in sessions. |
| `discountAppliedByRoleId` | `Id<"staffRoles">?` | Role that applied discount. Null if owner mode or no discount. |
| `discountAppliedAt` | `number?` | Unix ms when discount was applied. |
| `createdAt` | `number` | Unix ms when session was created (timer started). |
| `updatedAt` | `number` | Unix ms of last change (snack added, completed, credit resolved). |

**Indexes**

| Index | Fields | Used For |
|-------|--------|---------|
| `by_club` | `["clubId"]` | Financial tab, Home Page daily revenue, admin dashboard — all query by club |
| `by_club_status` | `["clubId", "status"]` | Financial tab filters; outstanding credits; Home daily count; cron queries active sessions |
| `by_table` | `["tableId"]` | Best-performing tables query (PRD §7.6); table disable check (is an active session on this table?) |

---

### `bookings`

Online booking records. 7-state lifecycle with strict transition validation.

> `submitBooking` performs 11 fail-fast validation checks inside the mutation.
> Availability engine: `getAvailableSlots` reactive query, 30-min increments, zero gap between bookings.
> Pending bookings treated as slot-blocking (conservative for v1).
> `startSessionFromBooking` window: hardcoded 15 min before to 30 min after requested start time.

**State machine:**
```
pending_approval → confirmed | rejected | cancelled_by_customer | expired
confirmed        → cancelled_by_customer | cancelled_by_club | completed | expired
```
Invalid transitions throw `BOOKING_006`.

| Field | Type | Notes |
|-------|------|-------|
| `clubId` | `Id<"clubs">` | Parent club. |
| `customerId` | `Id<"users">` | Customer who submitted the booking. |
| `tableType` | `string` | Requested table type (e.g. `"Snooker"`, `"8-ball"`). |
| `requestedDate` | `string` | `YYYY-MM-DD` in club timezone. |
| `requestedStartTime` | `string` | `HH:MM` in club timezone. |
| `requestedDurationMin` | `number` | Requested duration in minutes. Must be in `slotDurationOptions`. |
| `status` | `bookingStatus` | 7-state enum. Every mutation verifies current status first. |
| `rejectionReason` | `string?` | Max 300 chars. Owner-provided on rejection. |
| `notes` | `string?` | Max 200 chars. Customer-provided notes. |
| `estimatedCost` | `number?` | Server-computed: `max(duration, minBillMinutes) × applicableRate`. Never trusted from client. Not updated if rates change after submission. |
| `currency` | `string` | ISO 4217 locked at submission from `clubs.currency`. |
| `confirmedTableId` | `Id<"tables">?` | Table assigned by owner during approval. Null at arrival = staff picks a table of matching type. |
| `approvedAt` | `number?` | Unix ms when approved. |
| `approvedByRoleId` | `Id<"staffRoles">?` | Staff role that approved. Null if owner (unrestricted) mode. Server enforces `allowedTableIds` if role has restrictions. |
| `approvedByRoleName` | `string?` | Denormalised role name at approval time. Survives role deletion for audit trail readability. |
| `sessionId` | `Id<"sessions">?` | Linked when converted to session via `startSessionFromBooking`. |
| `reminderSentAt` | `number?` | Unix ms. Prevents duplicate 1-hour-before reminder sends. |
| `approvalReminderSentAt` | `number?` | Unix ms. Prevents duplicate 50%-deadline owner reminder sends. |
| `createdAt` | `number` | Unix ms. |
| `updatedAt` | `number` | Unix ms. |

**Indexes**

| Index | Fields | Used For |
|-------|--------|---------|
| `by_club_date` | `["clubId", "requestedDate"]` | Availability engine — all bookings for a club on a given date |
| `by_customer` | `["customerId"]` | Max active bookings check (2 per customer per club) |
| `by_status` | `["clubId", "status"]` | Owner's Pending/Upcoming sections; approval deadline cron; no-show cron |
| `by_global_status` | `["status"]` | Cross-club crons (`checkApprovalDeadlines`, `detectNoShows`, `sendReminders`) query all bookings by status |

---

### `cancellationCounts`

Per customer per club per day cancellation tracking.

> Max 3 cancellations per day. Resets at midnight in the **club's** timezone.
> Only customer-initiated cancellations increment this.
> System-triggered cancellations (account deletion auto-cancel), club-side cancellations, and system expirations do **not** count.

| Field | Type | Notes |
|-------|------|-------|
| `customerId` | `Id<"users">` | Customer whose cancellations are tracked. |
| `clubId` | `Id<"clubs">` | Club where cancellations are tracked. |
| `date` | `string` | `YYYY-MM-DD` in club timezone. Resets at midnight club local time. |
| `count` | `number` | Number of cancellations on this date. Max enforced: 3. |

**Indexes**

| Index | Fields | Used For |
|-------|--------|---------|
| `by_customer_club_date` | `["customerId", "clubId", "date"]` | Daily cancellation limit check in `cancelBooking` |

---

### `customerBookingStats`

Per customer per club booking reliability metrics.

> Visible to owner during booking approval review.
> Owner sees both this-club stats AND platform-wide aggregate (cross-club query on `bookingLogs`).

| Field | Type | Notes |
|-------|------|-------|
| `customerId` | `Id<"users">` | Customer. |
| `clubId` | `Id<"clubs">` | Club. |
| `noShowCount` | `number` | Incremented when a confirmed booking expires (30 min past start, no session started). |
| `lateCancellationCount` | `number` | Incremented on late cancel (within `cancellationWindowMin` of start). No blocking effect in Phase 1. Used for Phase 2 penalty enforcement. |
| `totalBookings` | `number` | Total bookings submitted at this club (all statuses). |

**Indexes**

| Index | Fields | Used For |
|-------|--------|---------|
| `by_customer_club` | `["customerId", "clubId"]` | Fetch customer's no-show count, late cancellation count, and total bookings when owner reviews a pending booking |

---

### `snacks`

Club menu items. Two-level visibility system.

> `isAvailable=false` — temporarily unavailable (toggle without deleting).
> `isDeleted=true` — permanently removed from menu (soft delete, record retained for `snackOrders[]` history).
> **Snack cutoff:** cannot add to cancelled session; cannot add after completed + paid; credit sessions remain editable until resolved.

| Field | Type | Notes |
|-------|------|-------|
| `clubId` | `Id<"clubs">` | Parent club. |
| `name` | `string` | Item name. |
| `price` | `number` | Price per unit in club's current currency. |
| `isAvailable` | `boolean` | `false` = temporarily unavailable. Distinct from soft delete. |
| `isDeleted` | `boolean` | `true` = permanently removed. Record retained so historical `snackOrders[]` references remain valid. |

**Indexes**

| Index | Fields | Used For |
|-------|--------|---------|
| `by_club` | `["clubId"]` | Every snack menu load queries all snacks for a club |

---

### `staffRoles`

Named roles for staff operating the owner's shared device.

> Staff don't have individual logins — owner selects active role via 6-digit settings passcode.
> Active role stored client-side; mutations accept `roleId` and validate server-side.
> Deleting an active role: app detects stale `roleId`, reverts to unrestricted owner mode.

| Field | Type | Notes |
|-------|------|-------|
| `clubId` | `Id<"clubs">` | Parent club. |
| `name` | `string` | e.g. `"Cashier"`, `"Manager"`, `"Supervisor"`. |
| `allowedTabs` | `string[]` | Valid values: `"slots"` · `"snacks"` · `"financials"` · `"complaints"` · `"bookings"`. Must have at least one — empty array rejected with `STAFF_001`. |
| `allowedTableIds` | `Id<"tables">[]?` | Null = access to all tables. Server enforces: approval/session start rejects if table is outside the allowed set (`STAFF_002`). |
| `canFileComplaints` | `boolean` | Whether this role can file complaints against customers. |
| `canApplyDiscount` | `boolean` | Whether this role can apply discount at checkout. Default: `true`. |
| `maxDiscountPercent` | `number?` | 0–100. Default: 10. Null = no cap. Checkout mutation enforces server-side. Owner in unrestricted mode has no cap. |

**Indexes**

| Index | Fields | Used For |
|-------|--------|---------|
| `by_club` | `["clubId"]` | Role list loads all roles for a club (Settings > Staff Roles) |

---

### `sessions_archive`

Read-only cold storage for sessions older than 2 years.

> Sessions are moved here by the daily archiver cron (runs at 04:00 UTC; checks `day-of-month === 1` inside handler — no `.monthly()` in Convex API).
> **No reactive queries** — historical cold storage only.
> Monthly financial aggregates are pre-computed at month-end to avoid full-table scans.
> Schema **mirrors `sessions` exactly** for seamless data migration.

| Field | Type |
|-------|------|
| `tableId` | `Id<"tables">` |
| `clubId` | `Id<"clubs">` |
| `customerId` | `Id<"users">?` |
| `guestName` | `string?` |
| `guestAge` | `number?` |
| `isGuest` | `boolean` |
| `startTime` | `number` |
| `endTime` | `number?` |
| `billableMinutes` | `number?` |
| `ratePerMin` | `number` |
| `minBillMinutes` | `number` |
| `currency` | `string` |
| `snackOrders` | `snackOrder[]` |
| `billTotal` | `number?` |
| `discount` | `number?` |
| `paymentMethod` | `paymentMethod?` |
| `paymentStatus` | `paymentStatus` |
| `status` | `sessionStatus` |
| `cancellationReason` | `string?` |
| `timerAlertMinutes` | `number?` |
| `timerAlertFiredAt` | `number?` |
| `creditResolvedAt` | `number?` |
| `creditResolvedMethod` | `creditResolveMethod?` |
| `staffAcknowledgedComplaint` | `boolean?` |
| `acknowledgedByRoleId` | `Id<"staffRoles">?` |
| `acknowledgedAt` | `number?` |
| `bookingId` | `Id<"bookings">?` |
| `discountAppliedByRoleId` | `Id<"staffRoles">?` |
| `discountAppliedAt` | `number?` |
| `createdAt` | `number` |
| `updatedAt` | `number` |

**Indexes**

| Index | Fields | Used For |
|-------|--------|---------|
| `by_club` | `["clubId"]` | Monthly financial aggregate queries need to filter by club |

---

## Audit Notes

### Round 1 Fixes (12 issues)

| # | Fix |
|---|-----|
| 1 | Added `cancellationReason` to `sessions` (PRD §6.2 `forceEndSession`) |
| 2 | Added `by_bookingId` index on `bookingLogs` (TDD §4.4 atomic update pattern) |
| 3 | Added `by_customer` + `by_customer_club` indexes on `sessionLogs` (PRD §8.3, §8.6) |
| 4 | Added `by_phone` index on `otpRecords` (TDD §3.7 rate-limit query) |
| 5 | Added `by_tokenHash` index on `passwordResetTokens` (TDD §3.5 token redemption) |
| 6 | Added `by_club` + `by_club_status` indexes on `sessions` (financial tab, dashboard, crons) |
| 7 | Added `by_club` index on `snacks` (menu load query) |
| 8 | Added `by_club` index on `staffRoles` (role list query) |
| 9 | Fixed `bookingSettings.bookableHours` validator — `v.optional` only, removed redundant `v.null()` |
| 10 | Added `by_club` index on `sessions_archive` (monthly aggregate queries) |
| 11 | Added `by_club` index on `tables` (table grid loads all tables for a club) |
| 12 | Replaced `v.any()` on `adminNotifications.deliveryStatus` with proper `v.record(v.string(), deliveryStatusValue)` |

### Round 2 Fixes (8 issues)

| # | Fix |
|---|-----|
| A | Added `notes` field to `bookingLogs` (PRD §8.5 booking detail shows customer notes from `bookingLogs`) |
| B | Added `currency` field to `sessionLogs` (bill total needs currency context for multi-currency display) |
| C | Added `by_global_status` index on `bookings` (cross-club cron queries: approval deadline, no-show, reminder) |
| D | Added `by_subscriptionStatus` index on `clubs` (`subscriptionCheck` cron filters by status) |
| E | Added `by_table` index on `sessions` (best-performing tables query; table disable check) |
| F | Added `by_sessionId` index on `sessionLogs` (session completion/credit-resolve update lookup) |
| G | Added `by_reportedByClubId` index on `complaints` (admin complaint filter by club) |
| H | Added `by_customer_status` index on `bookingLogs` (global club limit check performance) |

---

## Index Quick Reference

| Table | Indexes |
|-------|---------|
| `users` | `by_phone`, `by_email`, `by_googleId` |
| `complaints` | `by_userId`, `by_reportedByClubId` |
| `adminNotifications` | *(none)* |
| `passwordResetTokens` | `by_tokenHash` |
| `adminMfaCodes` | `by_admin` |
| `adminAuditLog` | `by_admin` |
| `otpRecords` | `by_phone` |
| `sessionLogs` | `by_customer`, `by_customer_club`, `by_sessionId` |
| `bookingLogs` | `by_customer`, `by_customer_status`, `by_bookingId` |
| `paymentReceipts` | `by_paymentId`, `by_owner` |
| `clubs` | `by_owner`, `by_subscriptionStatus` |
| `tables` | `by_club`, `by_club_type` |
| `sessions` | `by_club`, `by_club_status`, `by_table` |
| `bookings` | `by_club_date`, `by_customer`, `by_status`, `by_global_status` |
| `cancellationCounts` | `by_customer_club_date` |
| `customerBookingStats` | `by_customer_club` |
| `snacks` | `by_club` |
| `staffRoles` | `by_club` |
| `sessions_archive` | `by_club` |
