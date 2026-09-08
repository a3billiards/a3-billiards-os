# A3 Billiards OS — Play Store User Journey Checklist

**Who this is for:** Testers, support, and anyone checking the product before release.  
**How to mark:** ✅ Pass · ❌ Fail (write what happened) · ⚠️ Partial (write the issue)

Install fresh APKs (or Play Store builds) for **Owner**, **Customer**, and **Admin**.  
Onboarding happens on the **website** (register / renew / reset password / cancel deletion).

---

## Who uses what

| Role | App / site | Who they are |
|------|------------|--------------|
| **Club owner** | Owner app + onboarding website | Runs one billiards club; pays subscription; manages tables, staff, bookings, live streams |
| **Staff** | Owner app (shared device) | Uses owner’s phone/tablet with a staff passcode; limited tabs by role |
| **Customer / player** | Customer app | Finds clubs, books tables, watches live, plays at clubs |
| **Support (Admin)** | Admin app | Platform support team: users, complaints, live moderation, notifications |
| **Super admin / developers** | Convex dashboard, GitHub, deploy tools | You: schema, env vars, payments, IVS, email, builds — not an in-app role today |

Many owners and many customers share one platform. Each owner has **one club**. Customers can play at **many clubs**.

---

# PART A — First time on the platform (Onboarding website)

*Situation: A new club wants A3. They hear about it, open the registration site on a phone or laptop.*

| # | What they do | What should happen | Easy? |
|---|--------------|--------------------|-------|
| A1 | Open registration site | Clear “register club” flow, language if available | |
| A2 | Enter club name, address, pin location on map | Map + optional lat/lng fields work | |
| A3 | Set rates, tables, hours | Saved for after payment | |
| A4 | Create owner account (email + strong password) | Password rules shown; weak password rejected | |
| A5 | Pay subscription | Payment succeeds; club becomes **active** | |
| A6 | After payment | Welcome email; owner can log into **Owner app** | |
| A7 | Forgot password | Email with reset link → set new password → can log in | |
| A8 | Reset password link expired / used twice | Clear error; can request a new link | |
| A9 | Owner requests account deletion (from app) | Email with **cancel deletion** link | |
| A10 | Click cancel deletion within 30 days | Account restored; can log in again | |
| A11 | Renew subscription (grace / frozen) | Payment restores **active**; owner app works again | |

---

# PART B — Owner app (day-to-day club operations)

*Situation: Owner opens the app every morning to run the floor.*

## B1. Login & security

| # | What they do | What should happen |
|---|--------------|--------------------|
| B1.1 | Open Owner app | Login screen, language picker, email/password, Google if enabled |
| B1.2 | Wrong password | Clear error, stay on login |
| B1.3 | Correct login | Passcode setup (first time) or home |
| B1.4 | Set 6-digit settings passcode | Confirmed; used for Settings / sensitive actions |
| B1.5 | Staff selects role with passcode | Only allowed tabs show |
| B1.6 | Change language | Menus and messages follow language |
| B1.7 | Frozen subscription | Clear “subscription ended / renew” screen, not a blank crash |

## B2. Home & navigation

| # | What they do | What should happen |
|---|--------------|--------------------|
| B2.1 | Home | Club name, today’s revenue, active tables, bookings summary |
| B2.2 | Notification bell | Inbox of platform / booking messages |
| B2.3 | Pull to refresh | Numbers update |
| B2.4 | Open each tab | Home, Slots, Snacks, Kitchen, Live, Financials, Bookings, Complaints, Documents, Settings |

## B3. Slots — the main floor flow (most important)

*Situation: Walk-in guests and registered players arrive; staff starts tables.*

| # | What they do | What should happen |
|---|--------------|--------------------|
| B3.1 | Open Slots | Table grid: free vs occupied |
| B3.2 | Free table → Guest | Session starts, timer runs |
| B3.3 | Free table → Registered customer (search name/phone) | Correct customer; session starts |
| B3.4 | Free table → Register at desk + WhatsApp OTP | New customer created; session starts |
| B3.5 | Free table → Group (casual / versus) | Players listed; billing mode correct |
| B3.6 | Scan customer QR | Customer identified; session starts |
| B3.7 | Frozen or pending-deletion customer | **Blocked** with clear error (no play) |
| B3.8 | Add snacks during session | Bill updates |
| B3.9 | Checkout: time + snacks + discount &lt; 100% | Bill correct; payment cash/UPI |
| B3.10 | After checkout | Table free; revenue reflects sale |
| B3.11 | Switch table / end session | No stuck lock or wrong player still selected |

## B4. Bookings

*Situation: Customer booked online; owner approves and starts play.*

| # | What they do | What should happen |
|---|--------------|--------------------|
| B4.1 | See pending bookings | List with customer, time, table type |
| B4.2 | Approve / reject | Customer notified; status updates |
| B4.3 | Start session from approved booking | Table occupied; linked to customer |

## B5. Kitchen & snacks

| # | What they do | What should happen |
|---|--------------|--------------------|
| B5.1 | Manage snack menu | Add/edit/availability |
| B5.2 | Kitchen orders from sessions | Status: pending → preparing → ready |

## B6. Live stream

*Situation: Owner broadcasts a table; customers watch in Customer app.*

| # | What they do | What should happen |
|---|--------------|--------------------|
| B6.1 | Start live (pick quality if offered) | Stream goes live |
| B6.2 | Viewer count updates | Roughly matches watchers |
| B6.3 | Stop stream | Stream ends for viewers |
| B6.4 | Admin ends subscription while live | Stream **stops**; owner is not stuck with a zombie broadcast |

## B7. Money, documents, complaints, settings

| # | What they do | What should happen |
|---|--------------|--------------------|
| B7.1 | Financials / GST report | Date range, totals make sense |
| B7.2 | Upload documents | Stored and listed |
| B7.3 | File complaint on a customer | Appears for admin / on customer profile |
| B7.4 | Settings: rates, hours, amenities, map pin | Saved; customers see updates on Discover |
| B7.5 | Change password / passcode | Works; old credentials fail |

---

# PART C — Customer app (players)

*Situation: Player downloads from Play Store to find clubs and book.*

## C1. Register & login

| # | What they do | What should happen |
|---|--------------|--------------------|
| C1.1 | Register with phone + OTP (WhatsApp) | Account created |
| C1.2 | Wrong OTP | Shows **attempts remaining**; after 3, **wait and try later** |
| C1.3 | Login OTP / password | Enters app |
| C1.4 | Phone not verified | Forced to verify; OTP works with `+91…` phone |
| C1.5 | Frozen account | Blocked screen, not infinite spinner |
| C1.6 | Pending deletion | Cannot use app until cancel (email or support) |
| C1.7 | Change language | Discover, club details, bookings follow language |

## C2. Discover & club profile

| # | What they do | What should happen |
|---|--------------|--------------------|
| C2.1 | Discover list | Clubs with hours, table types, distance if location on |
| C2.2 | Pull to refresh | List updates |
| C2.3 | Open club details | Hours, amenities, tables, pricing in **selected language** |
| C2.4 | Get directions | Maps open |
| C2.5 | Book table | Flow: type → table → date → duration → time → review |
| C2.6 | Submit booking | Pending until owner approves |
| C2.7 | Frozen club subscription | Club not bookable / not discoverable as active |

## C3. Bookings, history, live, profile

| # | What they do | What should happen |
|---|--------------|--------------------|
| C3.1 | My bookings | Pending / approved / cancelled visible |
| C3.2 | Cancel booking (when allowed) | Status updates |
| C3.3 | History | Past visits / sessions |
| C3.4 | Watch live | Player opens; can switch other lives if any |
| C3.5 | Inbox notifications | Messages from platform / clubs |
| C3.6 | Profile: edit, password, sign out | Works |
| C3.7 | Request account deletion | Grace period; cancel link in email |

---

# PART D — Admin app (support team)

*Situation: Support helps owners and customers; moderates the platform.*

## D1. Login & MFA

| # | What they do | What should happen |
|---|--------------|--------------------|
| D1.1 | Login with password | **Always** goes to MFA (not stuck on login spinner) |
| D1.2 | Enter MFA code | Dashboard |
| D1.3 | Language | One language control on dashboard (not on every tab) |

## D2. Users (owners & customers)

| # | What they do | What should happen |
|---|--------------|--------------------|
| D2.1 | Search by name / phone / email | Correct users |
| D2.2 | Filter owners / customers | Correct lists |
| D2.3 | Open user profile | Account, sessions, complaints |
| D2.4 | Send password reset email | Email arrives at **profile email** (not phone number) |
| D2.5 | Freeze / unfreeze user | User cannot play / can play again |
| D2.6 | End owner club subscription | Club **frozen**; live streams **stop** |
| D2.7 | Cancel account deletion | User can log in again; list badge clears |
| D2.8 | Export user / all users CSV | File shares |

## D3. Moderation & ops

| # | What they do | What should happen |
|---|--------------|--------------------|
| D3.1 | Live tab — list streams | Active clubs shown |
| D3.2 | Watch live | Video plays |
| D3.3 | Force-end stream with reason | Stream stops; owner notified |
| D3.4 | Complaints | Active / dismissed; search by name |
| D3.5 | Pending bookings / active sessions lists | Pull to refresh works |
| D3.6 | Audit log | Freeze, reset, subscription end, deletion cancel appear |
| D3.7 | Broadcast notifications | Recipients get inbox / push |

---

# PART E — Multi-user real-world situations

| # | Situation | Expected behaviour |
|---|-----------|-------------------|
| E1 | Two owners, two clubs | Each only sees their club data |
| E2 | One customer plays at Club A and Club B | History/bookings per club; no data leak |
| E3 | Staff on owner device | Passcode role limits tabs |
| E4 | Owner subscription expires | Grace then frozen; customers cannot book that club |
| E5 | Support freezes a bad actor | Walk-in and booking start both blocked |
| E6 | Customer deletes account, regrets it | Cancel via email or admin within grace |
| E7 | Peak hour: many tables + snacks | Checkout bills stay correct |
| E8 | Live stream while admin freezes subscription | Stream ends; no orphan IVS |

---

# PART F — Ease of use (Play Store readiness)

Ask honestly after a full walkthrough:

| Question | Notes |
|----------|-------|
| Can a new owner go from website payment to first paid session without a developer? | |
| Can staff start a guest session in under 30 seconds? | |
| Can a customer book a table without calling the club? | |
| Are errors in plain language (OTP attempts, frozen, subscription)? | |
| Does language change cover the screens people actually use? | |
| Is there only one obvious place for language / settings? | |
| Do pull-to-refresh and back buttons behave as users expect? | |

---

# PART G — Super admin / developers (not in Play Store apps)

| Task | Where |
|------|--------|
| Deploy backend | `packages/convex` → Convex deploy |
| Env: payments, Resend email, WhatsApp OTP, IVS, FCM | Convex / app configs |
| Preview APKs | `pnpm sync:build-folder` then `pnpm build:preview-apks` |
| Production builds | EAS / Play Console |
| Schema & data fixes | Convex dashboard + migrations |
| Support escalation | Admin app first; then Convex logs |

There is **no separate “super admin” mobile app** today. Developers use tools; support uses Admin app.

---

# PART H — Future features (recommended)

Ordered by impact for a “works perfectly in production” product.

### Must-have soon

1. **In-app subscription renew** for owners (deep link or WebView to renew) — frozen owners should not depend only on email.  
2. **Reliable account purge** after 30 days (chunked deletes for live streams, loyalty, logs) so accounts never sit in permanent “pending deletion” limbo.  
3. **Push notifications** fully verified on all three apps (booking approved, stream force-ended, complaints).  
4. **Offline / poor network messages** on Owner slots (desk must not look “broken” when Convex is slow).  
5. **Play Store listings**: privacy policy, account deletion URL, data safety form (DPDP / Google requirements).

### Strongly recommended

6. **Staff individual accounts** (optional) instead of only shared-device passcodes.  
7. **Customer wallet / prepaid** or club-specific credits that are easy to explain.  
8. **Owner analytics**: busy hours, popular tables, snack mix — beyond today’s revenue totals.  
9. **Admin “impersonate / support notes”** on user profiles for support history.  
10. **Rate limits & abuse dashboards** for OTP and password reset (visible to admin).  
11. **Automated E2E smoke tests** for login → walk-in → checkout and customer book → approve → start.  
12. **Backup / export** for owners (full club data download on demand).

### Nice to have

13. Multi-club owners (chains).  
14. Customer social: follow clubs, share live clips.  
15. Table waitlist / queue when all tables busy.  
16. Integrated UPI QR generation at checkout (not only “mark as UPI”).  
17. Super-admin role **inside** Admin app (permissions above support: manage other admins, billing overrides).

---

## Bugs fixed in this review (for release notes)

| Fix | Why it mattered |
|-----|-----------------|
| Admin MFA always opens after login | Support was stuck on login spinner |
| Admin password reset uses profile email | Reset emails were failing for phone-login customers |
| Ending subscription also stops live streams | Owners could not stop IVS after freeze |
| Walk-in blocks frozen / pending-deletion customers | Desk play ignored admin freeze |
| Admin can cancel deletion while user still exists | Support could restore stuck accounts |
| Customer verify-phone decodes `+` in phone param | OTP failed after login gate |
| Admin users list updates after cancel deletion | Badge stayed “pending” |
| Club photo gallery no longer nests FlatList in ScrollView | Pull-to-refresh / scroll glitches |

---

*End of checklist. Use Parts A–E for release sign-off; F for UX; G for ops; H for roadmap.*
