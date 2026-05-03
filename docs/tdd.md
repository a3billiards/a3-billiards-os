# A3 Billiards OS — Technical Design Document

> **Version:** 1.4 (PRD v23 Aligned) | **Date:** March 2026
> **Stack:** Expo SDK 55 + RN 0.83 + React 19.2 + Convex Pro
> **Platforms:** iOS 15.1+, Android API 24+, Web

---

## Table of Contents

1. [Introduction](#1-introduction)
2. [System Architecture](#2-system-architecture)
3. [Authentication & Security](#3-authentication--security)
4. [Data Architecture](#4-data-architecture)
5. [Infrastructure & CI/CD](#5-infrastructure--cicd)
6. [Integrations](#6-integrations)
7. [Cron Jobs](#7-cron-jobs)
8. [Error Handling](#8-error-handling)
9. [Design System](#9-design-system)
10. [Testing](#10-testing)
11. [Compliance](#11-compliance-dpdp-act-2023)
12. [Appendix](#12-appendix)

---

## 1. Introduction

### 1.1 Purpose
This TDD translates PRD v23 into a complete, implementation-ready specification with code-level detail for every feature, flow, and edge case.

### 1.2 Scope
- Admin App (React Native / Expo) — Platform administration
- Owner App (React Native / Expo) — Club operations and staff management
- Customer App (React Native / Expo) — Club discovery, booking, session history
- Onboarding Website (Vite + React) — Club registration and subscription renewal

### 1.3 Confirmed Assumptions

| # | Assumption |
|---|-----------|
| 1 | Expo SDK 55 (RN 0.83, React 19.2, Expo Router v7). New Architecture only. |
| 2 | Convex Pro: 10s mutation timeout, 2min action timeout. |
| 3 | RLS via `convex-helpers` + explicit mutation-level authorization. |
| 4 | Native Google Sign-In via `@react-native-google-signin`, bridged to Convex Auth via action. |
| 5 | FCM: individual sends (not topics) for per-recipient delivery tracking. |
| 6 | Dark mode only. No light mode toggle. |
| 7 | English only for v1. |
| 8 | All crypto runs in Convex **ACTIONS**, not mutations. |
| 9 | Booking lifecycle scans use `crons.ts`. Table lock cleanup uses `ctx.scheduler`. |
| 10 | Zero gap between back-to-back bookings (3:00 end does not overlap 3:00 start). |
| 11 | Password change: current session stays valid, other sessions unaffected (PRD as-is). |
| 12 | Start Session from booking window: hardcoded 15 min before to 30 min after. |

---

## 2. System Architecture

### 2.1 Architecture Layers

| Layer | Technology | Details |
|-------|-----------|---------|
| Mobile | Expo SDK 55 + RN 0.83 | 3 apps in monorepo. Expo Router v7. `/src/app`. |
| Web | Vite + React | Onboarding Website (separate repo). Vercel. |
| Backend | Convex (Pro) | Queries, mutations, actions. Real-time reactive. |
| Auth | `@convex-dev/auth` + Google OAuth | Email/password + native Google. Admin MFA. |
| Push | FCM HTTP v1 | Individual sends. OAuth2 service account. |
| OTP | WhatsApp Business Cloud API | Direct Meta webhook. |
| Email | Resend + `@react-email/components` | React templates. |
| Payments | Razorpay Hosted Checkout | Onboarding Website only. |
| Geocoding | Google Maps Geocoding API | Address to lat/lng. |
| Location | Expo Location | Device GPS. Permission on Discover tab. |
| Errors | Sentry | All apps + Convex functions. |
| Analytics | PostHog Cloud | Booking funnel, adoption. |
| Storage | Convex File Storage | Photos. Client: 2MB 1920×1080 JPEG. |

### 2.2 Domains

| Domain | Purpose | Infra |
|--------|---------|-------|
| `a3billiards.com` | Landing. `/privacy` `/terms` `/dpdp` | Vercel |
| `register.a3billiards.com` | `/register` and `/renew` | Vercel |
| `api.a3billiards.com` | Webhooks (WhatsApp, Razorpay) | Convex |
| `links.a3billiards.com` | Universal/App links | Vercel |

### 2.3 Environment Variables

| Store | Variables | Access |
|-------|-----------|--------|
| Convex Secrets | `JWT_PRIVATE_KEY`, `JWKS` (Convex Auth session JWTs — use `npx @convex-dev/auth` or generate an RS256 PKCS#8 key + JWKS; issuer `CONVEX_SITE_URL` is provided by Convex and must match `auth.config.ts`), `WHATSAPP_API_TOKEN`, `WHATSAPP_PHONE_ID`, `WHATSAPP_VERIFY_TOKEN`, `RAZORPAY_KEY_ID`, `RAZORPAY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`, `RESEND_API_KEY`, `ADMIN_EMAIL`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_IOS_CLIENT_ID` (comma-separated if Customer + Owner iOS OAuth clients must both verify), `GOOGLE_ANDROID_CLIENT_ID`, `GOOGLE_WEB_CLIENT_ID`, `FIREBASE_PROJECT_ID`, `FIREBASE_SERVICE_ACCOUNT_JSON`, `SENTRY_DSN`, `POSTHOG_API_KEY`, `GOOGLE_MAPS_API_KEY` | Server only |
| EAS / app env | `EXPO_PUBLIC_CONVEX_URL`, `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`, `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` (iOS OAuth client for that app’s bundle; drives URL scheme in `app.config.ts`), optional `GOOGLE_SERVICE_INFO_PLIST` / `GOOGLE_SERVICES_JSON` paths for EAS file secrets, `CONVEX_URL`, `SENTRY_AUTH_TOKEN`, `POSTHOG_API_KEY` | Mobile build |
| Vercel | `VITE_CONVEX_URL`, `VITE_RAZORPAY_KEY_ID`, `SENTRY_DSN`, `POSTHOG_API_KEY` | Web |

### 2.4 Monorepo Structure

```
a3-billiards-os/                         # Turborepo + pnpm
├─ apps/
│  ├─ admin-app/src/app/                 # _layout, index, users, complaints, notifications
│  ├─ owner-app/src/app/                 # _layout, index, slots, snacks, financials,
│  │                                     # complaints, bookings, settings, change-password,
│  │                                     # change-passcode, reset-credential
│  └─ customer-app/src/app/              # _layout, index, discover, club/[clubId],
│                                        # book/[clubId], bookings, booking/[bookingId],
│                                        # history, profile, verify-phone, change-password
├─ packages/
│  ├─ convex/                            # Shared backend
│  │  ├─ schema.ts, auth.config.ts, http.ts, crons.ts, functions.ts, rls.ts
│  │  ├─ model/ (users, sessions, bookings, billing, availability,
│  │  │          complaints, rateLimiter, authHelpers)
│  │  ├─ users.ts, sessions.ts, slots.ts, snacks.ts, financials.ts,
│  │  ├─ complaints.ts, notifications.ts, passcode.ts, passwordReset.ts,
│  │  ├─ mfa.ts, subscriptions.ts, deletion.ts, bookings.ts, bookingLogs.ts,
│  │  └─ paymentReceipts.ts, clubDiscovery.ts, clubProfile.ts, googleAuth.ts
│  ├─ ui/                                # Shared React Native components
│  │  ├─ theme/ (colors.ts, typography.ts, spacing.ts)
│  │  ├─ components/ (TableGrid, SessionTimer, BillModal, SnackPicker,
│  │  │               ComplaintBanner, PasscodeSetupModal, PasscodeGate, UserSelector,
│  │  │               BookingCard, ClubCard, TimeSlotGrid, TableTypePicker, DateStrip,
│  │  │               OfflineScreen, NetworkGuard)
│  │  └─ errors/ (ErrorBoundary, TabErrorBoundary, errorCodes.ts)
│  └─ utils/ (billing.ts, otp.ts, fcm.ts, availability.ts, timezone.ts, analytics.ts)
├─ emails/templates/ (PasswordReset, PasscodeReset, AdminMfa, CustomerWelcome,
│                     OnboardingWelcome, SubscriptionReminder, SubscriptionGracePeriod,
│                     RenewalConfirmation, DeletionConfirmation, DataExport)
└─ turbo.json, pnpm-workspace.yaml, package.json
```

---

## 3. Authentication & Security

### 3.1 Authentication Flows

| Panel | Methods | Post-Login | Storage |
|-------|---------|-----------|---------|
| Admin | Email+Password+MFA | `role=admin`; MFA verified | `expo-secure-store` |
| Owner | Email+Password; Google | `role=owner`; passcode setup if !set | `expo-secure-store` |
| Customer | Email+Password; Google | `phoneVerified`; complaint banner; FCM refresh | `expo-secure-store` |
| Web | Email+Password | N/A (registration only) | HttpOnly cookies |

### 3.2 Native Google Sign-In (Complete Flow)

**Step 1:** Client calls native Google Sign-In.
**Step 2:** `idToken` sent to Convex action.
**Step 3:** For existing users, return session. For new users, return `pendingProfile` — client shows consent + phone + age flow.
**Step 4:** After OTP verification, client calls `completeGoogleRegistration`.

```typescript
// packages/convex/googleAuth.ts
import { action, internalMutation, internalQuery } from './_generated/server';
import { internal } from './_generated/api';
import { v } from 'convex/values';

// ── Step 2: Verify token and check existing user ──
export const verifyGoogleToken = action({
  args: { idToken: v.string() },
  handler: async (ctx, { idToken }) => {
    const { OAuth2Client } = await import('google-auth-library');
    const client = new OAuth2Client();
    const ticket = await client.verifyIdToken({
      idToken,
      audience: [
        process.env.GOOGLE_IOS_CLIENT_ID,
        process.env.GOOGLE_ANDROID_CLIENT_ID,
        process.env.GOOGLE_WEB_CLIENT_ID,
      ],
    });
    const gPayload = ticket.getPayload();
    if (!gPayload) throw new Error('GOOGLE_AUTH_001: Invalid token');

    const existing = await ctx.runQuery(
      internal.googleAuth.findExistingGoogleUser,
      { googleId: gPayload.sub, email: gPayload.email || null }
    );
    if (existing) {
      if (existing.isFrozen) throw new Error('AUTH_002: Account frozen');
      if (existing.deletionRequestedAt) throw new Error('AUTH_006: Account pending deletion');
      // Link googleId if matched by email only
      if (!existing.googleId) {
        await ctx.runMutation(internal.googleAuth.linkGoogleId,
          { userId: existing._id, googleId: gPayload.sub });
      }
      return { isNewUser: false, userId: existing._id };
    }
    return {
      isNewUser: true,
      pendingProfile: {
        email: gPayload.email || null,
        name: gPayload.name || 'Google User',
        googleId: gPayload.sub,
      },
    };
  },
});

// ── Internal query: find user by googleId OR email ──
export const findExistingGoogleUser = internalQuery({
  args: { googleId: v.string(), email: v.optional(v.string()) },
  handler: async (ctx, { googleId, email }) => {
    // First try googleId (most specific)
    const byGoogle = await ctx.db.query('users')
      .withIndex('by_googleId', q => q.eq('googleId', googleId))
      .unique();
    if (byGoogle) return byGoogle;
    // Then try email (existing email/password user signs in with Google)
    if (email) {
      const byEmail = await ctx.db.query('users')
        .withIndex('by_email', q => q.eq('email', email))
        .unique();
      if (byEmail) return byEmail;
    }
    return null;
  },
});

// ── Internal mutation: link googleId to existing account ──
export const linkGoogleId = internalMutation({
  args: { userId: v.id('users'), googleId: v.string() },
  handler: async (ctx, { userId, googleId }) => {
    await ctx.db.patch(userId, { googleId });
  },
});

// ── Step 4: Create user after consent + phone + age ──
export const completeGoogleRegistration = action({
  args: {
    googleId: v.string(),
    email: v.optional(v.string()),
    name: v.string(),
    phone: v.string(),
    age: v.number(),
    consentGiven: v.boolean(),
  },
  handler: async (ctx, args) => {
    if (!args.consentGiven) throw new Error('AUTH_005: Consent not given');
    if (args.age < 18) throw new Error('AUTH_007: Must be 18 or older');
    return await ctx.runMutation(internal.googleAuth.createGoogleUser, args);
  },
});

// ── Internal mutation: insert the verified user record ──
export const createGoogleUser = internalMutation({
  args: {
    googleId: v.string(), email: v.optional(v.string()),
    name: v.string(), phone: v.string(),
    age: v.number(), consentGiven: v.boolean(),
  },
  handler: async (ctx, args) => {
    if (!args.consentGiven) throw new Error('AUTH_005: Consent not given');
    // Duplicate phone check
    const existingPhone = await ctx.db.query('users')
      .withIndex('by_phone', q => q.eq('phone', args.phone))
      .first();
    if (existingPhone) {
      if (existingPhone.role === 'owner')
        throw new Error('OTP_006: Phone registered to owner');
      throw new Error('OTP_007: Phone already registered');
    }
    const userId = await ctx.db.insert('users', {
      name: args.name.trim(),
      email: args.email || undefined,
      phone: args.phone,
      googleId: args.googleId,
      age: args.age,
      role: 'customer',
      phoneVerified: true, // Already verified via OTP
      isFrozen: false,
      settingsPasscodeSet: false,
      complaints: [],
      fcmTokens: [],
      consentGiven: true,
      consentGivenAt: Date.now(),
      createdAt: Date.now(),
    });
    return { userId };
  },
});
```

### 3.3 Phone Verification (Duplicate Detection)

PRD §4.2 Step 2a — three cases:

```typescript
// packages/convex/model/authHelpers.ts
export async function checkPhoneDuplicate(ctx: MutationCtx, phone: string) {
  const existing = await ctx.db.query('users')
    .withIndex('by_phone', q => q.eq('phone', phone))
    .first();

  if (!existing) return { case: 'new_phone' as const };

  if (existing.role === 'owner')
    throw new Error(
      'OTP_006: This phone number is registered to a club owner account. ' +
      'Please use a different number or contact support.'
    );

  if (existing.role === 'customer')
    return {
      case: 'existing_customer' as const,
      userId: existing._id,
      // Client: discard in-progress registration,
      // verify ownership via OTP, redirect to login
    };

  return { case: 'new_phone' as const };
}
```

### 3.4 Admin MFA (Complete)

```typescript
// packages/convex/mfa.ts
export const generateMfaCode = action({
  args: { adminId: v.id('users') },
  handler: async (ctx, { adminId }) => {
    const { createHash, randomInt } = await import('crypto');
    const rawCode = randomInt(100000, 999999).toString();
    const codeHash = createHash('sha256').update(rawCode).digest('hex');
    const email = await ctx.runMutation(
      internal.mfa.storeMfaCode, { adminId, codeHash });
    await ctx.runAction(
      internal.notifications.sendMfaEmail, { email, code: rawCode });
    return { success: true };
  },
});

export const verifyMfaCode = action({
  args: { adminId: v.id('users'), code: v.string() },
  handler: async (ctx, { adminId, code }) => {
    const { createHash } = await import('crypto');
    const codeHash = createHash('sha256').update(code).digest('hex');
    return await ctx.runMutation(
      internal.mfa.checkMfaCode, { adminId, codeHash });
  },
});

export const storeMfaCode = internalMutation({
  args: { adminId: v.id('users'), codeHash: v.string() },
  handler: async (ctx, { adminId, codeHash }) => {
    const user = await ctx.db.get(adminId);
    if (!user || user.role !== 'admin') throw new Error('MFA_001: Not an admin');
    // Invalidate existing codes
    const existing = await ctx.db.query('adminMfaCodes')
      .withIndex('by_admin', q => q.eq('adminId', adminId))
      .filter(q => q.eq(q.field('used'), false)).collect();
    for (const c of existing) await ctx.db.patch(c._id, { used: true });
    await ctx.db.insert('adminMfaCodes', {
      adminId, codeHash, expiresAt: Date.now() + 600_000,
      used: false, createdAt: Date.now(),
    });
    return user.email;
  },
});

export const checkMfaCode = internalMutation({
  args: { adminId: v.id('users'), codeHash: v.string() },
  handler: async (ctx, { adminId, codeHash }) => {
    const record = await ctx.db.query('adminMfaCodes')
      .withIndex('by_admin', q => q.eq('adminId', adminId))
      .filter(q => q.and(
        q.eq(q.field('used'), false),
        q.eq(q.field('codeHash'), codeHash)))
      .first();
    if (!record) throw new Error('AUTH_003: MFA code invalid');
    if (Date.now() > record.expiresAt) {
      await ctx.db.patch(record._id, { used: true });
      throw new Error('AUTH_003: MFA code expired');
    }
    await ctx.db.patch(record._id, { used: true });
    return { verified: true };
  },
});
```

### 3.5 Password & Passcode Change Flows

Both flows live in Owner App Settings. Current session stays valid after change.

```typescript
// packages/convex/passwordReset.ts

// ── Change Account Password (inside Settings) ──
export const changePassword = action({
  args: { currentPassword: v.string(), newPassword: v.string() },
  handler: async (ctx, { currentPassword, newPassword }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error('AUTH_001: Not authenticated');
    // Verify current password via Convex Auth
    // Update password hash via Convex Auth
    // Active session remains valid (PRD 4.4)
    // Other sessions: unaffected (PRD as-is)
  },
});

// ── Forgot Password (email reset link) ──
export const requestPasswordReset = action({
  args: { email: v.string() },
  handler: async (ctx, { email }) => {
    const { createHash, randomBytes } = await import('crypto');
    // Rate limit: reset:{email} max 3 per hour
    const rawToken = randomBytes(32).toString('hex');
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');
    await ctx.runMutation(internal.passwordReset.storeResetToken, {
      email, tokenHash, type: 'accountPassword',
    });
    // Send email with link: a3billiards.com/reset?token={rawToken}
    await ctx.runAction(internal.notifications.sendPasswordResetEmail,
      { email, token: rawToken });
  },
});

export const redeemResetToken = action({
  args: { token: v.string(), newPassword: v.string() },
  handler: async (ctx, { token, newPassword }) => {
    const { createHash } = await import('crypto');
    const tokenHash = createHash('sha256').update(token).digest('hex');
    // Verify token: not used, not expired (1 hour), mark used
    await ctx.runMutation(internal.passwordReset.verifyAndConsumeToken,
      { tokenHash });
    // Update password via Convex Auth
  },
});

// packages/convex/passcode.ts

// ── Change Settings Passcode (inside Settings) ──
export const changePasscode = action({
  args: { currentPasscode: v.string(), newPasscode: v.string() },
  handler: async (ctx, { currentPasscode, newPasscode }) => {
    const bcrypt = await import('bcryptjs');
    const identity = await ctx.auth.getUserIdentity();
    // Look up user, verify currentPasscode against settingsPasscodeHash
    // Hash newPasscode with bcrypt (10 rounds)
    // Patch user: settingsPasscodeHash = newHash
    // Change is immediate (PRD 4.4)
  },
});

// ── Forgot Passcode (email reset link) ──
// Same flow as password reset but type = 'settingsPasscode'
// On token redemption: clears settingsPasscodeSet = false
// Owner forced through passcode setup on next login (PRD 4.4)

// ── First Login Passcode Setup ──
export const setupPasscode = action({
  args: { passcode: v.string() },
  handler: async (ctx, { passcode }) => {
    const bcrypt = await import('bcryptjs');
    const hash = await bcrypt.hash(passcode, 10);
    await ctx.runMutation(internal.passcode.saveInitialPasscode, { hash });
    // Sets settingsPasscodeHash and settingsPasscodeSet = true
  },
});
```

### 3.6 Hashing Strategy

| Credential | Algorithm | Notes | Storage |
|-----------|-----------|-------|---------|
| Login password | bcrypt (Convex Auth) | 10 rounds | Convex Auth internal |
| Settings passcode | bcrypt | 10 rounds, in action | `users.settingsPasscodeHash` |
| OTP codes | bcrypt | 10 rounds, in action | `otpRecords.otpHash` |
| Reset tokens | SHA-256 | 32-byte random, in action | `passwordResetTokens.tokenHash` |
| MFA codes | SHA-256 | 6-digit random, in action | `adminMfaCodes.codeHash` |
| Deletion tokens | SHA-256 | 32-byte random, in action | `users.deletionCancelToken` |

### 3.7 Rate Limiting

| Operation | Key | Max | Window | Type |
|-----------|-----|-----|--------|------|
| OTP dispatch | `otp:{phone}` | 5 | 1 hour | Sliding |
| OTP attempts | Per OTP record | 3 | Then 5-min cooldown | Per-instance |
| Admin broadcast | `broadcast:{adminId}` | 10 | 1 hour | Fixed (hour boundary) |
| Data export | `export:{userId}` | 1 | 24 hours | Sliding |
| Password reset | `reset:{email}` | 3 | 1 hour | Sliding |

### 3.8 Row-Level Security

```typescript
// packages/convex/rls.ts
import { wrapDatabaseReader, wrapDatabaseWriter }
  from 'convex-helpers/server/rowLevelSecurity';
import { customCtx, customQuery, customMutation }
  from 'convex-helpers/server/customFunctions';

async function getCurrentUser(ctx: QueryCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return null;
  return await userByTokenIdentifier(ctx, identity.tokenIdentifier);
}

async function rlsRules(ctx: QueryCtx) {
  const user = await getCurrentUser(ctx);
  return {
    users: {
      read: async () => !!user,
      modify: async (_, doc) =>
        user?.role === 'admin' || doc._id === user?._id,
    },
    sessions: {
      read: async () => !!user,
      modify: async () => !!user, // Club-scoped in mutation
    },
    bookings: {
      read: async () => !!user,
      modify: async () => !!user,
    },
    complaints: {
      read: async () => !!user,
      modify: async (_, doc) =>
        user?.role === 'admin' || doc.removedById === undefined,
    },
    // All other tables: authenticated = read, mutation checks write
  };
}

export const queryWithRLS = customQuery(query,
  customCtx(async (ctx) => ({
    db: wrapDatabaseReader(ctx, ctx.db, await rlsRules(ctx)),
  })));

export const mutationWithRLS = customMutation(mutation,
  customCtx(async (ctx) => ({
    db: wrapDatabaseWriter(ctx, ctx.db, await rlsRules(ctx)),
  })));
```

> **Important:** RLS is a safety net. Every mutation ALSO checks: role, `clubId` ownership, staff permissions, subscription status.

### 3.9 Table Lock Mechanism

```typescript
// On booking modal open (startSession mutation):
const lockToken = crypto.randomUUID();
await ctx.db.patch(tableId, {
  tableLock: lockToken,
  tableLockExpiry: Date.now() + 30_000, // 30s standard
});
// For new customer OTP flow: 3 minutes instead
await ctx.scheduler.runAfter(
  30_000, internal.slots.clearExpiredLock, { tableId, lockToken });

// Concurrent booking check (in startSession mutation):
if (table.currentSessionId !== null)
  throw new Error('SESSION_001: Table occupied');
if (table.tableLockExpiry && table.tableLockExpiry > Date.now())
  throw new Error('SESSION_002: Table locked');

// Cleanup (scheduled function):
export const clearExpiredLock = internalMutation({
  args: { tableId: v.id('tables'), lockToken: v.string() },
  handler: async (ctx, { tableId, lockToken }) => {
    const table = await ctx.db.get(tableId);
    // Only clear if lock token matches (not overwritten)
    if (table?.tableLock === lockToken) {
      await ctx.db.patch(tableId, {
        tableLock: undefined, tableLockExpiry: undefined,
      });
    }
  },
});
```

---

## 4. Data Architecture

### 4.0 PRD v23 Schema Deltas (6 changes applied on top of TDD v1.2)

- **DELTA 1** — `sessions` table: ADD `cancellationReason: v.optional(v.string())`. Used for admin force-end (value: `'admin_force_end'`, max 300 chars). Null for normal staff cancellations.
- **DELTA 2** — `sessionLogs` table: ADD `currency: v.optional(v.string())`. ISO 4217 denormalized at session creation. Optional for backward compatibility.
- **DELTA 3** — `clubs.location`: CHANGED from required `v.object({lat,lng})` to `v.optional(v.object({lat,lng}))`. Clubs without geocoding appear in name search only.
- **DELTA 4** — `sessionLogs` indexes: ADD `by_customer_club: ['customerId','clubId']` and `by_sessionId: ['sessionId']`.
- **DELTA 5** — `bookingLogs` indexes: ADD `by_customer_status: ['customerId','status']` and `by_bookingId: ['bookingId']`.
- **DELTA 6** — `paymentReceipts` indexes: ADD `by_owner: ['ownerId']`.

### 4.0.1 `slotDurationOptions` Default Change
PRD v23 changes default from `[30, 60, 90, 120, 180]` to `[30, 60, 90, 120]`. 180-minute option removed from default. Clubs can still add 180 via Settings.

### 4.0.2 `bookableHours` Within `operatingHours` Validation
PRD v23 §7.5: `bookableHours` must fall within `operatingHours`. Backend validates on save. If `bookableHours.open < operatingHours.open` or `bookableHours.close > operatingHours.close`, mutation rejects with: `'CLUB_004: Bookable hours must fall within operating hours.'`

### 4.1 Booking State Machine

| From | To | Trigger | Mutation |
|------|----|---------|----------|
| `pending_approval` | `confirmed` | Owner approves | `approveBooking` |
| `pending_approval` | `rejected` | Owner rejects | `rejectBooking` |
| `pending_approval` | `cancelled_by_customer` | Customer cancels | `cancelBooking` |
| `pending_approval` | `expired` | Approval deadline cron | `checkApprovalDeadlines` |
| `confirmed` | `cancelled_by_customer` | Customer cancels | `cancelBooking` |
| `confirmed` | `cancelled_by_club` | Owner cancels | `clubCancelBooking` |
| `confirmed` | `completed` | Staff starts session | `startSessionFromBooking` |
| `confirmed` | `expired` | No-show cron (30 min) | `detectNoShows` |

Every mutation verifies current status before applying the transition. Invalid transitions throw `BOOKING_006`.

### 4.2 Booking Submission Validation (11 checks, fail-fast)

1. Customer authenticated, `isFrozen === false`, `deletionRequestedAt === null`, `phoneVerified === true`
2. Club `bookingSettings.enabled === true` AND `subscriptionStatus !== 'frozen'`
3. `tableType` in `bookingSettings.bookableTableTypes`
4. `requestedDate` not past AND within `today + maxAdvanceDays` (club timezone)
5. `requestedStartTime` within `bookableHours.open/close` AND day in `bookableHours.daysOfWeek`
6. `now` to `requestedStart` >= `minAdvanceMinutes`
7. `requestedDurationMin` in `slotDurationOptions`
8. Customer active bookings at THIS club < 2 (status in `pending_approval`, `confirmed`)
9. Customer active bookings at < 2 DISTINCT clubs (`bookingLogs` query inside mutation for serialization)
10. At least 1 table of type available for full duration (revalidated inside mutation, not pre-check)
11. `estimatedCost` computed server-side: `max(duration, minBillMinutes) * applicableRate`

### 4.3 Availability Engine (`getAvailableSlots`)

Reactive Convex query. Generates 30-min increment slots. Zero gap between bookings.

```typescript
// packages/convex/bookings.ts
export const getAvailableSlots = query({
  args: {
    clubId: v.id('clubs'),
    tableType: v.string(),
    requestedDate: v.string(), // YYYY-MM-DD
    requestedDurationMin: v.number(),
  },
  handler: async (ctx, args) => {
    const club = await ctx.db.get(args.clubId);
    if (!club?.bookingSettings.bookableHours) return [];

    const { open, close } = club.bookingSettings.bookableHours;

    // Get all active tables of requested type
    const tables = await ctx.db.query('tables')
      .withIndex('by_club_type',
        q => q.eq('clubId', args.clubId)
              .eq('tableType', args.tableType.toLowerCase()))
      .filter(q => q.eq(q.field('isActive'), true))
      .collect();

    // Get all bookings for this club+date (pending + confirmed)
    const bookings = await ctx.db.query('bookings')
      .withIndex('by_club_date',
        q => q.eq('clubId', args.clubId)
              .eq('requestedDate', args.requestedDate))
      .filter(q => q.or(
        q.eq(q.field('status'), 'pending_approval'),
        q.eq(q.field('status'), 'confirmed')))
      .collect();

    // Generate all possible start times in 30-min increments
    const slots: string[] = [];
    const openMin = parseHHMM(open);
    const closeMin = parseHHMM(close);

    for (let startMin = openMin; startMin < closeMin; startMin += 30) {
      const endMin = startMin + args.requestedDurationMin;
      if (endMin > closeMin) continue; // Exceeds bookable hours

      // Check if ANY table of the type is available
      const hasAvailableTable = tables.some(table => {
        // Table with active walk-in: unavailable for ALL slots
        if (table.currentSessionId) return false;

        // Check overlapping bookings on this specific table
        const conflicting = bookings.some(b => {
          if (b.confirmedTableId && b.confirmedTableId !== table._id
              && b.status === 'confirmed') return false;
          // For pending bookings: block by tableType match
          // For confirmed: block by confirmedTableId match
          const bStart = parseHHMM(b.requestedStartTime);
          const bEnd = bStart + b.requestedDurationMin;
          // Overlap: NOT (endMin <= bStart || startMin >= bEnd)
          return !(endMin <= bStart || startMin >= bEnd);
        });

        return !conflicting;
      });

      if (hasAvailableTable) slots.push(formatHHMM(startMin));
    }

    return slots; // Real-time: updates pushed when bookings change
  },
});

function parseHHMM(s: string): number {
  const [h, m] = s.split(':').map(Number);
  return h * 60 + m;
}

function formatHHMM(min: number): string {
  return `${String(Math.floor(min/60)).padStart(2,'0')}:${String(min%60).padStart(2,'0')}`;
}
```

### 4.4 `startSessionFromBooking` (Complete)

Converts a confirmed booking to an active session. Hardcoded window: 15 min before to 30 min after booking start.

```typescript
// packages/convex/bookings.ts
export const startSessionFromBooking = mutation({
  args: {
    bookingId: v.id('bookings'),
    tableId: v.optional(v.id('tables')),
    roleId: v.optional(v.id('staffRoles')),
  },
  handler: async (ctx, { bookingId, tableId, roleId }) => {
    const booking = await ctx.db.get(bookingId);
    if (!booking || booking.status !== 'confirmed')
      throw new Error('BOOKING_006: Invalid state');

    // Time window check: 15 min before to 30 min after
    const club = await ctx.db.get(booking.clubId);
    const startUnix = computeBookingUnixTime(
      booking.requestedDate, booking.requestedStartTime, club.timezone);
    const now = Date.now();
    const earlyWindow = startUnix - 15 * 60_000;
    const lateWindow  = startUnix + 30 * 60_000;
    if (now < earlyWindow || now > lateWindow)
      throw new Error('BOOKING_011: Outside start window');

    // Pre-checks (PRD 7.8 Upcoming section)
    const customer = await ctx.db.get(booking.customerId);
    if (customer.isFrozen)          throw new Error('SESSION_003: Customer frozen');
    if (customer.deletionRequestedAt) throw new Error('SESSION_004: Customer deleted');

    // Resolve table
    let targetTableId = booking.confirmedTableId || tableId;
    if (!targetTableId) throw new Error('SESSION_006: No table assigned');

    const table = await ctx.db.get(targetTableId);
    if (!table?.isActive)       throw new Error('SESSION_005: Table inactive');
    if (table.currentSessionId) throw new Error('SESSION_001: Table occupied');

    // Complaint advisory (same as walk-in flow)
    const hasComplaints = customer.complaints.length > 0;
    // staffAcknowledgedComplaint set by client if staff proceeds

    // Staff role validation
    if (roleId) {
      const role = await ctx.db.get(roleId);
      if (role?.allowedTableIds && !role.allowedTableIds.includes(targetTableId))
        throw new Error('STAFF_002: Table outside allowed set');
    }

    // Determine rate (same logic as walk-in)
    const ratePerMin = getApplicableRate(
      now, club.specialRates, club.baseRatePerMin, club.timezone);

    // Create session
    const sessionId = await ctx.db.insert('sessions', {
      tableId: targetTableId, clubId: booking.clubId,
      customerId: booking.customerId,
      isGuest: false, startTime: now,
      ratePerMin, minBillMinutes: club.minBillMinutes,
      currency: club.currency, snackOrders: [],
      paymentStatus: 'pending', status: 'active',
      bookingId, createdAt: now, updatedAt: now,
    });

    // Update table
    await ctx.db.patch(targetTableId, { currentSessionId: sessionId });

    // Update booking
    await ctx.db.patch(bookingId, { status: 'completed', sessionId, updatedAt: now });

    // Update bookingLogs (atomic, same transaction)
    const log = await ctx.db.query('bookingLogs')
      .filter(q => q.eq(q.field('bookingId'), bookingId)).first();
    if (log) await ctx.db.patch(log._id, { status: 'completed', updatedAt: now });

    // Create sessionLog (central DB)
    await ctx.db.insert('sessionLogs', {
      sessionId, customerId: booking.customerId,
      clubId: booking.clubId, clubName: club.name,
      tableLabel: table.label, startTime: now,
      paymentStatus: 'pending', status: 'active',
      createdAt: now, updatedAt: now,
    });

    return { sessionId, hasComplaints };
  },
});
```

### 4.5 Billing Formula

```
actualMinutes   = ceil((endTime - startTime) / 60000)
billableMinutes = max(actualMinutes, session.minBillMinutes)
tableSubtotal   = billableMinutes * session.ratePerMin
discountedTable = tableSubtotal * (1 - discount% / 100)
snackTotal      = sum(snackPrice * qty)   // Never discounted
FINAL_BILL      = discountedTable + snackTotal
```

> Rate locked at session start. `minBillMinutes` locked at session start. Mid-session club setting changes do not affect in-progress sessions.

### 4.6 Subscription Renewal Formula

```
newExpiresAt = max(currentSubscriptionExpiresAt, now) + purchasedPeriod

// Early renewal from active:  preserves unused time
// Grace/frozen renewal:        max() = now (expiresAt is past)
// Paused sessions resume from original startTime on renewal
```

---

## 5. Infrastructure & CI/CD

### 5.1 GitHub Actions CI

```yaml
# .github/workflows/ci.yml
name: CI
on: [pull_request]
jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - run: pnpm install --frozen-lockfile
      - run: pnpm turbo lint typecheck test --filter=...[HEAD~1]
```

### 5.2 Convex HTTP Routes

```typescript
// packages/convex/http.ts
import { httpRouter } from 'convex/server';
import { httpAction } from './_generated/server';
import { internal } from './_generated/api';

const http = httpRouter();

// WhatsApp: hub challenge verification
http.route({ path: '/whatsapp/webhook', method: 'GET',
  handler: httpAction(async (_, req) => {
    const url = new URL(req.url);
    if (url.searchParams.get('hub.mode') === 'subscribe' &&
        url.searchParams.get('hub.verify_token') === process.env.WHATSAPP_VERIFY_TOKEN)
      return new Response(url.searchParams.get('hub.challenge'));
    return new Response('Forbidden', { status: 403 });
  }),
});

// WhatsApp: incoming message status updates
http.route({ path: '/whatsapp/webhook', method: 'POST',
  handler: httpAction(async (ctx, req) => {
    const body = await req.json();
    // Process delivery status updates if needed
    return new Response('OK');
  }),
});

// Razorpay: payment webhook (idempotent)
http.route({ path: '/razorpay/webhook', method: 'POST',
  handler: httpAction(async (ctx, req) => {
    const rawBody = await req.text();
    const sig = req.headers.get('x-razorpay-signature') || '';
    // Verify HMAC-SHA256 in action (needs crypto)
    await ctx.runAction(internal.paymentReceipts.handleWebhook,
      { rawBody, signature: sig });
    return new Response('OK');
  }),
});

export default http;
```

---

## 6. Integrations

### 6.1 FCM HTTP v1 (with OAuth2)

```typescript
// packages/convex/notifications.ts
import { action, internalMutation } from './_generated/server';
import { internal } from './_generated/api';
import { v } from 'convex/values';

async function getFcmAccessToken(): Promise<string> {
  const { GoogleAuth } = await import('google-auth-library');
  const auth = new GoogleAuth({
    credentials: JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON!),
    scopes: ['https://www.googleapis.com/auth/firebase.messaging'],
  });
  const client = await auth.getClient();
  const { token } = await client.getAccessToken();
  return token!;
}

export const sendFcmNotification = action({
  args: {
    tokens: v.array(v.string()),
    title: v.string(),
    body: v.string(),
    data: v.optional(v.any()),
  },
  handler: async (ctx, { tokens, title, body, data }) => {
    const accessToken = await getFcmAccessToken();
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const results: Record<string, string> = {};

    for (const token of tokens) {
      try {
        const res = await fetch(
          `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              message: { token, notification: { title, body }, data },
            }),
          }
        );
        if (res.ok) {
          results[token] = 'sent';
        } else {
          results[token] = 'failed';
          const err = await res.json();
          if (err.error?.details?.some(
            (d: any) => d.errorCode === 'UNREGISTERED')) {
            await ctx.runMutation(
              internal.users.removeStaleToken, { token });
          }
        }
      } catch { results[token] = 'failed'; }
    }

    return results;
  },
});
```

### 6.2 FCM Notification Payloads (Complete)

| Trigger | Recipient | Title | Deep Link Data |
|---------|-----------|-------|---------------|
| Booking approved | Customer | Booking Confirmed | `{ deepLink: 'a3customer://booking/{id}' }` |
| Booking rejected | Customer | Booking Declined | `{ deepLink: 'a3customer://booking/{id}' }` |
| Booking cancelled by club | Customer | Booking Cancelled | `{ deepLink: 'a3customer://booking/{id}' }` |
| Booking expired (no response) | Customer | Booking Expired | `{ deepLink: 'a3customer://booking/{id}' }` |
| No-show (normal) | Customer | Booking Expired | `{ deepLink: 'a3customer://booking/{id}' }` |
| No-show (frozen club) | Customer | Booking Could Not Be Honoured | `{ deepLink: 'a3customer://booking/{id}' }` |
| 1-hour reminder | Customer | Booking Reminder | `{ deepLink: 'a3customer://booking/{id}' }` |
| 1-hour reminder | Owner | Upcoming Booking | `{ screen: 'bookings', tab: 'upcoming' }` |
| New booking request | Owner | New Booking Request | `{ screen: 'bookings', tab: 'pending' }` |
| Customer cancels | Owner | Booking Cancelled | `{ screen: 'bookings', tab: 'history' }` |
| No-show detected | Owner | Customer No-Show | `{ screen: 'bookings', tab: 'history' }` |
| Approval deadline 50% | Owner | Booking Needs Response | `{ screen: 'bookings', tab: 'pending' }` |
| Customer deletion cancels bookings | Owner | Booking Auto-Cancelled | `{ screen: 'bookings', tab: 'history' }` |
| Session timer alert | Owner | Table Alert | `{ screen: 'slots' }` |
| Admin broadcast | Selected | Custom title | `{ type: 'admin_broadcast' }` |

### 6.3 Razorpay Webhook (Idempotent)

```typescript
// packages/convex/paymentReceipts.ts
export const handleWebhook = action({
  args: { rawBody: v.string(), signature: v.string() },
  handler: async (ctx, { rawBody, signature }) => {
    const crypto = await import('crypto');
    const expected = crypto.createHmac('sha256',
      process.env.RAZORPAY_WEBHOOK_SECRET!)
      .update(rawBody).digest('hex');
    if (expected !== signature)
      throw new Error('PAYMENT_001: Invalid signature');

    const event = JSON.parse(rawBody);
    const paymentId = event.payload.payment.entity.id;
    const ownerId   = event.payload.payment.entity.notes.ownerId;
    const amount    = event.payload.payment.entity.amount;
    const period    = event.payload.payment.entity.notes.periodMs;

    await ctx.runMutation(internal.paymentReceipts.processPayment, {
      paymentId, ownerId, amount, periodMs: Number(period),
    });
  },
});

export const processPayment = internalMutation({
  args: { paymentId: v.string(), ownerId: v.string(),
          amount: v.number(), periodMs: v.number() },
  handler: async (ctx, { paymentId, ownerId, amount, periodMs }) => {
    // Idempotency check
    const existing = await ctx.db.query('paymentReceipts')
      .withIndex('by_paymentId', q => q.eq('paymentId', paymentId))
      .first();
    if (existing) return; // Already processed

    const club = await ctx.db.query('clubs')
      .withIndex('by_owner', q => q.eq('ownerId', ownerId as any))
      .first();
    if (!club) throw new Error('PAYMENT_002: Club not found');

    // Insert receipt
    await ctx.db.insert('paymentReceipts', {
      paymentId, ownerId: ownerId as any,
      clubId: club._id, amountPaid: amount,
      processedAt: Date.now(),
    });

    // Update subscription: max(current, now) + period
    const newExpiry = Math.max(club.subscriptionExpiresAt, Date.now()) + periodMs;
    await ctx.db.patch(club._id, {
      subscriptionStatus: 'active',
      subscriptionExpiresAt: newExpiry,
    });
  },
});
```

### 6.4 WhatsApp OTP Dispatch

```typescript
// packages/convex/model/otp.ts (called from action)
export async function dispatchWhatsAppOtp(phone: string, code: string) {
  const res = await fetch(
    `https://graph.facebook.com/v19.0/${process.env.WHATSAPP_PHONE_ID}/messages`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.WHATSAPP_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp', to: phone,
        type: 'template',
        template: {
          name: 'otp_verification',
          language: { code: 'en' },
          components: [{ type: 'body',
            parameters: [{ type: 'text', text: code }] }],
        },
      }),
    }
  );
  if (!res.ok) throw new Error('OTP_004: WhatsApp API error');
}
```

---

## 7. Cron Jobs

```typescript
// packages/convex/crons.ts
import { cronJobs } from 'convex/server';
import { internal } from './_generated/api';

const crons = cronJobs();

crons.daily('subscriptionCheck',  { hourUTC: 0, minuteUTC: 0 },
  internal.subscriptions.checkExpiry);

crons.interval('approvalDeadline', { minutes: 5 },
  internal.bookings.checkApprovalDeadlines);

crons.interval('noShowDetection',  { minutes: 10 },
  internal.bookings.detectNoShows);

crons.interval('bookingReminder',  { minutes: 5 },
  internal.bookings.sendReminders);

crons.daily('fcmCleanup',    { hourUTC: 3, minuteUTC: 0 },
  internal.notifications.cleanupStaleTokens);

crons.daily('deletionPurge', { hourUTC: 2, minuteUTC: 0 },
  internal.deletion.purgeSoftDeleted);

crons.daily('sessionArchiver', { hourUTC: 4, minuteUTC: 0 },
  internal.sessions.archiveIfFirstOfMonth);

export default crons;
```

**Special handling notes:**
- **No-show cron:** When `club.subscriptionStatus === 'frozen'`, customer notification changes to `'Your booking could not be honoured. The club is currently unavailable.'` Owner notification suppressed.
- **Session archiver:** Checks `day-of-month === 1` inside handler (no `.monthly()` in Convex API).

### 7B. PRD v23 New Feature Implementations

#### 7B.1 Admin Force-End Stuck Session

```typescript
// packages/convex/sessions.ts
export const forceEndSession = mutation({
  args: { sessionId: v.id('sessions'), reason: v.string() },
  handler: async (ctx, { sessionId, reason }) => {
    // Verify caller is admin
    // Mark session: status='cancelled', cancellationReason='admin_force_end'
    // Clear table.currentSessionId
    // No bill generated
    // Log to adminAuditLog: action='session_force_end'
    // Update sessionLogs in central DB
  },
});
```

#### 7B.2 Walk-In Conflict Warning
PRD v23 §7.2: When staff starts a walk-in on a table with a confirmed booking within the next 60 minutes, an advisory dialog appears. Staff can proceed or pick a different table. Physical operations always take priority. Implemented as a pre-check query in `startSession` that returns `{ hasUpcomingBooking: true, bookingTime: 'HH:MM' }` alongside the session creation result.

#### 7B.3 Table Grid Booking Indicators
PRD v23 §7.2: Each table card shows a `'Booked [time]'` tag when a confirmed booking exists within the next 2 hours. Powered by a reactive Convex query joining tables with `bookings.by_club_date` filtered to today's date and `status='confirmed'`.

#### 7B.4 Owner Home Booking Summary
PRD v23 §7.1: Owner Home shows today's booking summary when `bookingSettings.enabled` is true — count of pending, confirmed, and completed bookings. Three reactive queries scoped to the club.

#### 7B.5 Stale Slot Warning (5-min Timer)
PRD v23 §8.4 Step 4a: If the customer has been on the time selection step for > 5 minutes without submitting, a soft banner appears: `'Availability updates in real time — re-check your selection before submitting.'` Client-side `setTimeout(300000)`. Banner disappears when the customer taps a time slot.

#### 7B.6 Booking Detail Club Tombstone
PRD v23 §8.5: When a club has been deleted and `getClubProfile` returns null, the booking detail screen falls back to denormalized values from `bookingLogs` (`clubName`, `clubAddress`, `thumbnailPhotoId`) and shows: `'This club is no longer on A3 Billiards OS.'` Booking data remains fully readable.

#### 7B.7 Google Sign-In Password Change Hidden
PRD v23 §8.7: The change-password option is hidden entirely for Google Sign-In accounts. If user navigates directly (e.g. deep link), redirect to Profile with message: `'Your account uses Google Sign-In. Password management is handled by Google.'`

#### 7B.8 Admin Promote Mutation Validation

| Transition | Outcome |
|-----------|---------|
| `owner → admin` | Allowed. `settingsPasscodeSet` unchanged. |
| `customer → owner` | REJECTED: `'PROMOTE_001: Customers cannot be promoted. Register via Onboarding Website.'` |
| `customer → admin` | REJECTED: Same message. |
| `admin → admin` | REJECTED: `'PROMOTE_002: User is already an admin.'` |

#### 7B.9 PRD v23 Edge Cases

- **Active session at club + booking at same club:** ALLOWED. `submitBooking` does not check active sessions. Booking is for a future time slot.
- **Customer restores account after deletion:** Auto-cancelled bookings NOT restored. Customer must submit new requests.
- **Data export + account deleted:** Export job checks `deletionRequestedAt`. If set and email exists, export still sent. If no email, silently cancelled.
- **Legacy accounts (pre-`consentGiven` field):** Default `consentGiven=true` in schema. Not re-prompted.
- **Max active bookings checked at SUBMISSION only**, not at approval or session start. Already-approved bookings proceed normally.
- **Booking converted to session then session cancelled:** Booking stays `'completed'` — not reverted.
- **Club removes table type from `bookableTableTypes`:** Existing pending bookings NOT auto-cancelled. Owner can approve/reject manually.
- **Admin dashboard metric (PRD v23 §6.1):** Total pending bookings across all clubs added.
- **`bookableHours` validation (CLUB_004):** If `bookableHours` extends beyond `operatingHours`, mutation is rejected.

---

## 8. Error Handling

### 8.1 Error Code Registry

| Code | Message | Context |
|------|---------|---------|
| `AUTH_001` | Invalid credentials | Login |
| `AUTH_002` | Account frozen | Any login |
| `AUTH_003` | MFA expired/invalid | Admin |
| `AUTH_004` | Phone not verified | Customer |
| `AUTH_005` | Consent not given | Registration |
| `AUTH_006` | Account pending deletion | Login |
| `AUTH_007` | Must be 18 or older | Registration |
| `GOOGLE_AUTH_001` | Audience mismatch / invalid token | Google Sign-In |
| `BOOKING_001` | Max active bookings at club (2) | `submitBooking` |
| `BOOKING_002` | Max booking clubs (2) | `submitBooking` |
| `BOOKING_003` | Slot unavailable | `submitBooking` |
| `BOOKING_004` | Club not accepting bookings | `submitBooking` |
| `BOOKING_005` | Daily cancel limit (3) | `cancelBooking` |
| `BOOKING_006` | Invalid state transition | Booking mutations |
| `BOOKING_007` | Already cancelled | `cancelBooking` |
| `BOOKING_008` | Outside bookable hours | `submitBooking` |
| `BOOKING_009` | Table type not bookable | `submitBooking` |
| `BOOKING_010` | Min advance time not met | `submitBooking` |
| `BOOKING_011` | Outside start window | `startSessionFromBooking` |
| `SESSION_001` | Table occupied | `startSession` |
| `SESSION_002` | Table locked | `startSession` |
| `SESSION_003` | Customer frozen | `startSessionFromBooking` |
| `SESSION_004` | Customer deleted | `startSessionFromBooking` |
| `SESSION_005` | Table inactive | `startSessionFromBooking` |
| `SESSION_006` | No table assigned | `startSessionFromBooking` |
| `OTP_001` | Max attempts (cooldown) | `verifyOtp` |
| `OTP_002` | OTP expired | `verifyOtp` |
| `OTP_003` | Dispatch limit (5/hr) | `sendOtp` |
| `OTP_004` | WhatsApp API error | `sendOtp` |
| `OTP_005` | Invalid E.164 | Phone entry |
| `OTP_006` | Phone is owner account | Registration |
| `OTP_007` | Existing customer phone | Registration |
| `RATE_001` | Rate limit exceeded | Generic |
| `SUB_001` | Subscription frozen | Owner App |
| `DELETE_001` | Active sessions (owner only) | Owner deletion |
| `DELETE_002` | Outstanding credits (owner only) | Owner deletion |
| `DELETE_003` | Confirmed bookings (owner only) | Owner deletion |
| `CLUB_001` | Overlapping special rates | Settings |
| `CLUB_002` | Booking preconditions unmet | Settings |
| `CLUB_003` | Email already registered | Onboarding |
| `CLUB_004` | Bookable hours outside operating hours | Settings save |
| `STAFF_001` | Empty `allowedTabs` | Role creation |
| `STAFF_002` | Table outside allowed set | Approval |
| `MFA_001` | Not admin | MFA generation |
| `PAYMENT_001` | Invalid webhook signature | Razorpay |
| `PAYMENT_002` | Club not found for owner | Razorpay |
| `PROMOTE_001` | Customers cannot be promoted | Admin promote |
| `PROMOTE_002` | User is already an admin | Admin promote |
| `FORCE_001` | Session not found or not active | Admin force-end |

### 8.2 Client-Side Error Architecture

```typescript
// packages/utils/errors/errorCodes.ts
export interface AppError {
  code: string;
  message: string;
  retryable: boolean;
  retryAfterMs?: number;
}

export function parseConvexError(error: Error): AppError {
  const match = error.message.match(/^([A-Z_]+_\d{3}): (.+)/);
  if (!match) return { code: 'UNKNOWN', message: error.message, retryable: false };
  const [, code, message] = match;
  const retryable = ['RATE_001', 'BOOKING_003', 'SESSION_002'].includes(code);
  return { code, message, retryable };
}
```

**Error boundary architecture (all three apps):**
- **Global** — wraps entire app
- **Per-Tab** — wraps each bottom tab (`TabErrorBoundary`)
- **Offline** — `NetworkGuard` component blocks all screens with retry button (not an error boundary)

---

## 9. Design System

### 9.1 Colors (WCAG 2.1 AA Verified)

| Token | Hex | Contrast Ratio | Usage |
|-------|-----|---------------|-------|
| `bg.primary` | `#0D1117` | — | Main background |
| `bg.secondary` | `#161B22` | — | Cards |
| `bg.tertiary` | `#21262D` | — | Inputs |
| `text.primary` | `#F0F6FC` | 17.4:1 | Primary text |
| `text.secondary` | `#8B949E` | 6.2:1 | Secondary text |
| `text.tertiary` | `#7D8590` | 5.1:1 | Placeholders |
| `accent.green` | `#43A047` | 5.7:1 | Free tables, success |
| `accent.emerald` | `#1B5E20` | 3.7:1 | Large text/icons only |
| `accent.amber` | `#F57F17` | 7.2:1 | Pending, warnings |
| `accent.amberLight` | `#FFC107` | 11.6:1 | Badges |
| `status.error` | `#F44336` | 5.1:1 | Errors, occupied |
| `status.info` | `#2196F3` | 6.1:1 | Booking indicators |
| `status.disabled` | `#484F58` | 2.8:1 | Disabled (always + text label) |

### 9.2 Deep Linking

- URL schemes: `a3admin://`, `a3owner://`, `a3customer://`
- Universal links: `links.a3billiards.com/{app}/*`
- Cold start: `getInitialNotification()` parses `data.deepLink`

### 9.3 Offline Handling
- `NetworkGuard` component blocks all screens with a retry button
- No silent failures during session or booking management

### 9.4 Accessibility
- Touch targets: 44×44 pt minimum
- Screen reader: `accessibilityLabel` on all primary flows
- OTP inputs: `keyboardType='number-pad'`, `textContentType='oneTimeCode'` (iOS), `autoComplete='sms-otp'` (Android)
- Status indicators: always text + color (never color alone)

---

## 10. Testing

### 10.1 Test Coverage Targets

| Layer | Tool | Coverage |
|-------|------|----------|
| Unit | Vitest | 100% critical path |
| Integration | Vitest + Convex helpers | 80% overall |
| E2E | Maestro | All P0 flows |
| Component | Vitest + RN Testing Library | 80% shared UI |

### 10.2 Critical Path (100% Coverage Required)

- **Billing:** all combos of minutes, minBill, discount, snacks, special rates
- **`submitBooking`:** all 11 validations + race conditions
- **`getAvailableSlots`:** overlapping, walk-ins, pending blocking, back-to-back, midnight
- **Booking state machine:** 8 valid transitions + all invalid transitions
- **`startSessionFromBooking`:** window check, frozen customer, deleted customer, inactive table
- **Rate limiting:** window reset, concurrent, boundary, fixed vs sliding
- **Session lifecycle:** start, end, cancel, rate lock, snack cutoff, credit resolution
- **OTP:** generation, verify, cooldown, rate limit, expiry, duplicate phone (3 cases)
- **Subscription:** active → grace → frozen, renewal formula, paused sessions
- **Deletion:** owner 3 prerequisites, customer auto-cancel, 30-day purge, cancel link
- **Google auth:** new user consent flow, existing user link, frozen/deleted checks

### 10.3 Load Testing Targets

| Scenario | Load | Pass Criteria |
|----------|------|--------------|
| Bookings | 500 concurrent, 50 clubs | < 1s, zero race conditions |
| Discovery | 1000 location searches | < 500ms |
| Broadcast | 100K recipients | < 10min total |
| Sessions | 100 concurrent ops | < 500ms grid |
| Availability | 200 subscriptions | < 500ms updates |

---

## 11. Compliance (DPDP Act 2023)

| Requirement | Implementation |
|------------|----------------|
| **Consent** | Explicit checkbox on all registration flows. Server rejects `consentGiven !== true` on `createUser` mutation. |
| **Portability** | JSON export to email within 72 hours. Rate-limited to 1 request per 24 hours per user. |
| **Erasure** | 30-day soft delete with cancellable email link. Complaints retained 90 days post-deletion. |
| **Minimization** | No card data stored. Bills record-only. |
| **Audit** | `consentGiven` + `consentGivenAt` on `users`. All sensitive admin actions in `adminAuditLog`. |
| **Policy pages** | `a3billiards.com/privacy`, `a3billiards.com/terms`, `a3billiards.com/dpdp` |

---

## 12. Appendix

### 12.1 Version History

| Version | Changes |
|---------|---------|
| 1.0 | Initial TDD with schema, auth, and placeholder sections |
| 1.1 | 7 missing table schemas, crypto to actions, Google JWKS, RLS fix, 18 error codes |
| 1.2 | Consent violation fix, full inline schemas, `crons.monthly` fix, FCM OAuth2, booking state machine, validation sequence, table lock, phone duplicate detection, subscription formula |
| 1.3 | Complete code: `findExistingGoogleUser`, `createGoogleUser`, `getAvailableSlots`, `startSessionFromBooking`, `verifyMfaCode`, password/passcode flows, FCM payloads (15 types), Razorpay `processPayment` |
| 1.4 | PRD v23 alignment (22 deltas): `sessions.cancellationReason`, `sessionLogs.currency`, `clubs.location` optional, 3 new indexes, admin `forceEndSession`, walk-in conflict warning, table booking indicators, owner home booking summary, stale slot warning, club tombstone, Google pw hidden, promote validation, `bookableHours` within `operatingHours`, `slotDurationOptions` default `[30,60,90,120]`, 9 new edge cases, 4 new error codes |

---

*End of Document — TDD v1.4, PRD v23 aligned.*
