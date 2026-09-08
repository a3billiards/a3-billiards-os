# Design System Implementation Tracker

Source of truth: **Figma `a3a3a3`** — file key `6Qzmkkw65tliPLwSVhT6Eo`.

Legacy file `A3 Billiards OS` (`j3nk1G2w1r52umXBg5qAsY`) is **not** used for new UI work.

Legend:
- **Figma** — implemented from Figma Dev Mode specs
- **Extended** — inferred from Owner design system (no Figma frame yet)
- **Partial** — glass tokens applied; full frame match pending Figma pull

**Rule:** See `.cursor/rules/ui-redesign-feature-preservation.mdc` — UI-only work must preserve all existing features (see inventories below).

---

## Feature preservation workflow

Use this on **every** screen redesign:

| Step | Action |
|------|--------|
| 1 | Read the screen's **Feature inventory** below (or add one before first redesign). |
| 2 | Grep the screen file for `onPress`, `router.push`, `Modal`, `visible`, `canAccessTab`. |
| 3 | Implement new visuals; map each inventory item to a UI element. |
| 4 | Tick the checklist; note anything **relocated** (not in mock). |
| 5 | Update the screen status row in the table below. |

---

## Feature inventories (Owner app)

### Home (`apps/owner-app/src/app/(tabs)/home.tsx`)

| Feature | Gate | Status |
|---------|------|--------|
| Pull-to-refresh | — | ✅ |
| Header greeting + club name | — | ✅ hello enlarged; role pill removed per product ask (owner mode still via settings) |
| Theme toggle + notifications bell (stacked) → inbox | — | ✅ |
| Total balance hero + hide/show eye | financials | ✅ |
| Financials CTA → financials tab | financials | ✅ |
| Slots tile → slots tab | slots | ✅ shining-black mesh |
| Livestream tile (vertical LIVE) → livestream tab | livestream | ✅ |
| Bookings tile (`/NN`) → bookings tab | bookings + booking enabled | ✅ |
| Documents tile (folder) → documents tab | documents | ✅ count in a11y |
| Complaints bar + count badge → complaints tab | complaints | ✅ |
| Owner mode passcode gate modal | staff | ✅ via settings (removed from home header) |
| Loading / no-club placeholders | — | ✅ |

### Slots (`apps/owner-app/src/app/(tabs)/slots.tsx`)

| Feature | Gate | Status |
|---------|------|--------|
| Pull-to-refresh | — | ✅ |
| Header + notifications bell | — | ✅ piano-black home theme (`SLOTS` + bell); bookings stats header removed |
| Occupied / free stats | — | ✅ `\NN` occupancy cards (IN USE / FREE) |
| Filter + status legend | — | ✅ glass piano-black control; monochrome legend |
| Table list → walk-in (free) / detail (in use) | — | ✅ |
| Occupancy summary strip | — | ✅ |
| Tables section header | — | ✅ Figma `46:128` + real total count |
| Full-width pool table cards | — | ✅ `@a3/ui` / `OwnerSlotsTableGrid` piano-black |
| Active tables quick actions | — | ✅ Add time · Move table · Add items · Close table (labels match handlers) |
| Session detail modal (add time, items, close) | — | ✅ |
| Walk-in / conflict / checkout / extend / move modals | — | ✅ |
| Snack picker, QR scanner, complaint gate | — | ✅ |
| Bottom bar: hold time + My Bookings | booking enabled | ✅ floating piano-black bar |
| Tab access denied / no club / lock overlay | — | ✅ |

### Kitchen (`apps/owner-app/src/app/(tabs)/kitchen.tsx`)

| Feature | Gate | Status |
|---------|------|--------|
| Pull-to-refresh | — | ✅ |
| Stats panel (Pending / Preparing / Ready) + filter | chef / owner | ✅ Figma `46:978` |
| Notifications bell → inbox | — | ✅ (preserved; not in Figma frame) |
| Menu / Snacks toggle | — | ✅ Figma `46:1122`; Snacks → snacks tab |
| Kitchen menu sheet (availability toggle) | chef | ✅ |
| Order cards + advance status | chef | ✅ Figma `46:1145` |
| Mark unavailable (secondary action) | chef | ✅ real handler (not mock "Edit") |
| Served today collapsible | chef | ✅ |
| Owner unavailable confirmations | owner | ✅ |
| Chef-only placeholder for non-chef staff | staff | ✅ |
| Tab access denied / no club | — | ✅ |

### Bookings (`apps/owner-app/src/app/(tabs)/bookings.tsx`)

| Feature | Gate | Status |
|---------|------|--------|
| Pull-to-refresh | — | ✅ |
| Nav header + back | — | ✅ Figma `49:14572` |
| Pending / Upcoming / History segments | — | ✅ Figma `49:14579` |
| Booking cards (name, phone, date/time/duration grid) | — | ✅ Figma `49:14591` |
| Approve / Reject actions | — | ✅ |
| Upcoming: start session + cancel | — | ✅ |
| Check-in QR scanner | — | ✅ (preserved) |
| History filters + search | — | ✅ (preserved) |
| Complaint gate on start | — | ✅ |
| Approve/reject/cancel modals | — | ✅ |
| Tab access denied / no club | — | ✅ |

### Settings (`apps/owner-app/src/app/settings.tsx` + `OwnerSettingsContent.tsx`)

| Feature | Gate | Status |
|---------|------|--------|
| Passcode gate (owner only) | — | ✅ preserved; chrome/onDarkCanvas restyle |
| Pull-to-refresh | — | ✅ monochrome indicator |
| Hub: profile card + staff roles hero | — | ✅ shine gradient **only** on Profile + Staff Roles |
| Hub Sign Out | — | ✅ shine gradient kept |
| Hub grouped sections / frozen | — | ✅ flat `#0A0A0A` (no shine) |
| Sectioned settings rows (Club → Account) | — | ✅ grouped `#0A0A0A` cards; quiet icons; Home type tokens |
| Detail screens (profile, tables, rates, booking, staff, GST, security) | — | ✅ all forms preserved; surfaces match Home |
| Language picker | — | ✅ |
| Help / FAQs → help screen / FAQ sheet | — | ✅ |
| Download my data + export club members | — | ✅ (members preserved in Support; download disabled when frozen / no email) |
| Delete account + sign out | — | ✅ restrained destructive + Financials-style sign-out pill |
| Staff role switch / modals | — | ✅ OwnerModePasscodeGate preserved |
| Subscription frozen banner | — | ✅ quiet piano-black warning + existing RENEW_URL |

### Documents (`apps/owner-app/src/app/documents.tsx` + `OwnerDocumentsFigma.tsx`)

| Feature | Gate | Status |
|---------|------|--------|
| `canAccessTab("documents")` / tab denied / no club | documents | ✅ |
| Pull-to-refresh + back | — | ✅ monochrome |
| Hero (count + refresh) | — | ✅ shining-black hero; real count |
| Document grid open / delete / category badges | — | ✅ flat piano-black; quiet chrome badges |
| Customer Details (incl. empty) | — | ✅ preserved |
| Upload CTA + add modal (presets / custom / camera / library / PDF) | — | ✅ chrome CTA (no neon green) |
| Viewer modal (close / open externally) | — | ✅ |
| Create / delete / upload mutations + loading / empty / busy | — | ✅ |

### Livestream (`apps/owner-app/src/app/(tabs)/livestream.tsx` + broadcast controls)

| Feature | Gate | Status |
|---------|------|--------|
| `canAccessTab("livestream")` / tab denied / no club | livestream | ✅ |
| Pull-to-refresh + back | — | ✅ |
| Camera preview + IVS broadcast | — | ✅ piano-black frame; no shine on preview |
| Stream key show/copy | — | ✅ shining-black stream-key card |
| Active table pills + title / quality | — | ✅ silver selected; glass inputs |
| Start / end stream + mic + flip + viewer count refresh | — | ✅ chrome Start; muted-red End; white blinking LIVE dot |
| Multi-stream hint / idle / loading | — | ✅ muted silver (no amber/green) |

### Complaints (`apps/owner-app/src/app/complaints.tsx` + `OwnerComplaintsFigma.tsx`)

| Feature | Gate | Status |
|---------|------|--------|
| `canAccessTab("complaints")` / tab denied / no club | complaints | ✅ |
| Back + File Complaint CTA | — | ✅ chrome CTA (no solid red fill) |
| Active / Retracted segments + search | — | ✅ mono silver ring active |
| Complaint cards + Retract | — | ✅ piano-black; muted-red Retract only |
| File / retract sheets (`fileComplaint` / `retractComplaint`) | — | ✅ customer/session/type flows preserved |
| Loading / empty / error | — | ✅ Home-style chrome loaders |

### Passcode setup (`apps/owner-app/src/app/passcode-setup.tsx`)

| Feature | Gate | Status |
|---------|------|--------|
| Create stage (6 digits) → confirm stage | — | ✅ |
| Confirm mismatch → error + reset both stages | — | ✅ |
| `setupPasscode` action + navigate home | — | ✅ |
| On-screen numeric keypad + backspace | — | ✅ |
| Traveling white glow PIN boxes (masked •) | — | ✅ Extended (onboarding OTP motion) |
| Loading / API error display | — | ✅ |

### Change passcode (`apps/owner-app/src/app/change-passcode.tsx`)

| Feature | Gate | Status |
|---------|------|--------|
| Current → new → confirm stages | — | ✅ |
| Continue / Update CTA | — | ✅ |
| Mismatch + incorrect current handling | — | ✅ |
| `changePasscode` + forgot-reset modal | — | ✅ |
| Traveling white glow PIN boxes + system keyboard | — | ✅ Extended |

### Settings, Bookings, Documents, …

_Add inventories when those screens are redesigned._

### Snacks (`apps/owner-app/src/app/(tabs)/snacks.tsx`)

| Feature | Gate | Status |
|---------|------|--------|
| Pull-to-refresh | — | ✅ |
| Back + Snack Management + amber Add | — | ✅ Figma `49:5149` |
| Search filter | — | ✅ |
| Snack cards (toggle / edit / delete) | — | ✅ |
| Add / Edit bottom sheet + availability | — | ✅ (availability preserved; not in Figma add form) |
| Loading / empty / search-empty states | — | ✅ Extended glass shells |
| Tab access denied / no club | — | ✅ |
| Staff tab gate | staff | ✅ |

---

## Shared foundation (`@a3/ui`)

| Module | Status | Notes |
|--------|--------|-------|
| `theme/glass.ts` | Figma | Colors, card, tab pill, CTA |
| `theme/motion.ts` | Figma + Extended | Durations/easing; ambient orb pulse |
| `GlassPageBackground` | Figma | Ambient orb animation added |
| `LiquidGlassCard` | Figma | Press scale on `onPress` |
| `GlassIconTile` | Figma | |
| `GlassTextField` | Figma | Auth form inputs |
| `GlassButton` | Figma | primary / secondary / outline; green + blue accent |
| `OwnerFigmaBackButton` | Figma | Shared nav back control |
| `OwnerFigmaLoadingScreen` | Extended | Glass loading shell + inline list variant |
| `OwnerFigmaEmptyState` | Extended | Glass empty / zero-results card |
| `AnimatedEntrance` | Figma | Fade + slide-up stagger |
| `GlassTabPressable` | Extended | Tab press scale feedback |

---

## Owner app screens

| Screen | Status | Notes |
|--------|--------|-------|
| Login | Figma | AnimatedEntrance + GlassTextField + GlassButton |
| Home | Extended shining-black mock | Inset hero; Slots/Live/Bookings/Docs grid; Complaints bar; all gates preserved |
| Slots | Extended shining-black (home theme) | Slots header + occupancy `\NN` cards; glass filter; piano-black table/active cards; booking bottom bar; all modals/flows preserved |
| Kitchen | Figma `46:976` | Combined stats glass card, Menu/Snacks toggle, order cards; menu sheet + served + owner gates preserved |
| Bookings | Figma `49:14564` | Nav header, 3-tab segment control, glass booking cards with approve/reject; check-in, history filters, modals preserved |
| Financials | Figma `46:2044` | Back + Today pill, hero card, Cash/UPI tiles, Credit resolved/unresolved, stacked Best Sellers / Top Tables / Peak Hours; analytics, GST, credit resolve, hide amounts preserved |
| Livestream | Extended shining-black (home theme) | Piano-black preview frame; shiny stream-key hero; chrome Start CTA; silver table/quality pills; white blinking LIVE dot; IVS/mic/flip/end preserved |
| Documents | Extended shining-black (home theme) | Shiny docs hero + count; flat piano-black grid; chrome upload CTA; monochrome badges; Customer Details + upload/viewer/delete preserved |
| Complaints | Extended shining-black (home theme) | Chrome File Complaint; mono Active/Retracted segments; piano-black cards; muted-red Retract only; file/retract sheets preserved |
| Snacks | Figma `49:5149` | Back + Snack Management title, amber Add, search, glass snack cards with badges/actions; Add Snack bottom sheet; extended loading/empty states; CRUD + availability preserved |
| Settings | Extended shining-black (home theme) | Profile = Revenue-hero geometry; staff mesh metrics; Financials-style sign-out; Home type tokens; all forms/gates/frozen preserved |
| Passcode setup | Extended | Traveling white glow PIN boxes (onboarding OTP motion); keypad + create/confirm/`setupPasscode` preserved |
| Change passcode | Extended | Same traveling PIN UI + system keyboard; stages + `changePasscode` + reset modal preserved |
| Inbox notifications | Extended | Glass page + Figma back; mark-all-read pill; panel preserved |
| Help & support | Extended | Glass page + Figma back; FAQ/support panel preserved |
| Tab bar | Figma `14:235` | 59px pill, 4 icons, active squircle highlight |

---

## Admin / Customer apps

| App | Status |
|-----|--------|
| Admin login | Extended |
| Customer login / register | Home-matched black curved hero + piano-black card on silver canvas. Phone OTP + password flows preserved; Remember me stores phone; Forgot password switches to OTP |
| Customer home | Silver metallic page + black curved hero + glossy **pure-black** cards (tight lacquer highlight, not gunmetal). Search / QR / Bookings chips; labeled tab bar |
| Customer typography | Poppins via `customerFonts` / `customerTypography` + global Text default |
| Customer home booking card | Glossy pure-black card on silver page; UPCOMING chip; QR flip via hero pill + tap card; silver metal View all CTA |
| Customer tab bar | Glossy pure-black pill; labeled Home / Search / Bookings / Live |
| Customer app-wide theme | **Hybrid wallet:** moving silver metallic page, black hero, glossy pure-black cards + silver CTAs. Appearance toggle removed from profile (hybrid look is fixed) |
| Customer profile | Stack route `/profile` (not a hidden tab). Dark bottom sheets (edit, delete, **sign out confirm**). Sign out waits for session clear then `/login` (does not bounce to home) |
| Customer system states | `NetworkGuard` + `OfflineScreen` + slow-connection banner; `useRequireOnline` on booking / profile / inbox / help; shimmer skeletons on Home / Bookings / Live / History / Profile / Inbox / Book flow / Booking detail / Club / Confirmed; shared `EmptyState` + `QueryErrorCard` |

### Customer home feature inventory (`apps/customer-app/src/app/(tabs)/home.tsx`)

| Feature | Status |
|---------|--------|
| Pull-to-refresh | ✅ |
| Loading skeleton | ✅ `CustomerHomeSkeleton` while user / bookings boot |
| Profile avatar → profile | ✅ |
| Notifications → inbox (+ silver dot) | ✅ |
| Time greeting + Hey name | ✅ black curved hero |
| Hero subtitle (next booking / discover) | ✅ |
| Search pill → discover | ✅ |
| QR icon on upcoming card → flip QR | ✅ above View all |
| Bookings pill → bookings | ✅ |
| Status chip (upcoming / empty) | ✅ in hero |
| Your Bookings + View all | ✅ gray link on silver body |
| Flip bookings card (list, badge, QR flip, View all, tap-for-QR) | ✅ calendar illustration removed; small calendar chip kept |
| Active complaints alert list | ✅ preserved (not in mock) |
| Quick Access History → history | ✅ wave art removed |
| Quick Access Requests → bookings | ✅ wave art removed; subtitle padded so it does not overlap the arrow |
| Profile (via hero avatar, not tab) | ✅ |
| Tab bar labels (Home / Search / Bookings / Live) | ✅ |
| Light / Dark Appearance toggle | ❌ removed from profile (user request) |

### Customer login feature inventory (`apps/customer-app/src/app/login.tsx`)

| Feature | Status |
|---------|--------|
| Language picker | ✅ top-right pill; piano-black sheet (white selected, no gold) |
| Phone field + country code | ✅ |
| Password sign-in | ✅ hero Password pill + in-card switch |
| OTP send / verify / resend | ✅ compact black hero on verify so the greeting is not pan-clipped by the keyboard; wallet OTP boxes + SMS autofill |
| Remember me (stores phone) | ✅ |
| Forgot password → OTP mode | ✅ |
| Switch OTP ↔ password | ✅ in-card row |
| Sign up → `/register` | ✅ on silver canvas |
| Frozen / timeout / Convex error banners | ✅ |
| Back (when history exists) | ✅ light circular chevron (home avatar slot) |
| Curved black hero matching home | ✅ WalletHeroShell + greeting + status chip (chip moves into the card on OTP verify) |
| Opaque black metal card overlapping hero | ✅ |
| OTP verify does not signOut the new session | ✅ |

### Customer club profile feature inventory (`apps/customer-app/src/app/club/[clubId].tsx`)

| Feature | Status |
|---------|--------|
| Pull-to-refresh | ✅ |
| Gallery + back | ✅ |
| Call / directions / favorite | ✅ |
| Table grid (list for booking) | ✅ shows club tables + type; not blocked by live walk-in occupancy |
| Continue → `/book/[clubId]` with table + type | ✅ chrome when a table is selected; dark ink on muted silver when disabled |
| Booking unavailable banner | ✅ |
| Discover clubs (tombstone) | ✅ |

### Customer confirm booking feature inventory (`apps/customer-app/src/app/book/[clubId].tsx`)

| Feature | Status |
|---------|--------|
| Table type → table → time → review steps | ✅ |
| Date strip / slots / duration / min-charge warning | ✅ |
| Pay-after-approval hint | ✅ dark ink on silver page |
| Optional notes + 200 counter | ✅ light placeholder on black field |
| Confirm Booking → `submitBooking` | ✅ chrome CTA in safe footer (not clipped) |
| Go back / close when booking disabled | ✅ |

### Customer booking confirmed feature inventory (`apps/customer-app/src/app/booking/confirmed/[bookingId].tsx`)

| Feature | Status |
|---------|--------|
| Back | ✅ |
| QR (`a3booking:{id}`) on light pad | ✅ |
| Calendar + Share | ✅ |
| View My Bookings → `/(tabs)/bookings` | ✅ chrome fill behind black label |

### Customer booking details feature inventory (`apps/customer-app/src/app/booking/[bookingId].tsx`)

| Feature | Status |
|---------|--------|
| Pull-to-refresh | ✅ |
| View Club Profile + footer View Club → `/club/{id}` | ✅ chrome CTA |
| Booking info (ref, type, date, time, duration, table, cost, notes, reason) | ✅ white on black card |
| Check-in QR when confirmed | ✅ |
| Cancel Booking (when `canCancel`) | ✅ red outline preserved; offline guard via `useRequireOnline` |

### Customer system states inventory

| Feature | Status |
|---------|--------|
| App-wide Offline overlay + Retry | ✅ `NetworkGuard` / `OfflineScreen` |
| Slow / flaky connection banner | ✅ `SoftNetworkBanner` when probe ≥3.5s |
| Mutation guard when offline | ✅ `useRequireOnline` on book confirm, cancel, profile save, inbox, help |
| Home / Bookings / Live skeletons | ✅ |
| History / Profile / Inbox / Book flow skeletons | ✅ |
| Booking detail / Club / Confirmed skeletons | ✅ |
| Shared empty states | ✅ `EmptyState` (History, Live, Discover, Inbox) |
| Query / not-found Retry card | ✅ `QueryErrorCard` on booking detail |

---

## Onboarding website (`apps/onboarding-web`)

| Screen | Status | Notes |
|--------|--------|-------|
| Landing `/` | Portfolio + stage hero | Features grid on-page (`#features`); `/features` redirects to `/#features` |
| Features `/features` | Redirect | → `/#features` (section on landing, not a separate page) |
| Login `/login` | Mock | Dark auth card on `auth-hero.png` (8-ball; Gemini watermark removed); Sign In fill hover; Remember me; verify email preserved |
| Register `/register` | Login-matched shell | Fixed `auth-hero` BG (no scroll drift); dark glass card; all onboarding steps preserved |
| Owner dashboard `/dashboard` | Mock | Dark glass card + 8-ball art; subscription + invoices + nav/footer preserved |
| Tax invoice `/dashboard/invoice/:id` | Mock | Dark invoice card; GST rows + Print/Back preserved; GSTIN kept when present |
| Renew `/renew` | Mock | Dark glass card + gold Razorpay CTA; sign-in / no-club / plans / GST preserved |
| Forgot password `/forgot-password` | Mock | Auth glass shell (same as login); email reset preserved |
| Reset password `/reset-password` | Mock | Auth glass shell; token check / set password / success preserved |
| Verify email `/verify-email` | Mock | Auth glass shell; send / verify / resend preserved |
| Deletion cancelled `/deletion-cancelled` | Mock | Auth glass shell; success / error copy preserved |
| Privacy `/privacy` · Terms `/terms` · DPDP `/dpdp` | Mock | Shared legal shell (TOC + contact card + 8-ball); original copy unchanged |

### Landing feature inventory

| Feature | Status |
|---------|--------|
| Get Started → `/register` | ✅ nav pill, hero chrome CTA, features list CTA, band CTA, sheet CTA |
| Login → `/login` | ✅ nav / hero / footer / mobile menu |
| Contact / Support (mailto) | ✅ nav + footer (`support@a3billiards.com`) |
| Features (onboarding steps) | ✅ `#features` 12-card grid + go-live steps + Quick overview sheet |
| Privacy / Terms / DPDP | ✅ footer Legal links |
| Pricing → `/register?plan=monthly\|yearly` | ✅ `#pricing` cards |
| Renew → `/renew` | ✅ pricing note + footer + auth nav |
| Forgot password → `/forgot-password` | ✅ footer Account |
| Steps: Account → Club → Subscribe → Go live | ✅ glass-card `#features` panel + Quick overview sheet |
| Auth: Dashboard / Renew / Logout when signed in | ✅ nav (desktop) + mobile menu + footer Logout |
| Reviews carousel (3 fake owner reviews) | ✅ prev/next arrows + slide anim + dots; Log In / Get Started CTAs; `reviews.png` section BG |
| Features section BG | ✅ `featureSectiom.png` |
| Final CTA band BG | ✅ `finalband.png` (“Open your Owner App”) |

### Login feature inventory

| Feature | Status |
|---------|--------|
| Email + password sign-in | ✅ |
| Show/hide password | ✅ eye toggle |
| Remember me (persist email) | ✅ |
| Forgot password → `/forgot-password` | ✅ restyled to auth glass shell (same as login) |
| Verify email → `/verify-email` | ✅ restyled auth glass shell (not linked from login UI; route + unverified redirect still work) |
| Create account → `/register` | ✅ |
| Error banner + AUTH_* handling | ✅ |
| Busy / Signing in… state | ✅ |
| Sign In door animation (open → walk in → green tick) | ✅ |
| Google Sign-In | ✅ wired (`googleOwner` + GIS); Apple deferred |
| Apple Sign-In | N/A — deferred (not requested yet) |

### Register feature inventory

| Feature | Status |
|---------|--------|
| Multi-step Account → Club → Pay → Done | ✅ circular stepper (Account → Club → Pay → Done); earlier steps still clickable |
| Owner account create + password strength | ✅ |
| Email verify / resend flows | ✅ OTP boxes + border light; Email verified → Continue |
| Club details + location pin picker | ✅ restyled Club step (two-column: form + map/rates); Find address, pin, geolocation, currency/timezone/rates preserved |
| Subscription plan + Razorpay pay | ✅ restyled Pay step (two-column: plans/GST + 8-ball art + Pay/Back); handlers unchanged |
| Dashboard / Owner App handoff | ✅ |
| Auth shell background (`auth-hero.png`) | ✅ fixed (does not scroll with form) |
| Login-matched dark glass form chrome | ✅ |
| Create-account hero header | ✅ brand + title + stepper + security row + 8-ball art (`eightball-smoke.mp4`) |

### Owner dashboard feature inventory

| Feature | Status |
|---------|--------|
| Auth gate → `/login?returnUrl=/dashboard` | ✅ |
| Subscription status (Active / Grace / Frozen) + expiry | ✅ |
| Renew now → `/renew` | ✅ gold CTA |
| Invoice history table (Date / Amount / Status / View) | ✅ |
| View invoice → `/dashboard/invoice/:id` | ✅ |
| Empty / loading invoice states | ✅ |
| Nav: Dashboard · Renew · Logout | ✅ Register hidden when signed in |
| Footer: Privacy / Terms / DPDP · support email | ✅ |

### Tax invoice feature inventory

| Feature | Status |
|---------|--------|
| Auth gate → login | ✅ |
| Invoice / payment ID | ✅ |
| Supplier · Bill to · Date · Description (SAC) | ✅ |
| Supplier GSTIN when present | ✅ preserved (not always in mock) |
| GST breakdown + gold total | ✅ |
| Print | ✅ |
| Back to dashboard | ✅ |
| Nav + legal footer | ✅ |

### Renew feature inventory

| Feature | Status |
|---------|--------|
| Sign-in gate (email/password) | ✅ restyled in same dark shell |
| AUTH_009 → verify email | ✅ |
| AUTH_001 invalid credentials | ✅ |
| No-club → Go to registration | ✅ |
| Status (Active / Grace / Frozen) + current expiry | ✅ green/amber/red dot |
| Monthly / Yearly plan select | ✅ gold selected + Recommended on monthly |
| SAC + GSTIN when present | ✅ |
| GST breakdown + gold total | ✅ |
| Early-renewal unused-time note | ✅ info box |
| Pay with Razorpay | ✅ gold CTA; checkout unchanged |
| Waiting for confirmation | ✅ |
| Success banner after expiry extends | ✅ |
| Plans unavailable / loading | ✅ |
| Nav: Dashboard · Renew · Logout | ✅ Register hidden when signed in; Renew gold underline |
| Footer: Privacy / Terms / DPDP · support email | ✅ |

### Legal pages feature inventory (Privacy / Terms / DPDP)

| Feature | Status |
|---------|--------|
| Full original document copy | ✅ unchanged |
| Effective / last-updated dates (Privacy, Terms) | ✅ |
| DPDP intro disclaimer + purpose table | ✅ |
| In-document links (Privacy ↔ Terms, DPDP see-also) | ✅ |
| Contact email `a3billiards@gmail.com` + Bengaluru address | ✅ |
| On-this-page TOC (all H2s, including extras not in mock) | ✅ |
| Contact us card | ✅ Privacy/Terms jump to Contact section; DPDP mailto |
| Nav Dashboard / Renew / Logout (or Register + Login when signed out) | ✅ |
| Footer Privacy / Terms / DPDP · support@a3billiards.com | ✅ |

---

## Design rules (unchanged)

- UI/animation only — no business logic changes unless user asks
- Reuse `@a3/ui` primitives; never duplicate tokens per app
- Comment `// assumed/extended design` where Figma frame is missing
- **Never remove features because a mock omits them** — see feature inventories
- **Labels name the real feature** — trace each button to its handler; do not reuse mock placeholder text (see `.cursor/rules/ui-redesign-feature-preservation.mdc`)
