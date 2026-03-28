# A3 Billiards OS — Product Requirements Document

> **Version:** 23.0 · Final | **Date:** March 2026 | **Status:** Final
> **Stack:** React Native + Expo · Convex · FCM · WhatsApp Business API
> **Panels:** Admin · Owner · Customer · Onboarding Website

---

## 1. Introduction

### 1.1 Purpose
This document defines the complete product requirements for A3 Billiards OS. It is the single source of truth for design, engineering, and QA teams throughout the development lifecycle.

### 1.2 Product Vision
An all-in-one digital operations platform for billiards club owners — covering table management, customer tracking, billing, inventory, and financial reporting — while maintaining a shared customer identity network that gives every club instant access to cross-club customer history and safety flags. Customers can discover clubs, view profiles, and book tables online with owner-approved reservations.

### 1.3 Scope

A3 Billiards OS is delivered as three separate React Native applications in an Expo monorepo, all connected to a single Convex backend:

| App | Panel | Users |
|-----|-------|-------|
| Admin App | Admin Panel | Platform administrators |
| Owner App | Owner Panel | Club owners and staff |
| Customer App | Customer Panel + Club Discovery + Online Booking | Players / end-users |
| Onboarding Website | Club registration + payments | Prospective club owners |

### 1.4 Out of Scope
- In-app payment processing (payments are record-only in mobile apps)
- Biometric authentication
- SMS-based OTP (WhatsApp Business API only)
- Multi-club management under a single owner account
- Booking payment/deposit collection (deferred to Phase 2)
- Booking refund processing (deferred to Phase 2)

### 1.5 Definitions

| Term | Definition |
|------|-----------|
| Session | A single table booking from start to checkout/billing |
| Slot | A physical billiards table available for booking |
| Booking | An online reservation request requiring owner approval |
| Complaint | A flag filed by an owner against a customer (4 types) |
| Settings Passcode | A 6-digit PIN separate from login password, gates the Settings panel |
| Central DB | Shared Convex database (users, complaints, notifications, bookingLogs) |
| Club DB | Per-club Convex namespace (sessions, tables, snacks, financials, bookings) |

---

## 2. User Personas

| Persona | Role | Primary Goal | Pain Points Solved |
|---------|------|--------------|--------------------|
| Club Owner | Runs billiards venue(s) | Streamline billing and reporting | Manual billing errors, no customer history, cash leakage |
| Staff / Cashier | Operates front desk | Quickly book, track, and check out sessions | Complex software, no role restrictions |
| Customer / Player | Visits clubs to play | Discover clubs, book online, view own history | No club discovery, no online booking, lost receipts |
| Platform Admin | Manages all clubs and users | Oversee platform health, handle disputes | No cross-club visibility, manual support |

---

## 3. System Architecture

### 3.1 Technology Stack

| Layer | Technology | Justification |
|-------|-----------|---------------|
| Mobile / Web Frontend | React Native + Expo SDK 55 | Single codebase; iOS, Android, and Web |
| Monorepo | pnpm workspaces + Turborepo | Three Expo apps with shared packages |
| Backend & Database | Convex (Pro) | Real-time reactive queries, serverless functions, built-in auth |
| Authentication | Convex Auth + Google OAuth | Email/password and Google Sign-In; role enforced server-side |
| App Builds | EAS Build + EAS Submit | Per-app build profiles |
| Subscription Payments | Razorpay | Onboarding Website only; no payment processing in mobile apps |
| Navigation | Expo Router v7 | File-based routing with role-gated layout groups |
| WhatsApp OTP | WhatsApp Business Cloud API | Direct OTP delivery via Meta webhook |
| Push Notifications | FCM (Firebase Cloud Messaging) | Individual sends for per-recipient delivery tracking |
| Email | Resend | Transactional email via React Email templates |
| Location Services | Expo Location + Geocoding API | Club discovery and address-to-coordinate conversion |
| Error Tracking | Sentry | Crash monitoring across all apps and Convex server functions |
| Analytics | PostHog | Booking funnel, feature adoption, retention |
| File Storage | Convex File Storage | Club profile photos |

### 3.2 Data Architecture

| Namespace | Tables | Access |
|-----------|--------|--------|
| Central DB | users, complaints, adminNotifications, passwordResetTokens, adminMfaCodes, otpRecords, sessionLogs, bookingLogs, paymentReceipts, adminAuditLog | Admin (full); Owners (read for customer lookup & complaints); Customers (own records only) |
| Club DB | clubs, tables, sessions, snacks, staffRoles, bookings, cancellationCounts, customerBookingStats | Owner and staff only; fully isolated from other clubs |

---

## 4. Authentication & Security

### 4.1 Panel Login Methods

| Panel | Supported Methods | Post-Login Checks |
|-------|-------------------|-------------------|
| Admin | Email + Password + MFA (email code) | role === 'admin'; MFA code verified before access |
| Owner | Email + Password · Google OAuth | role === 'owner'; passcode setup if not set |
| Customer | Email + Password · Google OAuth | phoneVerified === true; complaint banner if flags exist |

### 4.2 Customer Phone Verification (Mandatory)
One-time mandatory step. Account inactive until verified.

1. **Sign up** — email/password or Google OAuth; consent checkbox required
2. **Phone entry** — E.164 format; duplicate detection (existing customer → redirect to login; existing owner → block registration)
3. **OTP dispatch** — WhatsApp Business Cloud API sends 6-digit OTP
4. **OTP entry** — 10-minute expiry; max 3 failed attempts → 5-minute cooldown; max 5 sends/phone/hour
5. **Activation** — phoneVerified set to true

### 4.3 Owner Settings Passcode
- 6-digit PIN, independent of login password
- Mandatory on first login (non-dismissable modal)
- PIN is bcrypt-hashed (10 rounds); gates Settings panel exclusively
- Staff never interact with this PIN

### 4.4 Credential Reset Flows
- **Forgot password / passcode:** Time-limited (1 hour), single-use reset link via email (Resend)
- Tokens are SHA-256 hashed at rest, single-use, expire after 1 hour

### 4.5 Admin MFA
- After email + password: a 6-digit code sent to registered email
- Code expires after 10 minutes, single-use
- Cannot be bypassed via the API

### 4.6 General Security Requirements
- All Convex server functions enforce role-based access; UI guards alone are insufficient
- Club data namespaced by clubId; cross-club access prevented at server layer
- isFrozen blocks login at Convex auth layer; set exclusively by admin action
- Sensitive admin actions logged to adminAuditLog (immutable audit trail for DPDP Act 2023)
- Admin notification broadcasts rate-limited: max 10 per hour per admin
- No payment data stored or transmitted — bills are record-only
- Account deletion: soft-delete with 30-day grace period before permanent purge
- Data portability (DPDP Act 2023): JSON export sent to registered email within 72 hours
- Consent enforcement: consentGiven === true required server-side before account creation

---

## 5. Onboarding Website

Separate web application (React + Vite) handling end-to-end club owner registration. Connects to the same Convex backend.

### 5.1 Registration Flow

| # | Step | Detail |
|---|------|--------|
| 1 | Owner details | Name, email, password, phone; Privacy Policy/ToS consent checkbox required |
| 2 | Club details | Club name, address (geocoded to lat/lng), currency, base rate/min, min bill minutes, timezone |
| 3 | Subscription | Plan selection and payment via Razorpay |
| 4 | Account created | Atomic with payment; users + clubs records created on payment success; isDiscoverable defaults to false; booking defaults to disabled |
| 5 | First login | Owner App login → passcode setup modal fires immediately |

### 5.2 Subscription Lifecycle
- **Active → Grace** (at expiry): 24-hour grace window; app works normally
- **Grace → Frozen** (after 24 hours): Owner App hard-paused; full-screen renewal page shown
- **Renewal:** Via `/renew` page; subscriptionExpiresAt extended using `max(currentExpiresAt, now) + purchasedPeriod`
- Razorpay webhook handler is idempotent (deduplicates via paymentReceipts table)
- Daily Convex cron manages status transitions and sends renewal reminder emails at 7 days and 1 day before expiry

---

## 6. Admin Panel

Dedicated React Native app for users with role === 'admin'.

### 6.1 Dashboard
- Total registered users (active, non-deleted)
- Total active clubs (subscriptionStatus === 'active' or 'grace')
- Total active sessions (live across all clubs)
- Platform-wide revenue summary (cash basis, totals only)
- Total open complaints
- Total pending bookings across all clubs

### 6.2 User Management

| Feature | Priority | Requirement |
|---------|----------|-------------|
| Search & filter users | P0 | By name, phone, email, or role; paginated |
| View user profile | P0 | Full profile including role, complaint count, consentGiven status |
| Edit user data | P0 | Name, age, email, phone (E.164, deduplicated, logged to audit log) |
| Freeze / unfreeze account | P0 | Sets isFrozen; blocks login at auth layer immediately |
| Reset user password | P0 | Triggers password reset email on behalf of user |
| Force-end stuck session | P1 | Marks session 'cancelled', frees table; logged to adminAuditLog |
| Reset owner settings passcode | P1 | Clears settingsPasscodeSet; forces re-setup on next login |
| Promote to admin | P1 | Valid transition: owner → admin only (customers cannot be promoted) |

### 6.3 Complaint Management
- View all complaints across all clubs; filters: type, date range, club
- Admin can dismiss a complaint (sets removedAt, removedById; removes from user's complaints array)

**Complaint Types:** Violent Behaviour · Theft · Runaway Without Payment · Late Credit Payment

### 6.4 Notification Center
- Compose FCM push notifications to: All Users · By Role · Select Users
- Full broadcast history with per-recipient delivery status ('sent', 'delivered', 'failed')
- Invalid FCM tokens auto-removed from fcmTokens array
- Rate-limited: max 10 broadcasts/hour/admin

---

## 7. Owner Panel

Core operational interface scoped to the owner's club. Staff access a restricted subset based on their assigned role.

### 7.1 Home Page
- Active staff role indicator at top of screen
- Today's total revenue (cash basis; paid sessions only; in club's local timezone)
- Number of tables currently active
- Number of sessions completed today
- Booking summary (if bookingSettings.enabled): pending count, confirmed count, completed count
- Quick-access tile menu to all major modules

### 7.2 Slot Management

#### Table Grid
- Real-time free/occupied status via Convex reactive queries
- Color coding: green = free, red = occupied, grey = disabled
- Upcoming booking indicator: 'Booked [time]' tag shown for confirmed bookings within 2 hours
- Filter bar: by floor, table type
- Double-booking prevention: tableLock written on modal open (30s standard; 3min for OTP flows)
- Walk-in conflict warning (advisory): shown when starting walk-in on table with booking within 60 minutes

#### Starting a Session

| Feature | Priority | Requirement |
|---------|----------|-------------|
| Phone number lookup | P0 | Check central DB |
| Existing customer flow | P0 | Auto-fill name; show complaint alerts; confirm and start timer |
| New customer flow | P0 | Collect name + age; send WhatsApp OTP; create users record; start timer |
| OTP failure fallback | P0 | (A) Proceed as anonymous guest or (B) Cancel entirely |
| Anonymous guest session | P0 | Stored with isGuest flag; no central DB entry; no cross-club history |
| Complaint alert on lookup | P0 | Advisory warning showing complaint types; never a hard block |
| Start from booking | P0 | Convert confirmed booking to active session; no phone lookup required |
| Timer alert (FCM) | P1 | Optional N-minute threshold; FCM push fires when reached |

#### Billing Formula

```
actualMinutes     = ⌈(endTime − startTime) ÷ 60000⌉
billableMinutes   = max(actualMinutes, minBillMinutes)
tableSubtotal     = billableMinutes × ratePerMin
discountedTable   = tableSubtotal × (1 − discount% ÷ 100)
snackTotal        = Σ(snackPrice × qty)  [never discounted]
FINAL BILL        = discountedTable + snackTotal
```

> Rate is locked at session start. Sessions crossing a rate boundary are billed at the rate in effect when the session started.

### 7.3 Customer Complaints
- File complaints against verified (non-guest) customers; written to central DB, visible to all clubs
- Types: Violent Behaviour, Theft, Runaway Without Payment, Late Credit Payment
- Owner can retract their own complaints (soft-delete)
- Filing requires role with canFileComplaints === true

### 7.4 Snacks
- Add/edit/remove menu items (soft delete preserves historical orders)
- Toggle item availability (isAvailable flag, distinct from deletion)
- Add snacks to active sessions; cannot add after session is completed/paid
- Snack total displayed as separate line item on bill; never discounted

### 7.5 Settings

All Settings actions require the 6-digit settings passcode.

**Table Management:** Add, rename, disable tables (soft delete); cannot disable table with active session.

**Rate Configuration:**
- Default base rate per minute; minimum billable minutes
- Special time-based rates (start/end time + days of week); overlapping rates rejected
- Club currency; IANA timezone

**Staff Role Management:**
- Staff use owner's shared device; owner selects active role via settings passcode
- Create named roles (e.g. Cashier, Manager) with:
  - Allowed tabs: slots, snacks, financials, complaints, bookings (at least one required)
  - Optional: restrict to specific table IDs
  - canFileComplaints, canApplyDiscount, maxDiscountPercent
- Deleting active role → app reverts to unrestricted owner mode

**Online Booking Settings:**
- Enable/disable master toggle (requires: ≥1 bookable table type, bookableHours configured, operatingHours set, ≥1 active matching table)
- Max advance days (default: 7), Min advance minutes (default: 60)
- Slot duration options: multi-select from 30/60/90/120/180 min
- Bookable table types (multi-select from active club table types)
- Bookable hours (open/close times + days of week; must fall within operatingHours)
- Cancellation window (default: 30 min) and Approval deadline (default: 60 min)

**Club Profile Management:**
- Discoverability toggle (isDiscoverable)
- Description (max 500 characters)
- Photo upload: up to 5 images, max 5 MB each (JPEG/PNG/WebP)
- Amenities: multi-select (AC, Parking, Cafe, WiFi, Lounge, Restrooms) + custom
- Location pin adjustment (drag to fine-tune geocoded coordinates)

**Security Settings:**

| Feature | Priority | Requirement |
|---------|----------|-------------|
| Change account password | P0 | Verify current → enter/confirm new; session stays active |
| Forgot account password | P0 | Email reset link (1-hour, single-use) |
| Change settings passcode | P0 | Verify current → enter/confirm new |
| Forgot settings passcode | P0 | Email reset link; clears settingsPasscodeSet |
| Download my data | P0 | JSON export sent to email within 72 hours (requires passcode) |
| Request account deletion | P0 | Prerequisites: no active sessions, no outstanding credits, no confirmed bookings; pending bookings auto-cancelled |

### 7.6 Financial Tab

| Feature | Priority | Requirement |
|---------|----------|-------------|
| Revenue by date/week/month | P0 | Bar and line charts; cash basis (paid sessions only); attributed to session endTime date in club's timezone |
| Custom date range | P0 | Date range picker; all metrics update |
| Payment method breakdown | P0 | Cash/UPI/Card/Credit split (value and count) |
| Outstanding credits report | P0 | All credit sessions; 'Mark as Paid' action (selects resolution method) |
| Best-performing tables | P1 | Ranked by hours played and revenue |
| Snack sales breakdown | P1 | Revenue per snack item |
| Peak hour heatmap | P1 | 7-day grid showing average session count by hour |

### 7.7 Role-Based Access Control
- Active role stored client-side; each Convex mutation accepts roleId and validates server-side
- Role name always displayed in top-right corner (display-only)
- Staff see only tabs and tables listed in their role's allowedTabs and allowedTableIds

### 7.8 Online Booking Management

**Bookings Tab** (visible regardless of bookingSettings.enabled; three sections):

**Pending section** — all bookings with status 'pending_approval', ordered by requested start time:
- Shows: customer name, phone, date, time, duration, table type, estimated cost, notes
- Customer booking track record: this-club stats AND platform-wide stats (no-shows, total bookings)
- Complaint indicator (advisory; does not block approval)
- **Approve:** optional table picker → assigns table; calls approveBooking mutation; FCM sent to customer
- **Reject:** optional rejection reason (max 300 chars); FCM sent to customer

**Upcoming section** — all confirmed bookings for today or future:
- **Start Session button:** visible 15 min before to 30 min after booking start time; calls startSessionFromBooking mutation; re-checks customer isFrozen, deletionRequestedAt, and complaints before creating session
- **Cancel button:** with optional reason (max 300 chars); FCM sent to customer

**History section** — all rejected/cancelled/expired/completed bookings; searchable (debounced 300ms); filterable by status, date range, customer name.

#### Booking State Machine

```
pending_approval → confirmed | rejected | cancelled_by_customer | expired
confirmed        → cancelled_by_customer | cancelled_by_club | completed | expired
```

#### Automated Cron Jobs

| Job | Interval | Behaviour |
|-----|----------|-----------|
| Approval deadline check | Every 5 min | At 50% elapsed: FCM reminder to owner; at full deadline: expires booking, FCM to customer |
| No-show detection | Every 10 min | 30 min past start time with no session: marks expired, increments noShowCount, FCM to both |
| Booking reminder | Every 5 min | 55–65 min before start: FCM reminder to customer and owner (once, via reminderSentAt) |

---

## 8. Customer Panel

### 8.1 Registration & Login
- Email/password or Google OAuth
- Mandatory phone verification (WhatsApp OTP) before account activation
- Complaint banner alert on login (alert only — no complaint details shown)
- Privacy Policy/ToS consent checkbox required before account creation
- Bottom tab navigation: Home · Discover · Bookings · History · Profile

### 8.2 Club Discovery
- **Location-based search:** Nearby clubs sorted by Haversine distance; 50km default radius; only isDiscoverable === true and non-frozen clubs
- **Name-based search:** Debounced at 300ms; case-insensitive substring match; works without location
- **Club cards:** Club name, distance, address, table type chips, thumbnail photo, operating hours summary
- **Location denied fallback:** Name search only; subtle prompt to enable location
- **Pagination:** Pages of 20; infinite scroll

### 8.3 Club Profile
- Photo gallery (horizontal scrollable); club info; pricing (base + special rates); amenities; table types with counts
- **Book a Table** button (hidden if bookingSettings.enabled is false)
- Customer history at this club (P1)

### 8.4 Online Booking Flow

All times displayed in the club's timezone (with label if different from customer's device timezone).

| Step | Detail |
|------|--------|
| 1. Select table type | Bookable types from bookingSettings.bookableTableTypes |
| 2. Select date | Next N days (maxAdvanceDays); days outside bookableHours.daysOfWeek greyed out |
| 3. Select duration | Buttons for each value in slotDurationOptions |
| 4. Select time | 30-minute increments within bookableHours; real-time availability via reactive query |
| 5. Review & submit | Summary with estimated cost; optional notes (max 200 chars); submitBooking mutation |

**Booking submission validates (in order):**
1. Customer authenticated, not frozen, not pending deletion, phone verified
2. Club's bookingSettings.enabled and subscriptionStatus not 'frozen'
3. Requested tableType in bookableTableTypes
4. Date not in past and within maxAdvanceDays
5. Start time within bookableHours and correct day of week
6. Time from now ≥ minAdvanceMinutes
7. Duration in slotDurationOptions
8. Customer has < 2 active bookings at this club
9. Customer has active bookings at < 2 different clubs (server-side serialized)
10. At least one matching table available for the full duration

**Limits:**
- Max 2 active bookings per customer per club
- Max 2 clubs with active bookings simultaneously
- Max 3 cancellations per customer per club per day (resets at midnight in club's timezone)
- Late cancellations (within cancellationWindowMin) tracked but not blocked in Phase 1

### 8.5 My Bookings Screen
- All bookings across all clubs; ordered by most recent first
- Status colour coding: yellow (pending), green (confirmed), red (rejected), grey (cancelled/expired), blue (completed)
- Cancel action on pending/confirmed bookings
- Real-time status updates via Convex reactive queries
- Booking detail screen (booking/[bookingId].tsx): full booking info, cancel action, 'View Club' button; graceful tombstone state if club is purged

**Home screen indicators:**
- 'Next Booking' card showing nearest confirmed booking with countdown
- Badge on Bookings tab icon for pending_approval count

### 8.6 Session History
- All sessions across all clubs (active, completed, cancelled)
- Active sessions: real-time elapsed duration (client-side, updated per second)
- Each entry: club name, table, date, duration, bill total, payment method, status
- Credit sessions shown with 'Credit Owed' badge

### 8.7 Profile Management
- View/edit name and age
- Change password (email/password accounts only; hidden for Google Sign-In)
- Phone number permanently read-only (only admin can update)
- Download my data: JSON export to email within 72 hours
- Request account deletion: active bookings auto-cancelled (system-triggered, not counted against daily limit); 30-day grace period

### 8.8 Push Notifications
- Booking notifications: approved, rejected, cancelled by club, expired, 1-hour reminder
- Admin broadcasts
- Tapping booking notification → navigates to booking detail screen

---

## 9. Notifications & Integrations

### 9.1 FCM Push Notification Events

| Trigger | Recipient | Message |
|---------|-----------|---------|
| Session timer alert | Owner (all devices) | 'Table [X] alert: [N] minutes reached' |
| Booking approved | Customer | 'Booking Confirmed: Your booking at [club] on [date] at [time] has been confirmed.' |
| Booking rejected | Customer | 'Booking Declined: Your booking request at [club] was declined.' (+ reason) |
| Booking cancelled by club | Customer | 'Booking Cancelled: Your booking at [club] was cancelled by the club.' |
| Booking expired (no response) | Customer | 'Booking Expired: The club didn't respond in time.' |
| New booking submitted | Owner | 'New Booking Request: [Customer] requested [tableType] on [date] at [time].' |
| Booking cancelled by customer | Owner | 'Booking Cancelled: [Customer] cancelled their booking for [date] at [time].' |
| No-show detected | Owner + Customer | Owner: '[Customer] didn't show up.' / Customer: 'Your booking expired because you did not arrive within 30 minutes.' (If club frozen: 'The club is currently unavailable.') |
| Booking reminder (1 hr before) | Customer + Owner | 'Reminder: Your booking at [club] is in 1 hour ([time]). See you there!' |
| Approval deadline approaching | Owner | 'Pending booking needs your response. Expires in [N] minutes.' |
| Active bookings cancelled (account deletion) | Owner | Notification per cancelled booking |

### 9.2 WhatsApp Business API (OTP)
- Convex HTTP action serves as webhook endpoint
- OTP: 6-digit, 10-minute expiry, max 3 incorrect attempts (5-min cooldown), max 5 sends/phone/hour
- Requires verified Meta Business Account

### 9.3 Email (via Resend)

| Email Type | Trigger |
|-----------|---------|
| Account password reset | Forgot password request |
| Settings passcode reset | Forgot passcode request |
| Admin MFA code | Admin login; 10-minute single-use code |
| Customer welcome | After phone verification |
| Onboarding welcome | After successful club registration and payment |
| Subscription renewal reminder | 7 days and 1 day before expiry |
| Subscription grace period started | On grace period entry |
| Account deletion confirmation | On deletion request; contains cancellation link |
| Subscription renewal confirmation | After successful renewal |
| Data export ready | Within 72 hours of 'Download my data' request |

---

## 10. Data Schema Reference

### 10.1 Central Database

**users** — `phone` (unique), `phoneVerified`, `name`, `age`, `email`, `googleId`, `fcmTokens[]`, `settingsPasscodeHash`, `settingsPasscodeSet`, `complaints[]`, `isFrozen`, `role`, `deletionRequestedAt`, `consentGiven`, `consentGivenAt`, `createdAt`

**complaints** — `userId`, `reportedByClubId`, `sessionId?`, `type`, `description`, `removedAt?`, `removedById?`, `dismissalReason?`, `createdAt`

**adminNotifications** — `sentByAdminId`, `title`, `body`, `targetType`, `targetUserIds?`, `targetRole?`, `deliveryStatus`, `createdAt`

**passwordResetTokens** — `userId`, `tokenHash` (SHA-256), `type` (accountPassword | settingsPasscode), `expiresAt`, `used`, `createdAt`

**adminMfaCodes** — `adminId`, `codeHash` (SHA-256), `expiresAt` (10 min), `used`, `createdAt`

**adminAuditLog** — `adminId`, `action` (phone_update | user_freeze | user_unfreeze | password_reset | passcode_reset | role_change | complaint_dismiss | session_force_end), `targetUserId?`, `previousValue?`, `newValue?`, `notes?`, `createdAt`

**otpRecords** — `phone`, `otpHash` (bcrypt), `attempts`, `cooldownUntil?`, `expiresAt` (10 min), `used`, `createdAt`

**sessionLogs** — `sessionId`, `customerId`, `clubId`, `clubName` (denorm), `tableLabel` (denorm), `startTime`, `endTime?`, `billTotal?`, `currency?`, `paymentStatus`, `paymentMethod?`, `status`, `createdAt`, `updatedAt`
> Guest sessions never written here.

**bookingLogs** — `bookingId`, `customerId`, `clubId`, `clubName` (denorm), `clubAddress?` (denorm), `thumbnailPhotoId?` (denorm), `tableType`, `status`, `rejectionReason?`, `confirmedTableLabel?`, `estimatedCost?`, `currency`, `notes?`, `requestedDate`, `requestedStartTime`, `requestedDurationMin`, `createdAt`, `updatedAt`

**paymentReceipts** — `paymentId` (Razorpay, unique), `ownerId`, `clubId`, `amountPaid`, `processedAt`
> Idempotency table: if paymentId exists → return 200 immediately.

### 10.2 Per-Club Database

**clubs** — `ownerId`, `name`, `address`, `subscriptionStatus`, `subscriptionExpiresAt`, `baseRatePerMin`, `currency`, `minBillMinutes`, `timezone` (IANA), `specialRates[]`, `isDiscoverable`, `location` {lat, lng}?, `description?`, `photos[]?`, `amenities[]?`, `operatingHours?`, `bookingSettings`, `createdAt`

**bookingSettings object** — `enabled` (default false), `maxAdvanceDays` (7), `minAdvanceMinutes` (60), `slotDurationOptions` ([30,60,90,120]), `cancellationWindowMin` (30), `approvalDeadlineMin` (60), `bookableTableTypes[]`, `bookableHours?`

**tables** — `clubId`, `label`, `isActive`, `currentSessionId?`, `tableLock?`, `tableLockExpiry?`, `tableType?`, `floor?`

**sessions** — `tableId`, `clubId`, `customerId?`, `guestName?`, `guestAge?`, `isGuest`, `startTime`, `endTime?`, `billableMinutes?`, `ratePerMin` (locked at start), `minBillMinutes` (locked at start), `currency` (locked at start), `snackOrders[]`, `billTotal?`, `discount?`, `paymentMethod?`, `paymentStatus`, `status`, `cancellationReason?`, `timerAlertMinutes?`, `creditResolvedAt?`, `creditResolvedMethod?`, `bookingId?`, `discountAppliedByRoleId?`, `createdAt`, `updatedAt`

> Sessions are NEVER auto-completed. Left running until staff manually ends or cancels.

**bookings** — `clubId`, `customerId`, `tableType`, `requestedDate`, `requestedStartTime`, `requestedDurationMin`, `status` (7-state), `rejectionReason?`, `notes?`, `estimatedCost?`, `currency`, `confirmedTableId?`, `approvedAt?`, `approvedByRoleId?`, `approvedByRoleName?` (denorm), `sessionId?`, `reminderSentAt?`, `approvalReminderSentAt?`, `createdAt`, `updatedAt`

**cancellationCounts** — `customerId`, `clubId`, `date` (YYYY-MM-DD in club timezone), `count` (max 3)

**customerBookingStats** — `customerId`, `clubId`, `noShowCount`, `lateCancellationCount`, `totalBookings`

**snacks** — `clubId`, `name`, `price`, `isAvailable`, `isDeleted`

**staffRoles** — `clubId`, `name`, `allowedTabs[]` (min 1), `allowedTableIds[]?`, `canFileComplaints`, `canApplyDiscount`, `maxDiscountPercent?`

**sessions_archive** — mirrors sessions schema; read-only cold storage for sessions older than 2 years; monthly financial aggregates pre-computed to avoid full-table scans

---

## 11. Non-Functional Requirements

| Category | Requirement | Target |
|----------|-------------|--------|
| Performance | Table grid update latency | < 500 ms via Convex reactive queries |
| Performance | Session checkout compute | < 1 second |
| Performance | Booking slot availability query | < 1 second; real-time updates within 500 ms |
| Availability | Platform uptime | 99.5% (Convex managed infrastructure) |
| Security | Data isolation | No cross-club data access; enforced at server function level |
| Security | Credential storage | bcrypt for passwords/PINs; SHA-256 for reset tokens |
| Scalability | Tables per club | Unlimited |
| Scalability | Club discovery | Haversine-based; migrate to Algolia/Typesense if scale exceeds several thousand clubs |
| Usability | Session start to timer | Existing customer: < 30 seconds; New customer (incl. OTP): < 3 minutes |
| Usability | Booking flow completion | Under 60 seconds |
| Offline | Graceful degradation | Clear offline state; no silent failures during session or booking management |
| Accessibility | WCAG 2.1 AA | Colour contrast, 44×44 pt touch targets, screen reader support; status indicators must include text labels (not colour alone) |
| Compliance | DPDP Act 2023 | Privacy consent, account deletion, data portability (72-hour JSON export), admin audit log |
| Analytics | PostHog events | session_started, booking_submitted, booking_approved, club_profile_viewed, discovery_search_performed |
| Error tracking | Sentry | All apps + Convex; alert thresholds on critical mutations (session end, booking submission, payment recording) |

---

## 12. Feature Priority Matrix

### P0 — Must Ship

- All three panel logins (email + Google)
- Customer phone verification (WhatsApp OTP)
- Owner settings passcode (first login)
- Slot management — table grid + session start
- Session billing & checkout
- Snacks module
- Cross-club complaint alerts and filing
- Credential change/reset flows (password + passcode)
- Admin user management, notification center
- Financial tab (revenue charts, credits report, custom date range)
- Onboarding website (registration + payment)
- Account deletion (customer + owner) — DPDP compliance
- Privacy Policy / ToS consent checkbox — DPDP compliance
- Admin audit log — DPDP compliance
- **Club discovery — location + name search** *(NEW)*
- **Club profile screen** *(NEW)*
- **Online booking flow** *(NEW)*
- **Booking approval/rejection by owner** *(NEW)*
- **My Bookings screen in Customer App** *(NEW)*
- **Booking notifications (FCM for all status changes)** *(NEW)*
- **Online booking settings in Owner Settings** *(NEW)*
- **Club profile management in Owner Settings** *(NEW)*
- **Booking expiry cron jobs (approval deadline + no-show)** *(NEW)*
- **Start session from booking** *(NEW)*
- **Table grid booking indicators** *(NEW)*
- **Cancellation rate limiting (3/day/club)** *(NEW)*
- **Max active bookings (2/customer/club)** *(NEW)*
- **Global booking club limit (max 2 clubs)** *(NEW)*
- **Customer booking detail screen** *(NEW)*
- Subscription renewal flow (/renew page)

### P1 — High Priority

- No-show tracking
- Staff role-based access control
- FCM timer alerts for sessions
- Special time-based rates
- Admin notification delivery history
- Snack availability toggle
- Customer session history (with real-time active display)
- Booking reminder notification — 1 hour before start *(NEW)*
- Approval deadline approaching reminder *(NEW)*
- Owner Bookings tab History section *(NEW)*
- Customer Home screen booking indicators *(NEW)*
- Data portability — 'Download my data' (customer + owner) — DPDP Act 2023
- Accessibility — WCAG 2.1 AA
- Sentry error tracking
- PostHog analytics

### P2 — Future / Deferred

- Booking payment/deposit collection
- Booking refund processing
- Session data archiving (sessions_archive)

---

## 13. Key Edge Cases

### Customer State Changes
- **Customer frozen between booking and arrival:** startSessionFromBooking re-checks isFrozen; blocks if frozen
- **Customer deleted between booking and arrival:** mutation checks deletionRequestedAt; blocks if set
- **Complaints after booking confirmed:** advisory warning at session start; no auto-block

### Table / Club State Changes
- **Table disabled after booking confirmed:** startSessionFromBooking prompts staff to pick alternative
- **Club subscription freezes:** pending bookings auto-expire via cron; no-show cron runs but changes customer FCM message to 'club currently unavailable'
- **Booking disabled while customer is in booking flow:** submitBooking mutation checks enabled flag; rejects with descriptive error

### Booking Conflicts & Concurrency
- **Two customers book simultaneously:** Convex mutation serialization; only one succeeds
- **Owner approves booking but table taken by walk-in:** approveBooking mutation checks conflicts; throws error for owner to pick alternative
- **Approval deadline and owner tap approve simultaneously:** atomic status transition; first writer wins; both outcomes consistent

### Cancellation & Expiry
- **Account deletion auto-cancels bookings:** system-triggered; does NOT increment cancellationCounts
- **Cancellation limit is per-club:** Club A cancellations don't affect Club B
- **Expiry while club is frozen:** 'frozen club' message sent to customer instead of no-show message

### Data Integrity
- **bookingLogs + bookings updated atomically:** same Convex mutation transaction; no partial writes
- **Club renamed after bookings exist:** bookingLogs retains denormalized clubName from submission time
- **Club purged after owner deletion:** bookingLogs entries retained; clubId becomes stale but denormalized fields remain readable

---

## 14. Monorepo Structure (Summary)

```
a3-billiards-os/
├── apps/
│   ├── admin-app/         # Admin Panel
│   ├── owner-app/         # Owner Panel (incl. bookings.tsx — NEW)
│   └── customer-app/      # Customer Panel + Discover + Booking flows
├── packages/
│   ├── convex/            # Shared backend
│   │   ├── schema.ts, auth.config.ts, http.ts, crons.ts
│   │   ├── bookings.ts, bookingLogs.ts, clubDiscovery.ts  # NEW
│   │   └── paymentReceipts.ts                            # NEW
│   ├── ui/                # Shared components
│   │   ├── BookingCard, ClubCard, TimeSlotGrid,
│   │   │   TableTypePicker, DateStrip               # NEW
│   └── utils/
│       ├── availability.ts, timezone.ts, analytics.ts   # NEW
└── onboarding-website/    # Standalone React + Vite
    ├── pages/register.tsx
    └── pages/renew.tsx    # NEW (§5.3)
```

---

*Document synthesized from PRD v23.0 Final + TDD v1.4. All sections subject to revision as requirements evolve.*
