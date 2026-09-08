# A3 Billiards OS — Release Checklist, Store Manual & Future Feature Playbook

**Last updated:** July 2026  
**Who this is for:** Developers, QA testers, and anyone preparing Play Store / App Store releases.

**How to mark tests:** ✅ Pass · ❌ Fail (write what happened) · ⚠️ Partial (write the issue)

---

## Table of contents

1. [Before you test anything](#1-before-you-test-anything)
2. [Onboarding website checklist](#2-onboarding-website-checklist)
3. [Owner app checklist](#3-owner-app-checklist)
4. [Customer app checklist](#5-customer-app-checklist)
5. [Admin app checklist](#6-admin-app-checklist)
6. [Cross-app integration tests](#7-cross-app-integration-tests)
7. [Play Store upload manual (Android)](#8-play-store-upload-manual-android)
8. [App Store upload manual (iOS)](#9-app-store-upload-manual-ios)
9. [When you add a new feature later](#10-when-you-add-a-new-feature-later)
10. [Environment variables reference](#11-environment-variables-reference)
11. [Known gaps & roadmap](#12-known-gaps--roadmap)

---

## 1. Before you test anything

### 1.1 Build fresh APKs (all 3 mobile apps)

Preview APKs are built from `C:\a3billiards` (short-path mirror), **not** directly from the desktop workspace.

```powershell
# From workspace root: C:\Users\ibrah\Desktop\A3 Main\a3-billiards-os
pnpm sync:build-folder

# If you changed packages/i18n locale TS files:
pnpm --filter @a3/i18n run build:locales

# If you changed packages/convex:
cd packages/convex
npx convex dev --once
cd ../..

# Build all 3 preview APKs (~15–20 min each):
pnpm build:preview-apks
```

**Output APKs:**

| App | File |
|-----|------|
| Customer | `dist/preview-apks/customer-preview.apk` |
| Owner | `dist/preview-apks/owner-preview.apk` |
| Admin | `dist/preview-apks/admin-preview.apk` |

**Install:** Uninstall old versions first, then install fresh APKs on test devices.

### 1.2 Test accounts you need

| Role | What to prepare |
|------|-----------------|
| New club owner | Fresh email for onboarding website |
| Active owner | Owner with active subscription + passcode set |
| Frozen owner | Owner whose subscription was ended (admin or expiry) |
| Staff | Owner device + staff passcode + role configured |
| Customer | Phone number that receives WhatsApp OTP |
| Frozen customer | Customer frozen by admin |
| Admin | Email + password + MFA access |

### 1.3 Backend services that must be live

| Service | Used for |
|---------|----------|
| Convex (`ardent-albatross-880` for preview) | All data, auth, APIs |
| Razorpay | Owner subscription + customer booking payments |
| WhatsApp Business API | OTP for customers + desk registration |
| Resend | Emails (welcome, MFA, password reset, deletion) |
| Firebase FCM | Push notifications |
| AWS IVS | Live streaming |
| Google OAuth | Owner Google Sign-In |
| Google Maps Geocoding | Onboarding address → coordinates |

### 1.4 Play Store readiness (legal & support)

| Item | URL / value |
|------|-------------|
| Privacy policy | `https://register.a3billiards.com/privacy` |
| Terms of service | `https://register.a3billiards.com/terms` |
| DPDP compliance | `https://register.a3billiards.com/dpdp` |
| Support email | `support@a3billiards.com` |
| Account deletion | In-app request + email cancel link |
| Data export | In-app (customer + owner profile/settings) |

---

## 2. Onboarding website checklist

**URL:** `https://register.a3billiards.com` (production)  
**Stack:** React + Vite, hosted separately from mobile apps.

### 2.1 Public pages

| # | Test | Expected |
|---|------|----------|
| W1 | Open `/` landing | Marketing page loads |
| W2 | Open `/privacy` | Privacy policy readable |
| W3 | Open `/terms` | Terms readable |
| W4 | Open `/dpdp` | DPDP page readable |

### 2.2 Club registration (`/register`)

| # | Test | Expected |
|---|------|----------|
| W5 | Step 1: owner account | Email + strong password; weak password rejected |
| W6 | Step 2: club details | Name, address, map pin, rates, tables, hours, timezone |
| W7 | Step 3: subscription plan | Monthly/yearly selection |
| W8 | Step 4: Razorpay payment | Payment succeeds → club **active** |
| W9 | After payment | Welcome email; owner can log into Owner app |
| W10 | Email verification (`/verify-email`) | 6-digit code works |

### 2.3 Login & account recovery

| # | Test | Expected |
|---|------|----------|
| W11 | `/login` with correct credentials | Dashboard or renew redirect |
| W12 | `/forgot-password` | Reset email arrives |
| W13 | `/reset-password` with valid token | New password works |
| W14 | Expired/used reset link | Clear error; can request new link |
| W15 | `/dashboard` | Post-login portal loads |
| W16 | `/dashboard/invoice/:id` | Invoice/receipt detail |

### 2.4 Subscription lifecycle

| # | Test | Expected |
|---|------|----------|
| W17 | `/renew` when club in grace/frozen | Razorpay renew restores **active** |
| W18 | Coupon / free-access path on renew | Works if configured |
| W19 | After renew | Owner app unfreezes |

### 2.5 Account deletion

| # | Test | Expected |
|---|------|----------|
| W20 | Owner requests deletion from app | Email with cancel link |
| W21 | Click cancel within 30 days (`/deletion-cancelled`) | Account restored |

---

## 3. Owner app checklist

**Package:** `com.a3billiards.ownerapp`  
**Tabs:** Home · Slots · Snacks · Kitchen · Live · Financials · Bookings · Complaints · Documents · Settings

### 3.1 Login & security

| # | Test | Expected |
|---|------|----------|
| O1 | Open app | Login screen + language picker |
| O2 | Wrong email/password | Clear error, stay on login |
| O3 | Google Sign-In | Account picker → logged in |
| O4 | Correct email/password login | Passcode setup (first time) or home |
| O5 | Set 6-digit settings passcode | Confirmed; required for Settings |
| O6 | Staff enters passcode → selects role | Only allowed tabs visible |
| O7 | Wrong passcode on settings | "Invalid passcode" error |
| O8 | Change language | UI updates across tabs |
| O9 | Frozen subscription | Full-screen renew message (links to website) |
| O10 | Grace period | Banner with renew link |
| O11 | Change password (`/change-password`) | Old password fails |
| O12 | Change passcode (`/change-passcode`) | Old passcode fails |
| O13 | Reset credential (`/reset-credential`) | Forgot passcode/password flow |
| O14 | Verify phone (`/verify-phone`) | OTP flow if required |

### 3.2 Home & navigation

| # | Test | Expected |
|---|------|----------|
| O15 | Home screen | Club name, revenue, active tables, bookings summary |
| O16 | Notification bell | Inbox opens |
| O17 | Quick tiles | Navigate to Slots, Bookings, Financials, Complaints |
| O18 | Pull to refresh | Data updates |
| O19 | All tabs open without crash | Home, Slots, Snacks, Kitchen, Live, Financials, Bookings, Complaints, Documents, Settings |

### 3.3 Slots — floor operations (highest priority)

| # | Test | Expected |
|---|------|----------|
| O20 | Table grid | Free vs occupied vs disabled; floor/type filters |
| O21 | Start: Guest | Session starts, timer runs |
| O22 | Start: Registered customer (search) | Correct customer; session starts |
| O23 | Start: Register at desk + WhatsApp OTP | New customer created; session starts |
| O24 | Start: Group casual | Players listed; shared billing |
| O25 | Start: Group versus | Side A vs Side B; losers-pay toggle |
| O26 | Scan customer QR | Customer identified; session starts |
| O27 | Frozen customer | **Blocked** with clear error |
| O28 | Pending-deletion customer | **Blocked** with clear error |
| O29 | Add snacks during session | Bill updates |
| O30 | Switch table | Session moves; no stuck lock |
| O31 | End session early | Table frees correctly |
| O32 | Checkout: time + snacks | Bill correct |
| O33 | Checkout: discount (role-limited) | Discount applied correctly |
| O34 | Payment: Cash | Checkout completes; table free |
| O35 | Payment: UPI | Checkout completes |
| O36 | Payment: Credit | Credit balance saved; table free |
| O37 | After checkout | Revenue reflects in Financials |
| O38 | Table lock (30s / 3min OTP) | Lock expires correctly |

### 3.4 Bookings

| # | Test | Expected |
|---|------|----------|
| O39 | Pending bookings list | Customer, time, table type shown |
| O40 | Approve booking | Customer notified (FCM + inbox) |
| O41 | Reject booking | Customer notified; status updates |
| O42 | Start session from approved booking | Table occupied; linked to customer |
| O43 | Cancel booking | Status updates |
| O44 | Booking expiry / no-show (cron) | Auto-handled after deadline |

### 3.5 Snacks & kitchen

| # | Test | Expected |
|---|------|----------|
| O45 | Snacks tab: add/edit item | Menu updates |
| O46 | Toggle snack availability | Unavailable items hidden at checkout |
| O47 | Kitchen tab: pending orders | Orders from active sessions appear |
| O48 | Kitchen: pending → preparing → ready | Status flow works |

### 3.6 Live stream

| # | Test | Expected |
|---|------|----------|
| O49 | Start live (quality 480/720/1080) | Labels show human text (not i18n keys) |
| O50 | Stream goes live | Customer/Admin can watch |
| O51 | Viewer count updates | Roughly matches watchers |
| O52 | Stop stream | Ends for all viewers |
| O53 | Admin force-ends while live | Stream stops; owner notified |
| O54 | Subscription ended while live | Stream stops (no zombie broadcast) |

### 3.7 Financials & GST

| # | Test | Expected |
|---|------|----------|
| O55 | Financials: date range | Revenue charts update |
| O56 | Payment breakdown | Cash / UPI / Card / Credit amounts |
| O57 | GST report (from Financials) | Report generates for date range |

### 3.8 Documents

| # | Test | Expected |
|---|------|----------|
| O58 | Upload document | Stored and listed |
| O59 | View/download document | File accessible |
| O60 | Unsupported file type | Graceful error |

### 3.9 Complaints

| # | Test | Expected |
|---|------|----------|
| O61 | File complaint on customer | 4 types available |
| O62 | Complaint appears in Admin app | Cross-club visibility |
| O63 | Retract complaint | Status updates |

### 3.10 Settings (passcode-gated)

| # | Test | Expected |
|---|------|----------|
| O64 | Club profile: name, address, photos | Saved; customer Discover updates |
| O65 | Discoverability toggle | Club shows/hides in customer app |
| O66 | Amenities, hours, timezone | Customer club page reflects changes |
| O67 | Map pin / location | Pin saves correctly |
| O68 | Tables management | Add/edit/disable tables |
| O69 | Rates & billing settings | Applied to new sessions |
| O70 | Staff roles & permissions | Tab/table/discount limits work |
| O71 | Online booking settings | Limits enforced server-side |
| O72 | GST settings | Used in GST report |
| O73 | Data export | CSV/file generated |
| O74 | Account deletion request | Grace period; email cancel link |
| O75 | Help & Support (`/help`) | FAQ readable; submit ticket works |

### 3.11 Notifications & support

| # | Test | Expected |
|---|------|----------|
| O76 | Push: booking approved/rejected | Notification arrives |
| O77 | Push: timer alert | Fires at configured minutes |
| O78 | Push: admin broadcast | Arrives in inbox |
| O79 | Inbox notifications | Messages readable |
| O80 | Support ticket submitted | Appears in Admin Support tab |

---

## 4. Customer app checklist

**Package:** `com.a3billiards.customerapp`  
**Tabs:** Home · Discover · Live · Bookings · History · Profile

### 4.1 Register & login

| # | Test | Expected |
|---|------|----------|
| C1 | Register with phone + WhatsApp OTP | Account created |
| C2 | Wrong OTP | Attempts remaining shown; after 3 → wait |
| C3 | Login with OTP | Enters app |
| C4 | Login with phone + password | Enters app |
| C5 | Phone not verified | Forced to `/verify-phone`; `+91…` E.164 works |
| C6 | Set password (first-time OTP account) | `/set-password` works |
| C7 | Change password | `/change-password` works |
| C8 | Frozen account | `/account-blocked` screen |
| C9 | Pending deletion | Blocked until cancel (email or admin) |
| C10 | Change language | Discover, club, bookings follow language |
| C11 | All labels human-readable | No raw keys like `customerApp.bookingDetail.payNow` |

### 4.2 Home

| # | Test | Expected |
|---|------|----------|
| C12 | Home screen | Next booking card, quick tiles, notification bell |
| C13 | Complaint advisory banner | Shows if applicable (no private details) |
| C14 | Pull to refresh | Data updates |

### 4.3 Discover & club profile

| # | Test | Expected |
|---|------|----------|
| C15 | Discover list | Clubs with hours, distance (if location on) |
| C16 | Location permission | Nearby clubs within ~50 km |
| C17 | Name search | Filters clubs |
| C18 | Pull to refresh / infinite scroll | List updates |
| C19 | Open `/club/[clubId]` | **No crash**; photos, hours, amenities, pricing |
| C20 | Photo gallery scroll | No nested scroll glitches |
| C21 | Get directions | Maps app opens |
| C22 | Frozen club | Not discoverable / not bookable |

### 4.4 Booking flow

| # | Test | Expected |
|---|------|----------|
| C23 | `/book/[clubId]`: type → date → duration → time | Each step works |
| C24 | Review & submit | Booking created as **pending** |
| C25 | Booking limits | Max 2 active per club, max 2 clubs enforced |
| C26 | Cancellation (when allowed) | Status updates; refund if paid |
| C27 | Owner approves | Status → approved; notification received |
| C28 | Owner rejects | Status → rejected; notification received |

### 4.5 Booking payment (Razorpay)

| # | Test | Expected |
|---|------|----------|
| C29 | Approved booking → `/booking/[bookingId]` | Detail page loads (**no crash**) |
| C30 | Tap **Pay now** | Opens `/pay` WebView |
| C31 | Razorpay checkout loads | Convex `/booking-pay` page |
| C32 | Complete test payment | Booking marked paid via webhook |
| C33 | Payment failure | Clear error; can retry |
| C34 | Cancel paid booking (within window) | Refund processed |

### 4.6 Bookings, history, live

| # | Test | Expected |
|---|------|----------|
| C35 | My Bookings tab | Pending / approved / cancelled with status colors |
| C36 | Badge for pending count | Shows correct number |
| C37 | History tab | Cross-club sessions; active timer for live session |
| C38 | Live tab | Active streams listed |
| C39 | Watch `/live/[liveStreamId]` | IVS playback works |
| C40 | Switch between live streams | Player changes correctly |

### 4.7 Profile, privacy & support

| # | Test | Expected |
|---|------|----------|
| C41 | Edit name/age | Saved |
| C42 | Data export | File generated |
| C43 | Account deletion request | 30-day grace; email cancel link |
| C44 | Help & Support (`/help`) | FAQ + contact email + submit ticket |
| C45 | Sign out | Returns to login |

### 4.8 Notifications

| # | Test | Expected |
|---|------|----------|
| C46 | Push permission on first login | Prompt appears |
| C47 | Booking status push | Received |
| C48 | Booking reminder push | Received before session |
| C49 | Admin broadcast | Received in inbox |
| C50 | Inbox (`/inbox-notifications`) | Messages readable |

---

## 5. Admin app checklist

**Package:** `com.a3billiards.adminapp`  
**Tabs:** Dashboard · Clubs · Users · Complaints · Live · Support · Audit · Notifications

### 5.1 Login & MFA

| # | Test | Expected |
|---|------|----------|
| A1 | Login with email + password | **Always** proceeds to MFA (no spinner stuck) |
| A2 | Enter MFA code | Dashboard loads |
| A3 | Wrong MFA | Clear error |
| A4 | Non-admin account | Auto sign-out |
| A5 | Language picker | **Only on dashboard** (single control) |

### 5.2 Dashboard & ops lists

| # | Test | Expected |
|---|------|----------|
| A6 | Dashboard stats | Platform revenue, counts |
| A7 | Active sessions tile → `/sessions` | List loads; pull-to-refresh |
| A8 | Pending bookings tile → `/bookings` | List loads; pull-to-refresh |

### 5.3 Users (`/(tabs)/users` + `/user/[userId]`)

| # | Test | Expected |
|---|------|----------|
| A9 | Search by name/phone/email | Correct users |
| A10 | Filter owners / customers | Correct lists |
| A11 | Freeze badge on frozen users | Visible |
| A12 | Export all users CSV | File shares |
| A13 | Open user profile | Full details load |
| A14 | Edit name, age, email, phone | Saved |
| A15 | Send password reset | Email to **profile email** |
| A16 | Freeze / unfreeze | User blocked/unblocked at login |
| A17 | Reset owner settings passcode | Owner must set new passcode |
| A18 | Cancel account deletion | User can log in; badge clears |
| A19 | End owner club subscription | Club frozen; **live streams stop** |
| A20 | Promote owner → admin | Role changes |
| A21 | Demote admin → owner | Role changes |
| A22 | Force-end stuck session | Session ends |
| A23 | Export single user CSV | File shares |
| A24 | View complaints, sessions, booking history | Data correct |

### 5.4 Clubs

| # | Test | Expected |
|---|------|----------|
| A25 | Search/filter clubs | Results correct |
| A26 | Subscription status | Active / grace / frozen visible |
| A27 | Discoverability status | Shown |

### 5.5 Live moderation

| # | Test | Expected |
|---|------|----------|
| A28 | Live tab lists active streams | Clubs shown |
| A29 | Badge count | Matches active streams |
| A30 | Watch live (`/live/[liveStreamId]`) | **No "Unmatched Route"**; video plays |
| A31 | Force-end with reason | Stream stops; owner notified |

### 5.6 Complaints

| # | Test | Expected |
|---|------|----------|
| A32 | Complaints list | Active complaints with search |
| A33 | Badge count | Matches open complaints |
| A34 | Dismiss complaint | Status updates |

### 5.7 Support queue (new)

| # | Test | Expected |
|---|------|----------|
| A35 | Support tab loads | No import/build errors |
| A36 | Open tickets from customer/owner | Listed with details |
| A37 | Badge for open tickets | Shows count |
| A38 | Triage / update ticket | Status changes |

### 5.8 Notifications (broadcast)

| # | Test | Expected |
|---|------|----------|
| A39 | Compose broadcast: all users | Sends |
| A40 | Compose: by role | Sends to correct role |
| A41 | Compose: selected users | Sends to selected |
| A42 | Rate limit (10/hour/admin) | Enforced |
| A43 | Delivery history | Shows sent notifications |
| A44 | Recipients get push + inbox | Verified on customer/owner devices |

### 5.9 Audit log

| # | Test | Expected |
|---|------|----------|
| A45 | Freeze/unfreeze logged | Appears |
| A46 | Password reset logged | Appears |
| A47 | Subscription end logged | Appears |
| A48 | Deletion cancel logged | Appears |
| A49 | Force-end stream logged | Appears |

---

## 6. Cross-app integration tests

Run these end-to-end scenarios with all apps + website:

| # | Scenario | Steps | Expected |
|---|----------|-------|----------|
| X1 | New club onboarding | Website register → pay → Owner app login → set passcode | Full flow without developer help |
| X2 | Owner renew frozen | Admin ends subscription → Owner frozen → Website `/renew` → pay | Owner app works again |
| X3 | Customer books & pays | Customer books → Owner approves → Customer pays → Owner starts session | Paid booking → live session |
| X4 | Walk-in session | Owner slots guest → Customer history (if registered) | Session appears in history |
| X5 | Live stream triangle | Owner starts live → Customer watches → Admin watches → Admin force-ends | All three perspectives work |
| X6 | Freeze bad actor | Admin freezes customer → Owner walk-in blocked → Customer login blocked | Consistent block |
| X7 | Support ticket | Customer/Owner submits help ticket → Admin Support tab | Ticket visible |
| X8 | Account deletion restore | User requests deletion → Admin cancels OR email link | User restored |
| X9 | Two clubs isolation | Two owners, two clubs | Each sees only their data |
| X10 | Multi-club customer | Customer plays at Club A and B | Separate bookings/history, no data leak |
| X11 | Staff RBAC | Staff role with limited tabs | Cannot access restricted tabs |
| X12 | Peak hour stress | Multiple tables + snacks + checkouts | Bills stay correct |
| X13 | Cron: booking reminder | Wait for 1-hour reminder cron | Push received |
| X14 | Cron: no-show | Booking past deadline | Auto no-show status |

---

## 7. Play Store upload manual (Android)

### 7.1 One-time Google Play Console setup

1. **Create Google Play Developer account** — [play.google.com/console](https://play.google.com/console) — one-time $25 fee.
2. **Create 3 separate apps** (recommended for clarity):
   - A3 Billiards (Customer) — `com.a3billiards.customerapp`
   - A3 Billiards Owner — `com.a3billiards.ownerapp`
   - A3 Billiards Admin — `com.a3billiards.adminapp`
3. **App access:** Declare if login is required (all three require login). Provide test credentials for Google reviewers.
4. **Content rating:** Complete IARC questionnaire for each app.
5. **Target audience:** Set age group appropriately.
6. **Data safety form:** Declare data collected (phone, email, location, payment info, etc.) — match your privacy policy.
7. **Account deletion:** Provide URL `https://register.a3billiards.com/privacy` and describe in-app deletion flow.
8. **Support contact:** `support@a3billiards.com` + link to help screen description.

### 7.2 Signing & build (EAS)

Each app has its own `eas.json` under `apps/<app>/`.

**First-time: configure EAS credentials**

```powershell
cd apps/customer-app
npx eas login
npx eas build:configure
npx eas credentials
```

Repeat for `owner-app` and `admin-app`.

**Production AAB build (Play Store requires AAB, not APK):**

```powershell
# Sync workspace first
pnpm sync:build-folder

# Build production AAB via EAS (cloud build)
cd apps/customer-app
npx eas build --platform android --profile production

cd ../owner-app
npx eas build --platform android --profile production

cd ../admin-app
npx eas build --platform android --profile production
```

**Before production build, update in each `app.config.ts`:**

- `version` — user-visible version (e.g. `1.0.0`)
- Ensure `EXPO_PUBLIC_CONVEX_URL` in `eas.json` `production` profile points to **production** Convex deployment (not dev `ardent-albatross-880` unless intentional)

**Firebase / FCM for production:**

- Upload `customer-google-services.json`, `owner-google-services.json` to EAS secrets or repo (never commit private keys to public repos)
- Set `GOOGLE_SERVICES_JSON` env in EAS build profile

### 7.3 Store listing (each app)

| Field | Customer app | Owner app | Admin app |
|-------|-------------|-----------|-----------|
| Title | A3 Billiards | A3 Billiards Owner | A3 Billiards Admin |
| Short description | Find & book billiards clubs | Run your billiards club | Platform support tools |
| Full description | Booking, live streams, history | Tables, kitchen, bookings, live | Users, moderation, support |
| Screenshots | Phone + 7" tablet minimum | Same | Same |
| Feature graphic | 1024×500 | Same | Same |
| App icon | 512×512 | Same | Same |
| Category | Sports or Lifestyle | Business | Business |
| Privacy policy URL | `https://register.a3billiards.com/privacy` | Same | Same |

### 7.4 Upload & release

```powershell
cd apps/customer-app
npx eas submit --platform android --profile production
```

Or manually: Play Console → Release → Production → Upload AAB → Add release notes → Review → Roll out.

**Release checklist per app:**

- [ ] Version code incremented
- [ ] Production Convex URL in build
- [ ] All env vars set in EAS
- [ ] Tested on physical Android device
- [ ] Data safety form complete
- [ ] Content rating complete
- [ ] Reviewer test account documented

### 7.5 Admin app distribution note

The Admin app is for **internal support staff only**. Options:

- **Unlisted** on Play Store (link-only), or
- **Internal testing track** (up to 100 testers), or
- **Private** managed Google Play (enterprise)

Do not market Admin app to the public.

---

## 8. App Store upload manual (iOS)

### 8.1 One-time Apple Developer setup

1. **Apple Developer Program** — [developer.apple.com](https://developer.apple.com) — $99/year.
2. **App Store Connect** — Create 3 apps:
   - Customer: `com.a3billiards.customerapp`
   - Owner: `com.a3billiards.ownerapp`
   - Admin: `com.a3billiards.adminapp`
3. **Certificates & provisioning** — EAS handles most of this via `eas credentials`.

### 8.2 iOS-specific configuration

**Owner app needs extra permissions (IVS broadcast):**

- Camera usage description
- Microphone usage description

**Google Sign-In (Owner app):**

- Set `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` in EAS production env
- Add `GOOGLE_SERVICE_INFO_PLIST` or URL scheme in `app.config.ts`
- Match `GOOGLE_IOS_CLIENT_ID` in Convex env

**FCM / push on iOS:**

- Upload APNs key to Firebase Console
- Set `GOOGLE_SERVICE_INFO_PLIST` for customer/owner builds

### 8.3 Production IPA build

```powershell
pnpm sync:build-folder

cd apps/customer-app
npx eas build --platform ios --profile production

cd ../owner-app
npx eas build --platform ios --profile production

cd ../admin-app
npx eas build --platform ios --profile production
```

### 8.4 App Store Connect listing

Same content as Play Store (title, description, screenshots, privacy URL, support URL).

**Additional Apple requirements:**

- [ ] App Privacy details (nutrition labels) — match actual data collection
- [ ] Export compliance — typically "No" for standard HTTPS encryption
- [ ] Sign in with Apple — **not required** (you use phone OTP / email, not third-party social login on customer app)
- [ ] Review notes with test account credentials
- [ ] Account deletion — describe in-app flow (Apple requires this)

### 8.5 Submit

```powershell
cd apps/customer-app
npx eas submit --platform ios --profile production
```

Then in App Store Connect: select build → add release notes → submit for review.

---

## 9. When you add a new feature later

Use this playbook every time you ship a change — whether preview testing or store release.

### 9.1 Development checklist

| Step | What to do | When |
|------|------------|------|
| 1 | Implement feature in workspace (`C:\Users\ibrah\Desktop\A3 Main\a3-billiards-os`) | Always |
| 2 | If new Convex tables/functions: update `packages/convex/schema.ts` + handlers | Backend change |
| 3 | If new user-visible text: add keys to `packages/i18n/src/locales/<app>/en.ts` | UI text |
| 4 | Wire new locale sections in `packages/i18n/scripts/build-json-locales.ts` | **Critical** — missing step causes raw key labels |
| 5 | Run `pnpm --filter @a3/i18n run build:locales` | After i18n changes |
| 6 | If shared UI: add to `packages/ui` or `packages/utils` | Cross-app feature |
| 7 | Test in Expo dev client locally before APK build | Always |

### 9.2 Backend deploy

```powershell
cd packages/convex

# Dev/preview deployment (preview APKs use ardent-albatross-880):
npx convex dev --once

# Production deployment (when going live):
npx convex deploy
```

**Also check:**

- New env vars added to Convex dashboard (dev + prod)
- New HTTP routes registered in `http.ts`
- Razorpay webhook events if payment-related
- Cron jobs if time-based behavior

### 9.3 Mobile build & test

```powershell
# Always sync first (fixes [bracket] path bugs on Windows):
pnpm sync:build-folder

# Rebuild only changed app(s):
powershell -File scripts/build-preview-apk.ps1 -App customer-app
powershell -File scripts/build-preview-apk.ps1 -App owner-app
powershell -File scripts/build-preview-apk.ps1 -App admin-app

# Or all three:
pnpm build:preview-apks
```

**Install fresh APK on device** — old APKs will not have your changes.

### 9.4 QA for the new feature

1. Add test rows to this doc (or `docs/QA-CHECKLIST.md`)
2. Test the feature on **each app** it touches
3. Test cross-app flows (e.g. customer submits → admin sees)
4. Test error cases (network off, wrong input, permission denied)
5. Test i18n: switch to Hindi — labels must not show raw keys
6. Test on low-end Android device

### 9.5 Store update release

| Step | Action |
|------|--------|
| 1 | Bump `version` in `app.config.ts` (e.g. `1.0.0` → `1.1.0`) |
| 2 | EAS production build (`--profile production`) |
| 3 | Test production build on device before submit |
| 4 | Update store listing if feature is user-visible (screenshots, description) |
| 5 | Update privacy/data safety if new data is collected |
| 6 | Write release notes |
| 7 | `eas submit` or manual upload |
| 8 | Staged rollout (10% → 50% → 100%) recommended |

### 9.6 Onboarding website updates

If feature touches registration/renew/legal:

1. Deploy `apps/onboarding-web` to hosting
2. Update `VITE_CONVEX_URL` if deployment changed
3. Test all flows on production URL
4. Update privacy/terms if data practices changed

### 9.7 Common mistakes to avoid

| Mistake | Result | Fix |
|---------|--------|-----|
| Skip `pnpm sync:build-folder` | APK has stale code | Always sync before build |
| Skip `build-json-locales.ts` wiring | Raw i18n keys in app | Add section to build script |
| Test old APK | "Fix didn't work" | Uninstall + install fresh APK |
| Deploy Convex to wrong deployment | App connects but API missing | Match `EXPO_PUBLIC_CONVEX_URL` |
| Use `Buffer` in Convex actions | Runtime crash | Use `TextEncoder` + `btoa` |
| Bracket paths in PowerShell sync | Files not copied | Use `-LiteralPath` (already fixed) |

---

## 10. Environment variables reference

### 10.1 Mobile apps (EAS build env)

| Variable | Customer | Owner | Admin |
|----------|----------|-------|-------|
| `EXPO_PUBLIC_CONVEX_URL` | ✅ Required | ✅ Required | ✅ Required |
| `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` | In eas.json | ✅ Required | — |
| `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` | In eas.json | ✅ Required | — |
| `EXPO_PUBLIC_SENTRY_DSN` | Optional | Optional | Optional |
| `EXPO_PUBLIC_POSTHOG_API_KEY` | Optional | Optional | Optional |
| `GOOGLE_SERVICES_JSON` | ✅ FCM | ✅ FCM + Google | — |
| `GOOGLE_SERVICE_INFO_PLIST` | iOS FCM | iOS FCM + Google | — |
| `GOOGLE_MAPS_ANDROID_API_KEY` | — | Optional | — |
| `GOOGLE_MAPS_IOS_API_KEY` | — | Optional | — |

### 10.2 Convex (server-side)

| Group | Variables |
|-------|-----------|
| Core | `CONVEX_SITE_URL`, `ONBOARDING_WEB_URL` |
| Razorpay | `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`, plan paise |
| WhatsApp | `WHATSAPP_PHONE_ID`, `WHATSAPP_API_TOKEN`, `WHATSAPP_VERIFY_TOKEN`, template names |
| Email | `RESEND_API_KEY` |
| FCM | `FIREBASE_PROJECT_ID`, `FIREBASE_SERVICE_ACCOUNT_JSON` |
| AWS IVS | `AWS_IVS_REGION`, access keys, playback auth keys, `AWS_EVENTBRIDGE_WEBHOOK_SECRET` |
| Google | `GOOGLE_WEB_CLIENT_ID`, `GOOGLE_IOS_CLIENT_ID`, `GOOGLE_ANDROID_CLIENT_ID`, `GOOGLE_MAPS_API_KEY` |
| Email links | `PASSWORD_RESET_URL`, `PASSCODE_RESET_URL`, `CANCEL_DELETION_URL` |

### 10.3 Onboarding website (Vite)

| Variable | Required |
|----------|----------|
| `VITE_CONVEX_URL` | ✅ |
| `VITE_SENTRY_DSN` | Optional |
| `VITE_POSTHOG_API_KEY` | Optional |

---

## 11. Known gaps & roadmap

Items not yet built or partially built — test accordingly:

| # | Gap | Workaround today |
|---|-----|------------------|
| 1 | In-app owner subscription renew | Frozen owners use `register.a3billiards.com/renew` |
| 2 | Google Sign-In on customer app | Phone OTP + password only |
| 3 | Non-English help/FAQ translations | Falls back to English for new keys |
| 4 | Loyalty module | Removed — do not test |
| 5 | Native Razorpay SDK | WebView checkout only |
| 6 | Super-admin role in Admin app | Use Convex dashboard for schema/data |
| 7 | Account purge after 30 days | Verify cron runs; watch for stuck "pending deletion" |

**Recommended before public launch:**

1. In-app renew deep link for frozen owners
2. Full push notification verification on all 3 apps
3. Production Convex deployment separate from `ardent-albatross-880`
4. Play Store / App Store listings with screenshots
5. Automated smoke tests for login → book → pay → session

---

## Quick reference commands

```powershell
# Sync code to build folder
pnpm sync:build-folder

# Rebuild i18n JSON from TS sources
pnpm --filter @a3/i18n run build:locales

# Deploy Convex (preview/dev)
cd packages/convex; npx convex dev --once

# Deploy Convex (production)
cd packages/convex; npx convex deploy

# Build all preview APKs
pnpm build:preview-apks

# Build single preview APK
powershell -File scripts/build-preview-apk.ps1 -App customer-app

# EAS production build (Play Store / App Store)
cd apps/customer-app; npx eas build --platform all --profile production

# Submit to stores
cd apps/customer-app; npx eas submit --platform android --profile production
cd apps/customer-app; npx eas submit --platform ios --profile production
```

---

*Related docs: `docs/PLAYSTORE-USER-JOURNEY-CHECKLIST.md` (journey-focused), `docs/QA-CHECKLIST.md` (step-by-step tester scripts), `docs/prd.md` (full product spec).*
