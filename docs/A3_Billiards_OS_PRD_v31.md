# PRODUCT REQUIREMENTS DOCUMENT

# A3 Billiards OS

*A3 Billiards OS — A multi-panel SaaS application for billiards club owners, staff, customers, and platform administrators.*

| | |
|---|---|
| **Document Version** | 31.0 — Live Streaming (AWS IVS) Addition |
| **Date** | June 2026 |
| **Status** | Active — supersedes v30 |
| **Stack** | React Native + Expo SDK 55 · Convex · FCM · WhatsApp Business API · Razorpay (web only) · **AWS IVS (NEW in v31)** |
| **Panels** | Admin · Owner · Customer · Onboarding Website |
| **Supersedes** | PRD v30.0 — Walk-In Booking Conflict Alert (June 2026) |
| **Reconciled against** | Code audit of `a3-billiards-os` monorepo, June 2026 ("PRD v2 As-Built"); seven new feature specs layered on top for v25/v26/v27/v28/v29/v30/v31 |

> **ℹ How to read this document:** v24 reconciled PRD v23 with what was actually implemented in the codebase as of June 2026, recording as-built behavior as the new requirement wherever the shipped product diverged from v23. v25 added the Owner App Document Holder (§7.9). v26 added Customer App Directions (§8.2/§8.3.1). v27 added the GST & Tax Report (§7.6.1). v28 added the Kitchen screen and Chef staff role (§7.10). v29 added a Membership Loyalty programme (§7.11/§8.9). v30 added the Walk-In Booking Conflict Alert (§7.12). **v31 adds one new feature: Live Streaming for the Owner App (§7.13) and the corresponding Watch Live feature for the Customer App (§8.10)** — a club owner or authorised staff member can broadcast a live video of a game in progress at their club directly from the Owner App, using **AWS IVS** (Amazon Interactive Video Service) as the streaming platform; any customer, anywhere on the platform, can watch any club's live stream from inside the Customer App — viewing is **not** restricted to customers of that specific club, and there is **no paid subscription or payment gate** in this phase (open to any authenticated customer). This is the platform's first integration with AWS, alongside its existing Firebase (FCM), WhatsApp Business API, and Razorpay integrations. All other sections are unchanged from v30 except where this new feature touches the data architecture (§3.3), Admin Panel (§6), Settings/Staff Role Management (§7.5), RBAC (§7.7), notifications (§9.1), the priority matrix (§12), and the monorepo structure (§13) — each of those touch points is called out explicitly below. Genuinely unfinished or stubbed functionality remains tracked in §15 (Known Issues & Technical Debt).
>
> **⚠ Carried from v27:** The GST & Tax Report (§7.6.1) computes estimates for the owner's own bookkeeping convenience. It is not tax, legal, or accounting advice, and A3 Billiards OS is not a substitute for a qualified Chartered Accountant or tax filing software. This caveat continues to govern that feature unchanged in v31.

---

## 1. Introduction

### 1.1 Purpose

This document defines the complete product requirements for the A3 Billiards OS. It is the single source of truth for design, engineering, and QA teams going forward. It replaces PRD v30 as the canonical reference. v31 adds one new feature (Live Streaming, §7.13 / §8.10) on top of the v30 baseline (which added the Walk-In Booking Conflict Alert, §7.12, on top of v29's Membership Loyalty, §7.11/§8.9, on top of the v28 baseline's Kitchen & Chef Role, §7.10, on top of v27's GST & Tax Report, §7.6.1, on top of v26's Customer Directions, §8.2/§8.3.1, on top of v25's Document Holder, §7.9, on top of the v24 as-built baseline). The existing TDD (v1.8, PRD v30-aligned) remains accurate for everything except this new feature until a corresponding TDD v1.9 is produced against this version.

### 1.2 Product Vision

*Unchanged from v23.* To provide billiards club owners with an all-in-one digital operations platform — covering table management, customer tracking, billing, inventory, and financial reporting — while maintaining a shared customer identity network that gives every club instant access to cross-club customer history and safety flags. A3 Billiards OS also empowers customers to discover clubs, view profiles, and book tables online with owner-approved reservations.

### 1.3 Scope

A3 Billiards OS comprises four surfaces connected to a single Convex backend:

- **A3 Billiards OS Admin App** (React Native / Expo) — Admin Panel only, accessed by platform administrators
- **A3 Billiards OS Owner App** (React Native / Expo) — Owner Panel only, accessed by club owners and staff
- **A3 Billiards OS Customer App** (React Native / Expo) — Customer Panel only, accessed by players; includes club discovery, club profiles, online table booking, and (NEW in v31) cross-club live stream viewing
- **Onboarding Website** (Vite + React) — handles club registration, email verification, subscription, payment, and ongoing subscription management

> **⚠ Correction from v23:** PRD v23 §1.3 described the Onboarding Website as a separate web application "not part of the monorepo." **As built, it lives inside the monorepo** at `apps/onboarding-web` and is built/deployed alongside the three mobile apps via the shared Turborepo pipeline. It still connects to the same Convex backend and is still not a mobile app. This is a packaging correction only — see §13 for the current folder structure.

The Onboarding Website's scope is also broader than v23 specified: in addition to registration and payment, it now includes an owner-facing subscription dashboard (`/dashboard`, `/dashboard/invoice/:id`), `/forgot-password`, and `/verify-email`. See §5. **v31 does not add any new route to the Onboarding Website** — Live Streaming has no payment component in this phase (see §7.13).

### 1.4 Out of Scope

Unchanged from v30, with one addition:

- In-app payment processing inside the mobile apps — payments are record-only in all three mobile apps; booking payments are planned for a future phase; the Onboarding Website handles subscription payments via Razorpay but this is outside the mobile app codebase
- Biometric authentication of any kind
- SMS-based OTP (WhatsApp Business API only for OTP)
- Third-party OTP relay services (e.g. Twilio)
- Multi-club management under a single owner account — each club is a separate account
- Credit outstanding notifications — credit status is visible in the financial tab only
- Booking payment / deposit collection — deferred to Phase 2; bookings are reservation-only in the current phase
- Booking refund processing — deferred to Phase 2 alongside booking payments
- **Light mode and internationalization (i18n)** — dark theme and English-only are intentional product decisions for v1, not yet documented in v23. Carried forward as explicit scope exclusions.
- **(NEW in v25) Document Holder out of scope items** — OCR/text extraction, expiry/renewal tracking, authenticity verification, sharing outside the club, soft-delete/version history, and any customer-facing exposure of club documents. See §7.9 for the full list.
- **(NEW in v26) Directions out of scope items** — in-app turn-by-turn voice navigation, live ETA/traffic updates, multi-stop routing, and walking/transit/cycling mode selection inside the app. The in-app map is a static route **preview** only; live turn-by-turn navigation is handed off to the device's native maps app. See §8.2/§8.3 for the full list.
- **(NEW in v27) GST & Tax Report out of scope items** — actual GST/income-tax filing or submission to any government portal, multi-state/multi-GSTIN apportionment, asset-level depreciation schedules, partner-remuneration deduction modeling under Section 40(b), surcharge-slab automation, and any guarantee of statutory accuracy. The feature produces **estimates for internal bookkeeping convenience only** — see §7.6.1 for the full list and the governing disclaimer.
- **(NEW in v28) Kitchen & Chef Role out of scope items** — per-item order tracking, kitchen prep-time analytics/estimates, multiple kitchens or kitchen-station routing per club, a "Pending" → "Preparing" auto-transition, and any customer-facing visibility into kitchen/order status. See §7.10 for the full list.
- **(NEW in v29) Membership Loyalty out of scope items** — monetary-value vouchers or cash-back, cross-club loyalty redemption, loyalty tier stacking, automatic credit transfer on account deletion, points-decay or expiry for unused credits, a public-facing loyalty marketing page, and any customer-initiated loyalty enrolment or opt-out. See §7.11 for the full list.
- **(NEW in v30) Walk-In Booking Conflict Alert out of scope items** — automatic blocking of a walk-in session start, automatic cancellation/rescheduling/rejection of the conflicting booking, a push/FCM version of the alert, per-table custom buffer values, conflict detection against other walk-ins or unconfirmed bookings, and audit logging/analytics of the alert. See §7.12 for the full list.
- **(NEW in v31) Live Streaming out of scope items** — a paid subscription, pay-per-view, or any payment gate for watching a live stream (viewing is free for any authenticated customer in this phase); video-on-demand (VOD) playback, recording, or rewind of past streams (live-only); in-stream chat, reactions, likes, or any real-time viewer interaction; live thumbnail/preview-frame capture (the discovery list shows the club's existing static profile image instead); more than one simultaneous active stream per club; scheduled/"starts at" stream announcements; multi-camera or external-camera broadcasting (phone camera only, via the in-app broadcast SDK); customer-initiated stream reporting/flagging (moderation in this phase is admin force-end only); and automatic inclusion of customer- or session-identifying data in a stream's public title/metadata. See §7.13 / §8.10 for the full list.

### 1.5 Definitions & Abbreviations

Unchanged from v30, with additions:

| Term | Definition |
|---|---|
| Card | A physical card terminal payment recorded by staff at checkout. No in-app card processing occurs; no card data is stored or transmitted. |
| Owner | A club owner or authorised staff member using the Owner Panel. Each club has its own separate account. |
| Customer | An end-user / player who books and plays at a club |
| Admin | A platform-level administrator with global access |
| Session | A single table booking from start to checkout/billing |
| Slot | A physical billiards table available for booking |
| Booking | An online reservation request made by a customer for a specific table type, date, time, and duration at a club. Requires owner approval before confirmation. |
| Complaint | A flag filed by an owner against a customer. Four types: Violent Behaviour, Theft, Runaway Without Payment, Late Credit Payment. |
| Settings Passcode | A 6-digit PIN separate from the login password; gates the Settings panel **and gates the return path from Staff mode back to Owner mode** (see §4.3, §7.7). |
| Club Document | **(NEW in v25)** A scanned/photographed image of a physical document belonging to the club, stored against a label and optional notes in the Owner App's Document Holder section (see §7.9). |
| Document Label | **(NEW in v25)** The category attached to a Club Document. Selected from a predefined list or entered as a free-text custom label. See §7.9. |
| Directions | **(NEW in v26)** The customer-facing feature that shows an in-app map preview of the route from the customer's current device location to a selected club, plus a handoff button that opens the device's native maps app for full turn-by-turn navigation. See §8.2, §8.3. |
| GST & Tax Report | **(NEW in v27)** An owner-facing report inside the Financial Tab that derives a GST breakdown and a full P&L for a chosen period. Estimate-only; not a filing tool. See §7.6.1. |
| Tax Settings | **(NEW in v27)** A new Settings sub-section holding the per-club inputs the GST & Tax Report needs. See §7.6.1. |
| Chef | **(NEW in v28)** A staff role variant with `allowedTabs` restricted to `kitchen` only. See §7.10. |
| Kitchen Order | **(NEW in v28)** A grouped record of one or more snack items added to a session at the same time, tracked through a 4-state lifecycle (Pending → Preparing → Ready → Served). See §7.10. |
| Loyalty Programme | **(NEW in v29)** A per-club configuration (one active programme at a time) that defines one or more Loyalty Tiers. When enabled, the system automatically tracks each customer's qualifying play-time and awards free-visit credits when thresholds are met. See §7.11. |
| Loyalty Tier | **(NEW in v29)** A single rule within a Loyalty Programme specifying a qualifying window, a play-time threshold, and a number of free-visit credits awarded. See §7.11. |
| Free-Visit Credit | **(NEW in v29)** A single-use entitlement awarded to a customer by the loyalty system, covering the table/time charge for one session up to a configured maximum duration. See §7.11. |
| Loyalty Ledger | **(NEW in v29)** The per-customer, per-club record tracking play-time, credits earned, credits redeemed, and current available credit balance. See §7.11 / §3.3. |
| Walk-In Session | **(NEW in v30)** A session started at a club without an associated online `Booking`. See §7.12. |
| Walk-In Conflict Buffer | **(NEW in v30)** The owner-configurable number of minutes before a confirmed booking's start time during which starting a walk-in session on that table triggers a Walk-In Conflict Alert. See §7.12. |
| Walk-In Conflict Alert | **(NEW in v30)** The in-app pop-up shown when starting a walk-in session on a table with a near-term confirmed booking. Advisory only. See §7.12. |
| **Live Stream** | **(NEW in v31)** A real-time video broadcast of an in-progress game at a club, initiated from the Owner App by the owner or an authorised staff member, delivered via AWS IVS, and viewable by any customer in the Customer App regardless of which club they are associated with. See §7.13 / §8.10. |
| **IVS Channel** | **(NEW in v31)** The persistent AWS Interactive Video Service channel provisioned for a club — one channel per club, reused for every stream that club broadcasts. Comprises an ingest endpoint (used by the broadcaster), a stream key (secret, used to authenticate the broadcast), and a playback endpoint (used by viewers). See §7.13. |
| **Stream Access Token** | **(NEW in v31)** A short-lived, server-signed token issued to the Customer App when a customer opens a live stream, required by the club's IVS Channel (configured as a "private" channel) to authorize playback. Issued to any authenticated customer on request — it is an access-control mechanism, not a payment gate. See §8.10. |
| FCM | Firebase Cloud Messaging — push notification delivery service |
| OTP | One-Time Password — 6-digit code for phone number verification |
| Central DB | The shared Convex database accessible across all clubs (users, complaints, notifications, bookingLogs) |
| Club DB | Per-club Convex data namespace (sessions, tables, snacks, financials, bookings) |
| Admin App | Standalone React Native app (A3 Billiards OS Admin) for platform administrators only |
| Owner App | Standalone React Native app (A3 Billiards OS Owner) for club owners and staff |
| Customer App | Standalone React Native app (A3 Billiards OS Customer) for players |
| Onboarding Website | A web application inside the monorepo for new club owner registration, email verification, subscription selection, payment, and subscription management. Connects to the same Convex backend. Not a mobile app. |

---

## 2. User Personas & Goals

Unchanged from v23.

| Persona | Role | Primary Goal | Key Pain Points Solved |
|---|---|---|---|
| Club Owner | Runs one or more billiards venues | Streamline table booking, billing, and reporting | Manual billing errors, no customer history, cash leakage |
| Staff / Cashier | Operates front desk | Quickly book, track, and check out sessions | Complex software, no role restrictions |
| Customer / Player | Visits clubs to play billiards | Discover clubs, book tables online, seamless check-in, view own history | No club discovery, no online booking, no booking confirmation, lost receipts |
| Platform Admin | Manages all clubs and users | Oversee platform health, handle disputes | No cross-club visibility, manual support |

---

## 3. System Architecture Overview

### 3.1 Application Structure

> **ℹ Note:** A3 Billiards OS is delivered as three React Native applications (Admin App, Owner App, Customer App) plus the Onboarding Website, **all in one Turborepo/pnpm monorepo**. All four surfaces share one Convex backend. Each club is a fully independent account — there is no multi-club management under one login.

| App | Panels Included | Users |
|---|---|---|
| Admin App | Admin Panel | Platform administrators |
| Owner App | Owner Panel | Club owners and staff |
| Customer App | Customer Panel + Club Discovery + Online Booking + (NEW in v31) Watch Live | Players / end-users |
| Onboarding Website | Club registration + email verification + payments + subscription dashboard | Prospective and existing club owners |

### 3.2 Technology Stack

Unchanged from v28 §3.2 in full, **plus AWS IVS (NEW in v31)** as the live-video transport layer — see §7.13 / TDD v1.9 §6 for integration detail. AWS IVS is the platform's first AWS service; everything else in §3.2 (Firebase/FCM, WhatsApp Business API, Razorpay) remains as previously documented.

### 3.3 Data Architecture

Unchanged from v28. Two logical data namespaces exist in Convex: the Central Database (shared across all clubs) and per-Club Databases (strictly isolated per owner). No club can access another club's operational data.

| Namespace | Tables | Access |
|---|---|---|
| Central DB | users, complaints, adminNotifications, passwordResetTokens, adminMfaCodes, otpRecords, sessionLogs, bookingLogs, paymentReceipts, **liveStreamModerationLog (NEW in v31 — see §7.13)** | Admin (full), Owners (read for customer lookup & complaints), Customers (own session log records and booking log records only) |
| Club DB (read-only aggregates) | Revenue summaries only. **(NEW in v31) Live stream discovery fields only — see note below.** | Admin can query per-club revenue totals via a dedicated server function; raw session, billing, and table data remain inaccessible to admin. **Customers can query a platform-wide list of currently active live streams (club name, club banner image, stream title, optional table reference, start time, best-effort viewer count) via a dedicated server function (NEW in v31) — no other club-operational data is exposed through this query, and no club-isolation rule is otherwise weakened.** |
| Club DB | clubs, tables, sessions, snacks, staffRoles, bookings, cancellationCounts, customerBookingStats, clubDocuments (NEW in v25 — see §7.9), taxSettings, taxReportRequests (NEW in v27 — see §7.6.1), kitchenOrders (NEW in v28 — see §7.10), loyaltyProgrammes, loyaltyTiers, loyaltyLedgers, loyaltyCredits (NEW in v29 — see §7.11), **liveStreams (NEW in v31 — see §7.13)** | Owner and their staff only. Completely isolated from other clubs. |

> **ℹ New in v31:** The `clubs` table (already listed in the Club DB row above) gains four new optional fields — `ivsChannelArn`, `ivsIngestEndpoint`, `ivsStreamKeyArn`, `ivsPlaybackUrl` — to support Live Streaming (§7.13). These are provisioned automatically the first time a club goes live; no manual setup is required from the owner. The `ivsStreamKeyArn` field is **never** returned by any query reachable from the Customer App, and is only resolvable to an actual stream key server-side, on demand, for the owner/staff member actively starting a broadcast. See §10.

---

## 4. Authentication & Security

Unchanged from v28 §4 in full.

---

## 5. Onboarding Website

Unchanged from v28 §5 in full. **v31 adds no new route** — Live Streaming has no payment or web-checkout component in this phase (§7.13).

---

## 6. Admin Panel

Unchanged from v28 §6 in full. Platform Admins do **not** have visibility into a club's Loyalty Programme configuration, Loyalty Ledger data, or individual customer credit balances, or a club's Walk-In Booking Conflict Alert configuration — consistent with the existing Club DB access model (§3.3).

> **ℹ New in v31 — Live stream moderation:** Because Live Streaming exposes any club's broadcast to any customer platform-wide (§7.13/§8.10), Admin gains a new, narrowly-scoped capability: a live, platform-wide list of every currently active stream (club name, owner/staff who started it, title, start time, best-effort viewer count), and a **Force-End Stream** action. Force-ending requires the admin to enter a short reason (free text, required, logged) and immediately terminates the broadcast at the AWS IVS level (not just a status flag) — the broadcaster's app receives a disconnect and must explicitly start a new stream to resume. Every force-end is recorded in the new `liveStreamModerationLog` (Central DB, §3.3) for audit. Admin does **not** gain any other live-streaming capability — Admin cannot start a stream, cannot view a club's stream history beyond the moderation log, and cannot access AWS IVS console credentials through the app.

---

## 7. Owner Panel

The Owner Panel is the core operational interface. All features below are scoped to the owner's club. Staff members access a restricted subset based on their assigned role.

### 7.1 Home Page

Unchanged from v28 §7.1.

### 7.2 Slot Management

Unchanged from v28 §7.2, with two additions (§7.11 free-visit redemption, NEW in v29; §7.12 walk-in conflict alert, NEW in v30) — both carried forward unchanged from v30. Live Streaming (§7.13) does not touch Slot Management — a stream is started from its own dedicated tab, not from the table grid, since a stream is a broadcast of whatever the owner points the camera at, not a system-tracked link to a specific session.

### 7.3 Customer Complaints

Unchanged from v28 §7.3.

### 7.4 Snacks

Unchanged from v28 §7.4.

### 7.5 Settings

Unchanged from v30 §7.5, with one addition:

> **ℹ New in v31:** Live Streaming requires **no new Settings sub-section**. A club's AWS IVS channel is provisioned automatically, transparently, the first time anyone at that club taps "Go Live" — there is nothing for the owner to configure in advance. The only Settings touch point is **Staff Role Management**, which gains one new `allowedTabs` value (`livestream`) so the owner can decide which staff, if any, are trusted to broadcast on the club's behalf.

- **Table Management** — unchanged from v28.
- **Rate Configuration** — unchanged from v28.
- **Staff Role Management** — create named roles, assign `allowedTabs` (`slots`, `snacks`, `financials`, `complaints`, `bookings`, `documents` (NEW in v25), `kitchen` (NEW in v28), `loyalty` (NEW in v29), **`livestream` (NEW in v31 — see §7.13)** — at least one required), optionally restrict to specific table IDs, set `canFileComplaints` / `canApplyDiscount` / `maxDiscountPercent`, delete roles (active-role deletion reverts the device to unrestricted owner mode automatically).
- **Online Booking Settings** — unchanged from v28, plus two fields added in v30 (walk-in conflict alert toggle and buffer minutes, §7.12).
- **Club Profile Management** — unchanged from v28.
- **Security Settings** — unchanged from v28.
- **Tax Settings (NEW in v27)** — unchanged from v28.
- **Loyalty Programme (NEW in v29)** — see §7.11 for the full configuration fields and behaviour.

### 7.6 Financial Tab

Unchanged from v28 §7.6 in full, including the GST & Tax Report sub-screen (§7.6.1) and the v29 free-visit session reporting note. Live Streaming has no Financial Tab footprint — it carries no charge, so nothing is billed or reported.

### 7.7 Role-Based Access Control

Unchanged from v28 §7.7, with one addition:

> **ℹ New in v31:** `livestream` is introduced as a ninth `allowedTabs` value, gated through the exact same mechanics as every other tab — tab bar filtering, "Access restricted" fallback, and per-call server-side `allowedTabs` enforcement. A staff role with `livestream` access can start and end broadcasts on the club's behalf, exactly as the owner can. A staff role without `livestream` does not see the Live Stream tab at all. There is no further granularity in this phase — `livestream` access is all-or-nothing per staff role, with no separate "view-only" tier (there is nothing to view on the Owner App side beyond the broadcast controls themselves).

### 7.8 Online Booking Management

Unchanged from v28 §7.8.

### 7.9 Document Holder

Unchanged from v28 §7.9.

### 7.10 Kitchen & Chef Role

Unchanged from v28 §7.10.

### 7.11 Membership Loyalty

Unchanged from v29 §7.11 in full.

> **ℹ Note:** This is a previously-introduced feature (v29). It gives club owners a configurable loyalty programme that rewards regular customers with free visits based on how much time they spend playing at the club within a given period. The owner decides the rules; the system tracks automatically and awards credits without manual intervention. Redemption is a deliberate, point-of-sale action by the owner or staff at session start.

---

#### Concept

- **One active Loyalty Programme per club at a time.** A club may have only one enabled (`status: 'active'`) Loyalty Programme at any moment. Programmes can be archived (preserving historical ledger data) and a new one created, but two programmes cannot be simultaneously active.
- **Tiers within a programme.** A programme contains one or more Loyalty Tiers. Each tier is an independent rule: if a customer accumulates at least `thresholdMinutes` of play-time within a rolling `windowDays`-day window, they are awarded `creditsAwarded` free-visit credits. Multiple tiers allow progressive rewards (e.g. Tier 1: 300 min in 30 days → 1 credit; Tier 2: 600 min in 30 days → 3 credits).
- **Per-customer, per-club tracking.** Each enrolled customer has a Loyalty Ledger record at a given club (created automatically on their first session after the programme is activated), tracking their cumulative play-time in the current window, and their credit balance.
- **Free visit = one session's table/time charge waived, up to a configured cap.** A free-visit credit covers the `tableSubtotal` (post-discount table charge) for one session up to a maximum duration configured per programme (`freeVisitMaxMinutes`). If the session runs longer than `freeVisitMaxMinutes`, only the portion up to that cap is waived; additional minutes are billed at the normal rate. Snacks are always billed normally regardless of free-visit status.
- **Loyalty is per-club.** Credits earned at one club cannot be redeemed at any other club. This is enforced server-side by scoping all loyalty tables to `clubId`.

---

#### Loyalty Programme Configuration (Owner-only, in Settings — §7.5)

**Programme-level fields**

| Field | Detail |
|---|---|
| Programme name | Free-text label shown to staff and customers (e.g. "A3 Regulars Club"). Required. ≤60 characters. |
| Status | `active` or `archived`. Only one programme may be `active` per club at a time. Toggling an active programme to `archived` freezes new credit awards (existing balances remain redeemable until the owner explicitly resets them — see "Archiving" below). |
| Free-visit maximum duration | `freeVisitMaxMinutes` — the maximum session length (in minutes) fully covered by one free-visit credit. Beyond this duration, normal billing applies to the overage. Owner-configurable; must be ≥ the club's `minBillMinutes` (§7.5 Rate Configuration). |
| Free-visit applies to | Fixed in this phase: table/time charge only (`tableSubtotal`). Snacks are always billed. This is not configurable. |

**Tier-level fields** (one or more tiers per programme)

| Field | Detail |
|---|---|
| Tier name | Free-text label (e.g. "Bronze", "Gold"). Required. ≤40 characters. |
| Qualifying window | `windowDays` — the rolling look-back period in days (e.g. 30). The system always looks back `windowDays` days from the date of each session end to compute cumulative play-time. Must be 1–365. |
| Play-time threshold | `thresholdMinutes` — the minimum cumulative play-time (in minutes) a customer must accumulate within `windowDays` days to reach this tier and earn its reward. Must be > 0. Across tiers in the same programme, thresholds must be unique (two tiers with identical thresholds are rejected). |
| Credits awarded | `creditsAwarded` — the number of free-visit credits given when a customer crosses this tier's threshold. Must be ≥ 1. |

> **⚠ Tier threshold ordering:** Tiers are evaluated from lowest to highest threshold at the moment a session ends. A customer can satisfy multiple tiers in a single period. Credits are awarded **once per tier crossing** — not repeatedly each session. The system tracks the highest tier each customer has reached in the current window, and awards credits only when they cross from below a tier's threshold to at or above it. If a customer already reached Tier 1 last week and their cumulative time now also crosses Tier 2, they receive Tier 2's `creditsAwarded` (not Tier 1 again, and not Tier 1 + Tier 2). This "highest reached tier, incremental awards on new crossings" model avoids double-awarding. Full mechanics are in the Ledger section below.

**Validation**

| # | Check | Behavior |
|---|---|---|
| 1 | Programme name required | Cannot save without a name. |
| 2 | At least one tier | A programme with no tiers cannot be activated. It may be saved as a draft (`status: 'draft'`) without tiers for in-progress editing, but activation requires ≥ 1 tier. |
| 3 | Duplicate tier thresholds | Two tiers within the same programme with the same `thresholdMinutes` are rejected with an inline error. |
| 4 | `freeVisitMaxMinutes` ≥ `minBillMinutes` | The free-visit duration cap must be at least the club's minimum billable minutes; otherwise a free-visit session would be impossible to start cleanly. |
| 5 | Only one active programme | Attempting to activate a second programme while one is already active is rejected with a prompt to archive the current active programme first. |
| 6 | `windowDays` 1–365 | Out-of-range values rejected. |
| 7 | `thresholdMinutes` > 0, `creditsAwarded` ≥ 1 | Rejected with inline errors otherwise. |

**Archiving a programme**

When the owner archives an active programme:
- `status` is set to `archived`; no new credits are awarded from this point forward.
- Existing credit balances on all customer Loyalty Ledger records for this club remain intact and continue to be redeemable until explicitly reset by the owner (a separate "Reset all credit balances" action in Settings, requiring passcode confirmation) or until the individual credits are used.
- A new programme can be created and activated immediately after archiving.
- Archived programmes are visible in a collapsible "Archive" list in Settings for reference.
- Ledger records, credit-award logs, and redemption logs tied to the archived programme are preserved indefinitely for the owner's reference.

---

#### Enrolment

- Enrolment is **automatic and silent**: when a verified (non-guest) customer completes their first session at a club while an active loyalty programme exists, a `loyaltyLedger` record is created for that (customer, club) pair if one does not already exist.
- There is no opt-in or opt-out for customers in this phase. All customers are tracked equally under the active programme.
- Anonymous/guest sessions (sessions started without a linked `userId`) do **not** generate or update any loyalty ledger record. The programme applies to identifiable customers only.
- If a programme is activated after a customer has already visited the club, their ledger is created on their **next** session — there is no back-fill of historical sessions into the loyalty ledger. This is an intentional scope decision (back-filling would require re-processing potentially years of session history with complex window semantics); the ledger is forward-looking from the programme activation date.

---

#### Play-Time Tracking and Credit Award Logic

This logic runs **server-side at the moment a session is checked out** (i.e. when `sessions.status` transitions to `paid` or `credit`). It is not a scheduled cron job — it is triggered synchronously as a side-effect of the existing checkout mutation, following the same deferred-action pattern used for FCM notifications (fire-and-forget via `ctx.scheduler.runAfter(0, …)` so it does not block or slow the checkout).

**Step 1 — Compute billable play-time for the completed session**

Use `sessions.billableMinutes` (already computed at checkout by the existing billing formula, §7.2 Billing & Checkout) as the play-time contribution for this session. This is the same figure the customer is billed for (or would be billed for, in the case of a free-visit session where `tableSubtotal` is zero but `billableMinutes` is still recorded accurately).

**Step 2 — Check if the customer has a Loyalty Ledger at this club**

If not, create one (automatic enrolment, as above). If yes, proceed.

**Step 3 — Compute cumulative play-time in the active programme's window(s)**

For each tier in the active programme, the qualifying window is a rolling look-back of `windowDays` days from the session's `endTime`. Query the `loyaltyPlayLog` (a lightweight append-only log of `{ sessionId, userId, clubId, endTime, billableMinutes }` entries) for all entries for this customer at this club with `endTime` within `[now − windowDays * 86400s, now]`, sum `billableMinutes`, and add the current session's contribution to get `cumulativeMinutesInWindow`.

> **ℹ Why a separate `loyaltyPlayLog` instead of querying `sessions` directly?** The `sessions` table's indexes are optimised for table-grid and billing queries, not for per-customer time-range aggregations across potentially many sessions. A dedicated, lightweight append-only log with an index on `(clubId, userId, endTime)` allows the loyalty credit-award query to remain fast as session history grows, without touching the hot `sessions` table. The log entry is inserted as part of the same checkout side-effect action that evaluates credit awards.

**Step 4 — Evaluate tier crossings and award credits**

For each tier (evaluated in ascending threshold order):
- If `cumulativeMinutesInWindow >= tier.thresholdMinutes` and the customer's `loyaltyLedger.highestTierReachedId` for this window-epoch is below this tier's rank → this is a new crossing. Award `tier.creditsAwarded` credits.
- Update `loyaltyLedger.highestTierReachedId` to this tier.
- Insert one or more `loyaltyCredit` records (one per free-visit credit awarded) with `status: 'available'`.
- Insert a `loyaltyCreditAwardLog` record for audit purposes (which tier triggered the award, how many credits, at what cumulative time).

> **ℹ Window epoch tracking:** Each tier's qualifying window is a rolling `windowDays`-day look-back, not a fixed calendar period. Because windows are rolling and different tiers may have different `windowDays`, the `highestTierReachedId` tracking must be per-window-epoch. A "window epoch" for a given tier is defined by the date range `[sessionEndTime − windowDays * 86400s, sessionEndTime]`. To avoid over-awarding when a customer's cumulative time temporarily dips below a threshold (e.g. because old sessions roll out of the window) and then rises again, the system records the `awardedAt` timestamp on each `loyaltyCreditAwardLog` and checks: has the customer already been awarded credits for this tier within the last `windowDays` days? If yes, skip the award for this crossing. This ensures one award per tier per window, not one award per session that happens to be above threshold.

**Step 5 — Notify the customer (optional FCM push)**

If credits were awarded in Step 4, send an FCM push notification to the customer's registered `fcmTokens` congratulating them and stating how many credits they've earned and how many they now have in total. This notification is customer-facing (unlike the Kitchen Ready notification which is owner-facing). If the customer has no FCM token, fail silently, consistent with the existing pattern (§9.1).

---

#### Free-Visit Credit Redemption

**Who can redeem:** The owner, or any staff member with `loyalty` in their `allowedTabs` (§7.5, §7.7). A staff member without `loyalty` access does not see credit balance information or the redemption option during session start.

**When redemption is offered:** During the "Start a Session" flow (§7.2), immediately after a verified customer is looked up and confirmed (via phone lookup, existing-customer auto-fill), the system checks whether the customer has `availableCredits > 0` on their Loyalty Ledger at this club. If yes, a "Redeem Free Visit (X credits available)" option is presented alongside the normal "Start Session" button.

**Redemption flow:**

| # | Step | Detail |
|---|---|---|
| 1 | Credit check | System fetches `loyaltyLedger.availableCredits` for this customer at this club. If 0, no option is shown. |
| 2 | Owner/staff taps "Redeem Free Visit" | A confirmation dialog shows: customer name, credits available, credit being consumed (always 1 per session), and the `freeVisitMaxMinutes` cap ("This free visit covers up to X minutes. Time beyond X minutes will be billed normally."). |
| 3 | Confirm | Owner/staff confirms. |
| 4 | Session starts | Session is created with `isFreeVisit: true`, `freeVisitCreditId` (the specific `loyaltyCredit._id` being consumed), and `freeVisitMaxMinutes` copied from the programme at the time of redemption (so a later programme edit does not affect an in-progress session). |
| 5 | Credit status update | The `loyaltyCredit` record's `status` is set to `'reserved'` immediately on session start (not `'redeemed'` yet), preventing it from being offered again during the session window. |
| 6 | Checkout | At checkout, the billing formula is applied as normal, **except** that `tableSubtotal` is set to zero for the portion of `billableMinutes` up to `freeVisitMaxMinutes`. If `billableMinutes > freeVisitMaxMinutes`, the overage is billed at the normal rate. The final `FINAL BILL` = `max(0, tableSubtotal for overage minutes) + snackTotal`. |
| 7 | Final credit status | On successful checkout, `loyaltyCredit.status` is set to `'redeemed'`, `redeemedAt` is set, and `loyaltyLedger.availableCredits` is decremented by 1. A `loyaltyCreditRedemptionLog` record is inserted for audit. |
| 8 | Session abandoned / cancelled | If a session with a `reserved` credit is cancelled (force-ended without billing), the `loyaltyCredit.status` is reverted to `'available'` so the credit is not lost. |

**One credit per session:** Regardless of how many credits a customer has, only one free-visit credit may be applied per session. This is enforced both in the UI (only one redemption option is shown, clearly consuming 1 credit) and server-side (the `startSession` mutation rejects a request with `isFreeVisit: true` if `freeVisitCreditId` is already `'reserved'` or `'redeemed'`).

**Discount interaction:** A free-visit redemption and a manual discount cannot both be applied to the same session's table charge. If `isFreeVisit: true`, the discount field is disabled at the UI layer and the server-side discount validation rejects `discountPercent > 0` on a free-visit session. Snack discounts, if any, are not affected (snacks are not covered by the free-visit credit regardless).

---

#### Owner Loyalty Dashboard (in the Owner App)

The `loyalty` tab in the Owner App (visible to the owner always, and to staff with `loyalty` in their `allowedTabs`) provides:

**Programme Overview** — programme name, status (Active / Archived / None configured), tiers summary, total credits awarded to date, total credits redeemed to date.

**Customer Loyalty List** — a searchable list of all customers who have a Loyalty Ledger at this club, showing:
- Customer name and phone
- Tier currently active (the highest tier they have reached in the latest window)
- Cumulative play-time in the current window
- Available credits
- Lifetime credits earned / redeemed

Tapping a customer opens a **Loyalty Detail** view showing their full ledger history: each award event (date, tier, credits awarded, cumulative minutes at time of award) and each redemption event (date, session reference, credit used).

**Manual credit adjustment (owner-only):** The owner (not staff, even with `loyalty` access) can manually add or deduct credits from a customer's balance, with a required reason note (≤200 characters). This is for edge-case correction only (e.g. a session that was force-ended before billing could update the ledger correctly). Manual adjustments are logged in `loyaltyCreditAwardLog` with `source: 'manual'` and the reason text.

---

#### Customer App Visibility (§8.9)

Customers can see their own loyalty status at each club they've visited — see §8.9 for the full specification of what is surfaced in the Customer App.

---

#### Validation Summary

| # | Check | Behavior |
|---|---|---|
| 1 | Redemption on anonymous/guest session | Blocked server-side; `isFreeVisit` rejected if `session.userId` is null. |
| 2 | Redemption when `availableCredits === 0` | Blocked server-side; `loyaltyCredit` lookup returns nothing with `status: 'available'`. |
| 3 | Two credits on one session | Blocked; only one `loyaltyCredit` may be `'reserved'` per session. |
| 4 | Discount + free visit on same session | Blocked; `discountPercent > 0` rejected server-side when `isFreeVisit: true`. |
| 5 | Credit not from this club | Blocked; server-side `clubId` scoping on `loyaltyCredit` ensures cross-club redemption is impossible. |
| 6 | Credit award when no active programme | Skipped; the checkout side-effect action checks `loyaltyProgramme.status === 'active'` before doing any ledger work. |
| 7 | Credit award for guest session | Skipped; `session.userId` null check before ledger work. |
| 8 | Overage billing on free-visit session | Applied automatically at checkout; `billableMinutes > freeVisitMaxMinutes` triggers normal rate for the surplus. |
| 9 | Session cancellation with reserved credit | Credit reverted to `'available'`; no credit is lost. |
| 10 | Club scoping | All loyalty tables are scoped to `clubId` server-side — no cross-club visibility by owner, staff, or admin. |

---

#### Admin Visibility

Platform Admins do **not** have visibility into a club's Loyalty Programme configuration, Loyalty Ledger records, or individual customer credit balances, consistent with the existing Club DB access model (§3.3).

---

#### Out of Scope

- Monetary-value vouchers, cash-back, or any monetary equivalent of a free-visit credit. Credits represent a single session's table charge waiver only.
- Cross-club loyalty redemption — credits are strictly per-club and cannot be transferred or redeemed elsewhere.
- Loyalty tier stacking or combining multiple credits on a single session — one credit per session, always.
- Automatic credit expiry or points-decay for unused credits in this phase. Unused credits persist indefinitely until redeemed, manually adjusted, or the programme is archived and balances are reset.
- Customer-initiated loyalty enrolment or opt-out — enrolment is automatic and silent on first session under an active programme.
- A public-facing loyalty marketing/landing page.
- Back-filling historical sessions into loyalty ledger records when a new programme is activated — the ledger is forward-looking from activation date only.
- Loyalty tier evaluation for sessions that were recorded before the programme was activated, even if they fall within the new programme's `windowDays` look-back — only sessions that complete **after** the programme is activated contribute to the play-log and ledger.
- Per-customer programme opt-out by the owner (all enrolled customers are evaluated equally; the owner cannot exclude individual customers in this phase).
- Snack spend as a loyalty qualifier — only table play-time (`billableMinutes`) counts toward thresholds.
- Multiple simultaneous active programmes at one club.

### 7.12 Walk-In Booking Conflict Alert

Unchanged from v30 §7.12 in full, reproduced below for completeness.

> **ℹ Note:** This feature was introduced in v30. It protects against the common front-desk scenario where a walk-in customer is seated at a table that a different, already-confirmed online or owner-made booking is about to need. The owner decides how much advance warning they want; the system surfaces the conflict at the exact moment it matters — when staff are about to seat the walk-in — without ever blocking their decision.

---

#### Concept

- **Advisory, not preventive.** The alert never blocks a walk-in session from starting. It exists purely to inform the owner or staff so they can make an informed choice — proceed anyway, choose a different table, or go manage the conflicting booking.
- **Scoped to confirmed bookings only.** Only bookings with `status: 'confirmed'` (i.e. already owner-approved, per the existing Booking definition in §1.5) are considered. Pending, rejected, and cancelled bookings never trigger the alert.
- **One buffer setting per club.** The owner sets a single `walkInConflictBufferMinutes` value (default 30, range 5–120) that applies uniformly to every table at the club. There is no per-table override in this phase.
- **Triggered only for true walk-ins.** The check only runs when the session being started has no associated `bookingId` — i.e. the customer is not checking in for their own existing reservation. A customer arriving to fulfil their own booking never sees or triggers this alert.
- **In-app and synchronous.** The alert is a pop-up shown at the moment of the table-tap action in Slot Management, while the owner or staff member is already present in the app. It is not delivered as a push notification — see §9.1.

---

#### Configuration (Owner-only, in Settings → Online Booking Settings — §7.5)

| Field | Detail |
|---|---|
| Walk-in conflict alerts enabled | `walkInConflictAlertsEnabled` — boolean toggle. Default `true` for every club, including clubs that existed before v30 (treated as `true` when absent — no migration required). When `false`, the table grid and session-start flow behave exactly as they did before v30; no badge or pop-up ever appears. |
| Walk-in conflict buffer | `walkInConflictBufferMinutes` — integer, minutes. Default `30`. Owner-configurable, range **5–120 minutes**. Defines how close to a confirmed booking's start time a table can be before starting a walk-in on that table triggers the alert. |

**Validation**

| # | Check | Behavior |
|---|---|---|
| 1 | Buffer out of range | Values outside 5–120 minutes are rejected with an inline error. |
| 2 | Owner-only | Both fields are editable only by the owner, via the same `requireOwner`-gated mutation used for the rest of Online Booking Settings. Staff never see these fields, consistent with Settings being fully inaccessible in Staff mode (§7.7). |

---

#### Detection & Alert Flow

| # | Step | Detail |
|---|---|---|
| 1 | Table grid loads | While Slot Management is open, the system continuously knows, for every table, the nearest upcoming `confirmed` booking's start time (if any), reflected live as bookings are created, approved, or cancelled. |
| 2 | Buffer comparison | For each table with an upcoming confirmed booking, the system compares that booking's start time against "now." If the booking starts within `walkInConflictBufferMinutes` minutes, the table is flagged. This comparison is re-evaluated as time passes (not only when booking data changes), so a table can become flagged purely because the clock has advanced closer to the booking's start time — see the design note below. |
| 3 | Visual indicator | Flagged tables show a small badge on their table card in the grid (e.g. "Booking in 12 min"), visible to anyone with `slots` access, even before they tap anything. |
| 4 | Owner/staff taps a flagged, available table to start a session | If the session being started has no `bookingId` (i.e. it's a walk-in), a Walk-In Conflict Alert pop-up is shown **before** the normal Start Session form opens. |
| 5 | Pop-up content | Shows: the conflicting booking's customer name and phone, the booking's table and start time, and how many minutes remain ("Booking starts in 12 minutes for [Customer Name]") — or, if the booking's start time has already passed without check-in, "This booking was due to start at [time]." |
| 6 | Owner/staff chooses an action | **"Start Walk-In Anyway"** — proceeds to the normal Start Session flow exactly as it works today; no new field is set on the resulting session, no record of the override is kept. **"Choose Another Table"** — closes the pop-up and returns to the table grid with no table selected. **"View Booking"** (optional convenience) — navigates to the booking's detail in Online Booking Management (§7.8), e.g. to cancel it if the owner decides the walk-in should take priority. |
| 7 | Tapping a non-flagged table, or alerts disabled club-wide | Proceeds directly to Start Session exactly as before v30 — zero behavior change. |
| 8 | Tapping a table to check in a customer's own booking (`bookingId` present) | The conflict check is skipped entirely — this is not a walk-in. |

> **ℹ Design note — why the alert can appear without any new data being written:** Unlike most reactive features in this product, a table becoming "flagged" can happen purely from the passage of time (a booking that was 45 minutes away becomes 25 minutes away, crossing a 30-minute buffer) without any underlying booking record changing. The client re-evaluates the buffer comparison periodically (not just when booking data changes) so the badge and alert stay accurate without requiring staff to refresh the screen. See TDD v1.8 §4.9 for the implementation approach.

---

#### Validation Summary

| # | Check | Behavior |
|---|---|---|
| 1 | Alerts disabled for the club | No badge, no pop-up, ever — identical to pre-v30 behavior. |
| 2 | No confirmed booking within the buffer for a table | No badge or pop-up for that table. |
| 3 | Booking is `pending` (not yet owner-approved) | Excluded — only `confirmed` bookings count. |
| 4 | Booking is `cancelled`, `rejected`, or already fulfilled/checked-in | Excluded. |
| 5 | Multiple confirmed bookings on one table within the buffer | The alert shows only the soonest one. |
| 6 | "Start Walk-In Anyway" selected | The walk-in session starts exactly as the existing flow (§7.2) — no new session field, no blocking, no special billing. |
| 7 | Table already occupied (session in progress) | Not applicable — occupied tables are not tappable to start a new session today, with or without this feature. |
| 8 | Session being started is linked to its own `bookingId` | Conflict check is skipped entirely. |

---

#### Admin Visibility

Platform Admins have no visibility into a club's Walk-In Conflict Alert configuration or any record of alerts shown/overridden (none is recorded — see Out of Scope below), consistent with the existing Club DB access model (§3.3).

---

#### Out of Scope (for this revision)

- Automatic blocking or prevention of a walk-in session start — the alert is always advisory; the owner/staff retains full discretion to proceed.
- Automatic cancellation, rescheduling, or rejection of the conflicting booking — any such action remains a manual step in Online Booking Management (§7.8).
- A push/FCM notification version of this alert — it is shown synchronously, in-app, at the moment of the table-tap action only.
- Per-table custom buffer values — one buffer setting applies uniformly to every table at a club.
- Conflict detection between two walk-ins, or between a walk-in and a `pending` (not yet owner-approved) booking.
- Audit logging or analytics of how often the alert is shown or overridden.
- Any change to the booking creation/approval flow (§7.8) or the customer-facing booking flow (§8.4) — this feature only adds a check at the moment a walk-in session is started.
- Customer-facing visibility of this alert, in any form.

---

### 7.13 Live Streaming (NEW in v31)

> **ℹ Note:** This is the one new feature introduced by this revision. It lets a club owner (or trusted staff) broadcast a live video of a game in progress directly from their phone, using the Owner App's camera, with no external hardware or separate streaming software required. The stream is instantly watchable by any customer on the platform, from any club — turning every club into potential content for the whole A3 Billiards OS customer base, with no payment required to watch in this phase.

---

#### Concept

- **One IVS Channel per club, provisioned automatically.** The first time anyone at a club taps "Go Live," the system provisions a single, persistent AWS IVS channel for that club (ingest endpoint, stream key, playback endpoint). Every subsequent stream from that club reuses the same channel — there is no per-stream channel creation.
- **One active stream per club at a time.** A club cannot run two simultaneous broadcasts in this phase. Attempting to go live while already live is rejected (`LIVESTREAM_001`).
- **Broadcast from the phone, no external equipment.** The owner/staff member points their device's camera at the table/game they want to show. There is no fixed per-table camera, no multi-camera switching, and no external capture hardware in this phase — the broadcast is whatever the device camera sees.
- **Optional, free-text metadata only.** The owner may type a short title (e.g. "Friday Night Final — Table 4") and optionally tag which table is being shown, purely as descriptive text for the discovery list. **No customer or session data is ever auto-populated into the stream's public metadata** — see the privacy note below.
- **Free to watch, platform-wide.** Any authenticated customer can watch any club's active stream from inside the Customer App, regardless of whether they are a customer of that specific club. There is no subscription, payment, or club-membership requirement to watch in this phase.
- **Live only — no recording, no rewind.** Once a stream ends, it is gone; there is no archive, VOD library, or rewind buffer in this phase.

> **ℹ Privacy note:** Because any stream is visible to any customer platform-wide (not just people who chose to visit that specific club), the product deliberately does not surface any customer-identifying or session-identifying information (names, phone numbers, booking details) anywhere in the public stream listing or player — only the free-text title the owner chose to type, the club's own public name/branding, and an optional table label (e.g. "Table 4," never tied to a specific booking or customer record).

---

#### Owner App — Going Live

| # | Step | Detail |
|---|---|---|
| 1 | Owner/staff (with `livestream` access) opens the **Live Stream** tab | Shows the club's current status: "Not live" with a **Go Live** button, or — if already live — the active broadcast controls. |
| 2 | Tap **Go Live** | If the club has no IVS channel yet, one is provisioned transparently (a brief one-time loading state; invisible to the user beyond a short spinner). The channel persists for all future streams. |
| 3 | Optional metadata | A short title field (≤80 characters) and an optional table picker (free-text label, not linked to live session data) are shown before broadcasting starts. |
| 4 | Camera/microphone permission | Standard OS permission prompts, requested only the first time. |
| 5 | Broadcast starts | The Owner App's embedded broadcast SDK begins pushing video to the club's IVS ingest endpoint, using a stream key fetched just-in-time (never stored on-device beyond the active broadcast session). A `liveStreams` record is created with `status: 'live'`, `startedAt`, and `startedBy`. The stream immediately becomes visible to all customers platform-wide (§8.10). |
| 6 | While live | The owner/staff member sees their own camera preview plus a best-effort viewer count (polled periodically — not guaranteed real-time-exact, see Out of Scope). A single **End Stream** button is always available. |
| 7 | Tap **End Stream** | The broadcast stops, the `liveStreams` record is updated to `status: 'ended'`, `endedAt` set, `endedReason: 'owner_ended'`. The stream immediately disappears from the Customer App's live list. |
| 8 | Unexpected disconnect (app crash, network loss, force-quit) | The system reconciles this automatically — see "Reliability" below — so the stream does not appear "live" forever in the Customer App if the owner's connection drops without a clean End Stream tap. |

**Reliability:** AWS IVS emits start/end events for the underlying broadcast independently of whether the Owner App cleanly calls "End Stream." These events are used to correct the `liveStreams.status` automatically if the app disconnects abnormally, so customers are never shown a stream as "live" indefinitely after the broadcaster has actually gone offline. As an additional safety net, any `liveStreams` row still marked `live` after an extended period with no corroborating signal is automatically closed out — see Edge Cases (§14).

---

#### Customer App — Watch Live

See §8.10 for the full customer-facing specification. In summary: a dedicated **Live** tab shows every club's currently active stream, platform-wide, refreshed in real time as clubs go live or end their streams; tapping a stream opens a full-screen player. No payment or subscription step is required.

---

#### Admin Visibility & Moderation

See §6 above. Admin can see every active stream platform-wide and can force-end any stream with a required, logged reason. Admin has no other live-streaming capability.

---

#### Validation Summary

| # | Check | Behavior |
|---|---|---|
| 1 | Club already has an active stream | A second "Go Live" attempt is rejected (`LIVESTREAM_001`); the owner must end the current stream first. |
| 2 | Staff without `livestream` access | The Live Stream tab is not shown at all; the underlying start/end functions are also rejected server-side if called directly. |
| 3 | AWS IVS provisioning/API failure | Surfaced to the owner as a clear error (`LIVESTREAM_002`) with a retry option; no partial/inconsistent `liveStreams` record is left behind. |
| 4 | Ending a stream that is not currently live | Rejected (`LIVESTREAM_003`) — guards against duplicate "End Stream" taps or stale UI state. |
| 5 | Stream key exposure | The stream key (or any value that could be used to impersonate the broadcaster) is never returned by any query reachable from the Customer App or the Admin App, and is only resolved server-side, transiently, for the authenticated owner/staff member actively starting a broadcast. |
| 6 | Cross-club viewing | Always permitted — there is no club-membership or "must have visited this club" check anywhere in the watch flow, by design (§7.13 Concept). |
| 7 | Admin force-end | Immediately terminates the broadcast at the AWS IVS level (the broadcaster is disconnected, not just hidden from the list) and requires a logged reason. |

---

#### Out of Scope (for this revision)

- A paid subscription, pay-per-view, or any payment gate for watching a live stream — viewing is free for any authenticated customer in this phase.
- Video-on-demand (VOD) playback, recording, archiving, or rewind of past streams — live-only.
- In-stream chat, reactions, likes, comments, or any real-time viewer interaction.
- Live thumbnail or preview-frame capture for the discovery list — the list shows the club's existing static profile image instead (capturing a real video thumbnail would require a separate AWS IVS recording configuration and S3 storage, deferred).
- More than one simultaneous active stream per club.
- Scheduled or "starts at" stream announcements — going live is always a spontaneous, in-the-moment action.
- Multi-camera switching, external camera/capture-card input, or screen sharing — phone camera only, via the in-app broadcast SDK.
- Customer-initiated stream reporting or flagging — moderation in this phase is admin force-end only.
- Exact, real-time-guaranteed viewer counts — the displayed count is best-effort and polled, not push-updated per viewer join/leave.
- Any owner-side add-on pricing or metering for using Live Streaming — it is available to every active club account at no extra cost in this phase.
- Picture-in-picture playback, screen-recording prevention, watermarking, or DRM beyond the basic playback-authorization token described in §8.10.

---

## 8. Customer Panel

### 8.1 Registration & Login

Unchanged from v28 §8.1.

### 8.2 Club Discovery

Unchanged from v28 §8.2.

### 8.3 Club Profile

Unchanged from v28 §8.3, including §8.3.1 Directions.

### 8.4 Online Booking Flow

Unchanged from v28 §8.4.

### 8.5 My Bookings Screen

Unchanged from v28 §8.5.

### 8.6 Session History

Unchanged from v28 §8.6, with one addition (the v29 "Free Visit" badge, carried forward unchanged from v29).

### 8.7 Profile Management

Unchanged from v28 §8.7.

### 8.8 Push Notifications

Unchanged from v28 §8.8, subject to the registration-timing caveat noted in §8.1/§15.

### 8.9 Loyalty Status

Unchanged from v29 §8.9 in full. The Walk-In Booking Conflict Alert (§7.12) has no Customer App surface — it is entirely an Owner App / staff-facing feature.

> **ℹ Note:** This is the customer-facing complement to the Owner App's Loyalty feature (§7.11). Customers can see their loyalty standing at each club they have visited, but cannot configure anything — the programme is entirely owner-controlled.

**Where it appears**

Loyalty status is surfaced in two places in the Customer App:

- **Club Profile screen (§8.3):** When a customer views the profile of a club at which they have an active Loyalty Ledger, a "Your Loyalty Status" card is shown below the pricing block. If the club has no active loyalty programme, this card is hidden entirely — there is no empty-state or "no loyalty programme here" message shown (to avoid confusing customers about a feature that the club hasn't enabled).
- **Session History (§8.6):** Free-visit sessions are badged as described in §8.6 above.

**Loyalty Status card content**

| Element | Detail |
|---|---|
| Programme name | The club's `loyaltyProgramme.name`, e.g. "A3 Regulars Club". |
| Available credits | The customer's current `availableCredits` count, prominently displayed. "You have X free visit(s) available." |
| Progress toward next tier | For each tier the customer has **not yet reached** in the current window, show a progress bar: "X / Y min played this period" toward the next reward. If the customer has reached the highest tier in the current window, show a congratulatory line instead ("You've reached the top tier this period!"). |
| Current window period | "Your progress resets on [date]" — computed as `today + windowDays − daysElapsedSinceFirstSessionInWindow`. This is displayed for the lowest un-reached tier's `windowDays`; if all tiers have the same `windowDays` (the common case), one date is shown. |
| Lifetime summary | Smaller text below: "X visits · Y min total this period · Z credits earned lifetime". |

**Notification on credit award**

When the server awards a credit at checkout (§7.11 Play-Time Tracking), it sends an FCM push notification to the customer (§9.1). This notification deep-links to the Club Profile screen of the relevant club so the customer can see their updated status immediately.

**Data access model**

The Customer App reads loyalty data via a dedicated Convex query (`getCustomerLoyaltyStatus(clubId, userId)`) that returns only the fields listed in the Loyalty Status card above for the requesting customer — it does not expose other customers' ledger data, the programme's full tier configuration details (thresholds are not shown to customers; only progress relative to "next tier" is shown, without revealing the exact threshold number in this phase to avoid gaming), or any historical award/redemption log beyond what is shown in session history.

> **ℹ Design note — threshold visibility:** The exact `thresholdMinutes` value is intentionally not shown to customers in this phase (only the progress bar showing current minutes vs. threshold, without the threshold number explicitly stated). This is a deliberate product decision to keep the UI simple and to give the owner flexibility to adjust tiers without customers anchoring to a specific number. If the owner later decides to show thresholds explicitly, this can be a configuration option in a future phase.

**Out of scope (customer-facing)**

- Any ability for a customer to redeem their own credits — redemption is always initiated by the owner or staff at session start; customers cannot self-serve redeem.
- A customer-facing credit transfer or gift mechanism.
- Credit expiry countdown — unused credits do not expire in this phase.

---

### 8.10 Watch Live (NEW in v31)

> **ℹ Note:** This is the customer-facing complement to the Owner App's Live Streaming feature (§7.13). Any customer can browse and watch any club's active live stream from anywhere on the platform — there is no requirement to be a customer of that specific club, and no payment is required in this phase.

**Where it appears**

A new top-level **Live** tab is added to the Customer App's main navigation, alongside Club Discovery (§8.2), My Bookings (§8.5), and Profile (§8.7). This is a deliberate, dedicated entry point rather than something tucked inside a club's profile, since the whole point of the feature is cross-club discovery — a customer should be able to find *any* club's live game without first navigating to that club.

**Live tab content**

| Element | Detail |
|---|---|
| Live streams grid/list | One card per currently active stream, platform-wide, sorted newest-first (most recently started at the top). Each card shows: the club's name and existing profile banner image (no live video thumbnail — see §7.13 Out of Scope), a "LIVE" badge, the stream's title (if the owner set one), an optional table label, and a best-effort viewer count. |
| Empty state | If no club is currently live, a simple "No live games right now — check back soon" message is shown. No error, no broken UI. |
| Reactivity | The list updates live as clubs start or end streams, with no manual refresh required. |

**Watching a stream**

| # | Step | Detail |
|---|---|---|
| 1 | Customer taps a live stream card | The app requests a short-lived **Stream Access Token** for that specific stream from the server. |
| 2 | Token granted | Any authenticated customer is granted a token on request — there is no subscription tier, payment status, or club-membership check. The token exists purely as a basic access-control/anti-hotlinking mechanism (so the raw playback URL cannot simply be copied and shared outside the app) — see TDD v1.9 §4.12 for the technical design. |
| 3 | Full-screen player opens | Standard live-video playback controls (mute/unmute, full-screen, exit). No DVR/rewind controls are shown, since the stream is live-only. |
| 4 | Stream ends while a customer is watching | The player shows a clear "This stream has ended" state and returns the customer to the Live tab; it does not error out silently. |
| 5 | Token nearing expiry during a long watch session | The app silently refreshes the token in the background before it expires, so a customer watching a long stream is never unexpectedly disconnected. |

**Out of scope (customer-facing)**

- Any payment, subscription, or paywall screen — there is none in this phase.
- Following/favoriting a club to get notified when it goes live — no such mechanic exists yet; a customer must check the Live tab themselves.
- Sharing a stream outside the app (e.g. a shareable web link) — viewing is in-app only in this phase.
- Commenting, reacting, or any social feature on a stream.

---

## 9. Notifications & Integrations

### 9.1 FCM Push Notification Events

Unchanged from v28 §9.1, with two events added in v29 (carried forward unchanged) and one event added in v31:

| Notification Type | Trigger | Recipient | Deep Link Data |
|---|---|---|---|
| **Loyalty Credit Awarded** | Server awards one or more free-visit credits to a customer at session checkout | **Customer** | `{ type: 'loyalty_credit_awarded', clubId, creditsAwarded, newBalance }` |
| **Low Credit Reminder (optional)** | Customer redeems their last available credit (balance drops to 0) | **Customer** | `{ type: 'loyalty_last_credit_used', clubId }` |
| **Live Stream Force-Ended by Admin (NEW in v31, optional/best-effort)** | An admin uses Force-End Stream (§6) on a club's active broadcast | **Owner** — sent to the device(s) of the club's owner account | `{ type: 'livestream_force_ended', clubId, liveStreamId, reason }` — deep-links to the Owner App's Live Stream tab |

> **ℹ Note:** The Live Stream Force-Ended notification is best-effort, like the Low Credit Reminder — if the owner has no FCM token registered, it fails silently. This is the only owner-directed notification introduced since v28 (every other notification added in v29/v30/v31 is either customer-directed or, in v30's case, not delivered via FCM at all).

> **ℹ Carried from v30:** No FCM event is introduced for the Walk-In Booking Conflict Alert (§7.12) — it remains synchronous and in-app only.

### 9.2 WhatsApp Business API (OTP)

Unchanged from v28 §9.2.

### 9.3 Email (Credential Resets & Transactional)

Unchanged from v28 §9.3. No new transactional email is introduced for Live Streaming.

---

## 10. Data Schema Reference

The schema specified in PRD v23 §10 / TDD v1.4 §4 remains the accurate reference for all existing tables.

> **ℹ Added in v29:** §7.11 (Membership Loyalty) introduces four new Club DB tables (plus three audit/log tables). All follow the same club-isolation rules as every other Club DB table (§3.3).

**`loyaltyProgrammes`** — one row per programme (a club may have multiple programmes over time, but only one `status: 'active'` at a time). Fields: `clubId`, `name`, `status` (`draft` | `active` | `archived`), `freeVisitMaxMinutes`, `createdBy` (`userId`), `createdAt`, `updatedAt`, `archivedAt` (optional). Indexed `by_clubId_status`.

**`loyaltyTiers`** — one row per tier, child of a programme. Fields: `clubId`, `programmeId`, `name`, `windowDays`, `thresholdMinutes`, `creditsAwarded`, `rank` (integer, order within the programme for UI display), `createdAt`. Indexed `by_programmeId`.

**`loyaltyLedgers`** — one row per (customer, club) pair. Fields: `clubId`, `userId`, `programmeId` (the active programme at enrolment time — updates if the programme is replaced), `availableCredits`, `lifetimeCreditsEarned`, `lifetimeCreditsRedeemed`, `highestTierReachedId` (optional — the `loyaltyTiers._id` of the highest tier reached in the most recent evaluated window), `lastAwardedAt` (optional), `createdAt`, `updatedAt`. Indexed `by_clubId_userId` (unique), `by_userId` (for the Customer App's cross-club loyalty query, though cross-club display is per-profile, not aggregated).

**`loyaltyPlayLog`** — lightweight append-only log, one row per completed session for enrolled customers. Fields: `clubId`, `userId`, `sessionId`, `programmeId`, `endTime`, `billableMinutes`. Indexed `by_clubId_userId_endTime` (for the rolling-window cumulative-time query, §7.11 Step 3). This is the source of truth for the rolling-window play-time computation; it is not a replacement for `sessions` and contains no billing data.

**`loyaltyCredits`** — one row per individual free-visit credit (each award creates `creditsAwarded` rows). Fields: `clubId`, `userId`, `programmeId`, `tierId` (which tier triggered this award), `status` (`available` | `reserved` | `redeemed`), `awardedAt`, `reservedAt` (optional — set when a session starts with this credit), `redeemedAt` (optional), `sessionId` (optional — the session in which it was redeemed), `reservedForSessionId` (optional — set to `sessions._id` when `status: 'reserved'`). Indexed `by_clubId_userId_status` (for credit-availability check at session start).

**`loyaltyCreditAwardLog`** — audit log of every credit award event. Fields: `clubId`, `userId`, `programmeId`, `tierId`, `creditsAwarded`, `cumulativeMinutesAtAward`, `sessionId` (the session that triggered the award), `source` (`automatic` | `manual`), `manualReason` (optional, ≤200 chars), `awardedBy` (`userId`, set for manual adjustments), `awardedAt`. Indexed `by_clubId_userId`.

**`loyaltyCreditRedemptionLog`** — audit log of every redemption. Fields: `clubId`, `userId`, `creditId` (`loyaltyCredits._id`), `sessionId`, `freeVisitMaxMinutesApplied`, `billableMinutes`, `overageMinutes` (max(0, billableMinutes − freeVisitMaxMinutes)), `overageBilled`, `redeemedBy` (`userId` of staff/owner who initiated), `redeemedAt`. Indexed `by_clubId_userId`.

Also: the `sessions` table gains two new optional fields — `isFreeVisit: boolean` (default false) and `freeVisitCreditId: optional Id<'loyaltyCredits'>` and `freeVisitMaxMinutes: optional number` — to link a session to the credit being redeemed and capture the cap at the time of session start. These are additive fields and require no migration of existing session records.

> **ℹ Added in v30:** §7.12 (Walk-In Booking Conflict Alert) adds two optional fields to the existing `clubs` table. No new table, no new index beyond what already exists on `bookings`, and no mutation signature change beyond accepting two more optional args on the existing club-settings update mutation.

**`clubs` table additions (v30):** `walkInConflictAlertsEnabled` (optional boolean; treated as `true` when absent), `walkInConflictBufferMinutes` (optional number; treated as `30` when absent; valid range 5–120, enforced at the settings-update mutation layer). The conflict-detection logic reads from the existing `bookings` table using its existing per-club/per-table/start-time index — no new index is required.

> **ℹ New in v31:** §7.13 (Live Streaming) adds one new Club DB table, one new Central DB table, four new optional fields on `clubs`, and a new accepted value on `staffRoles.allowedTabs`. This should be folded into TDD v1.9's schema listing.

**`clubs` table additions (v31):** `ivsChannelArn` (optional string — the AWS IVS channel's ARN, set on first provisioning), `ivsIngestEndpoint` (optional string — the RTMPS ingest URL), `ivsStreamKeyArn` (optional string — a reference to the channel's stream key; the secret value itself is never stored in a field readable by any Customer-App-reachable query), `ivsPlaybackUrl` (optional string — the channel's persistent HLS playback URL).

**`liveStreams`** (Club DB) — one row per broadcast. Fields: `clubId`, `title` (optional, ≤80 chars), `tableLabel` (optional free-text, not linked to any session/booking record), `status` (`live` | `ended`), `startedBy` (`userId`), `startedAt`, `endedAt` (optional), `endedReason` (optional: `owner_ended` | `admin_force_ended` | `connection_lost` | `stale_auto_closed`), `peakViewerCount` (optional, best-effort). Indexed `by_clubId_status` (to enforce "one active stream per club") and `by_status_startedAt` (for the cross-club discovery query, §3.3).

**`liveStreamModerationLog`** (Central DB) — audit log of admin force-end actions. Fields: `clubId`, `liveStreamId`, `adminId`, `reason` (required, free text), `endedAt`. Indexed `by_clubId`.

The `staffRoles.allowedTabs` schema validation set gains one new accepted value: `'livestream'` (alongside the existing `slots` / `snacks` / `financials` / `complaints` / `bookings` / `documents` / `kitchen` / `loyalty`).

No change is required to `sessions`, `bookings`, `tables`, or any other existing table for this feature.

---

## 11. Non-Functional Requirements

Unchanged from v28 §11, with one addition (the v30 walk-in conflict alert responsiveness row, carried forward unchanged) plus:

| Category | Requirement | Target / Detail |
|---|---|---|
| Walk-in conflict alert responsiveness (v30) | Carried forward unchanged — see §7.12 above. | Table tap → pop-up: no added network latency. Badge freshness: within ~30 seconds of real time. |
| Live stream start latency (NEW in v31) | Time from tapping "Go Live" to the broadcast becoming visible/playable in the Customer App. Dominated by AWS IVS ingest-to-playback propagation, not by the Convex layer. | Target: broadcast playable within ~5–8 seconds of "Go Live" being tapped, assuming a stable network connection on the broadcasting device. |
| Live stream glass-to-glass latency (NEW in v31) | End-to-end delay between what the camera sees and what a viewer sees, using AWS IVS's low-latency channel configuration. | Target: ~3–5 seconds, AWS IVS's standard low-latency mode target; not a hard guarantee, as it is governed by AWS infrastructure and the broadcaster's network conditions. |
| Live stream discovery reactivity (NEW in v31) | The Customer App's Live tab must reflect a club going live or ending its stream without requiring a manual pull-to-refresh. | Near-instant via Convex's reactive query subscriptions (consistent with every other reactive list in the product). |

---

## 12. Feature Priority Matrix

Unchanged from v28 §12, with three additions:

| Feature | Priority | Status Note |
|---|---|---|
| **Membership Loyalty (Owner App + Customer App)** | **P1** | **(NEW in v29)** Per-club loyalty programme with configurable tiers, automatic enrolment/credit award, redemption at session start, customer-facing status. New `loyalty` `allowedTabs` value. See §7.11 / §8.9. |
| **Walk-In Booking Conflict Alert (Owner App)** | **P1** | **(NEW in v30)** Advisory in-app alert when a walk-in is about to be seated at a table with a near-term confirmed booking. Reuses `slots` `allowedTabs`; no new mutation. See §7.12. |
| **Live Streaming (Owner App + Customer App)** | **P1** | **(NEW in v31)** Net-new feature, not present in v23–v30. Owner/staff can broadcast a live video of a game from the Owner App via AWS IVS; any customer, platform-wide, can watch any club's stream for free in the Customer App — no payment gate in this phase. New `livestream` `allowedTabs` value. New Admin moderation capability (view all active streams, force-end with logged reason). First AWS integration in the stack. See §7.13 / §8.10. |

All other rows in the v28 priority matrix are unchanged.

---

## 13. Appendix — Monorepo Folder Structure (As-Built + v29/v30/v31 Additions)

Unchanged from v28 §13 for all existing paths. The following additions were required by v29:

```
a3-billiards-os/
├── apps/
│   ├── owner-app/
│   │   └── app/
│   │       └── (tabs)/
│   │           └── loyalty.tsx         # NEW in v29 — Loyalty dashboard, gated by allowedTabs.loyalty
│   ├── customer-app/
│   │   └── app/
│   │       └── (tabs)/
│   │           └── ...                  # No new tab; loyalty shown on club profile screen
│   └── ... (all other apps unchanged)
├── packages/
│   ├── convex/
│   │   ├── ... (unchanged from v28)
│   │   └── loyalty.ts                  # NEW in v29 — Loyalty programme CRUD, ledger evaluation, credit award/redemption
│   ├── ui/
│   │   └── components/
│   │       ├── ... (unchanged from v28)
│   │       ├── LoyaltyProgrammeForm.tsx        # NEW in v29 — Settings config form
│   │       ├── LoyaltyTierForm.tsx             # NEW in v29 — Tier editor
│   │       ├── LoyaltyCustomerList.tsx         # NEW in v29 — Owner loyalty dashboard list
│   │       ├── LoyaltyCustomerDetail.tsx       # NEW in v29 — Per-customer ledger view
│   │       ├── LoyaltyStatusCard.tsx           # NEW in v29 — Customer App club-profile card
│   │       └── RedeemFreeVisitDialog.tsx       # NEW in v29 — Session-start redemption dialog
│   └── utils/                                  # unchanged
```

The following further additions were required by v30:

```
a3-billiards-os/
├── apps/
│   └── owner-app/
│       └── app/
│           └── (tabs)/
│               └── slots.tsx              # MODIFIED in v30 — table grid renders conflict badges and gates walk-in start on WalkInConflictDialog
├── packages/
│   ├── convex/
│   │   └── walkInConflict.ts              # NEW in v30 — getUpcomingBookingsForClub query
│   └── ui/
│       └── components/
│           ├── WalkInConflictDialog.tsx   # NEW in v30 — conflict pop-up shown at walk-in session start
│           └── TableConflictBadge.tsx     # NEW in v30 — small badge rendered on a flagged table card
```

The following further additions are required by v31:

```
a3-billiards-os/
├── apps/
│   ├── owner-app/
│   │   └── app/
│   │       └── (tabs)/
│   │           └── livestream.tsx          # NEW in v31 — Go Live / broadcast controls, gated by allowedTabs.livestream
│   ├── customer-app/
│   │   └── app/
│   │       └── (tabs)/
│   │           └── live.tsx                # NEW in v31 — cross-club live stream discovery list + player launch
│   └── admin-app/
│       └── app/
│           └── (tabs)/
│               └── live-moderation.tsx     # NEW in v31 — platform-wide active stream list + Force-End Stream
├── packages/
│   ├── convex/
│   │   ├── ... (unchanged from v30)
│   │   ├── livestream.ts                   # NEW in v31 — channel provisioning, start/end stream, discovery query, playback token
│   │   ├── livestreamActions.ts            # NEW in v31 — AWS IVS SDK calls (CreateChannel, CreateStreamKey, StopStream)
│   │   └── livestreamWebhook.ts            # NEW in v31 — HTTP action receiving AWS EventBridge Stream Start/End events
│   └── ui/
│       └── components/
│           ├── ... (unchanged from v30)
│           ├── LiveStreamBroadcastControls.tsx   # NEW in v31 — Owner App Go Live / End Stream UI
│           ├── LiveStreamCard.tsx                # NEW in v31 — Customer App discovery list card
│           ├── LiveStreamPlayer.tsx              # NEW in v31 — Customer App full-screen IVS player wrapper
│           └── LiveStreamModerationList.tsx      # NEW in v31 — Admin App moderation list + force-end dialog
```

---

## 14. Edge Cases & Boundary Conditions

Unchanged from v28 §14. The following loyalty-specific edge cases were added in v29:

**Loyalty edge cases**

- **Programme deactivated mid-window:** If an owner archives a programme while a customer is mid-window (has accumulated play-time but not yet reached a threshold), no credits are awarded. If the owner later creates and activates a new programme with the same or different tiers, the ledger for the new programme starts fresh — the mid-window accumulated time from the archived programme is not carried over.
- **Session force-ended by admin:** If an admin force-ends a stuck session (§6.2 Admin Panel), the loyalty side-effect action still fires on the resulting checkout record, since force-end transitions the session through the normal checkout path. If the force-ended session has a `reserved` credit, that credit is reverted to `'available'` as per the normal cancellation path (§7.11 Step 8).
- **Customer account deleted:** On account deletion (§4.6, 30-day grace period), the customer's `loyaltyLedger` and `loyaltyCredits` records are deleted as part of the data-deletion sweep. Unredeemed credits are simply lost — no credit transfer to another account is possible. The `loyaltyCreditAwardLog` and `loyaltyCreditRedemptionLog` entries for this customer are anonymised (userId field nulled or replaced with a tombstone marker) rather than hard-deleted, so the club's programme statistics remain accurate.
- **Club subscription expires/freezes:** When a club's subscription enters grace or frozen state, no new sessions can be started (existing `isFrozen` logic, §5.2), so no new loyalty events are triggered. Existing credit balances remain on the ledger and are redeemable if the subscription is renewed and the programme is still active.
- **Multiple tiers, same window, same session:** All tiers are evaluated in a single pass at the end of each session (§7.11 Step 4). A customer who crosses from below Tier 1 all the way past Tier 2 in one session (e.g. their cumulative time jumps from 280 min to 650 min in one very long session, and Tier 1 threshold is 300 min, Tier 2 is 600 min) will receive credits from both tiers in that single evaluation — Tier 1 credits first, then Tier 2 credits. Both are recorded in `loyaltyCreditAwardLog`.
- **Concurrent session check-outs for the same customer:** Extremely rare (a customer cannot play on two tables simultaneously at the same club), but if two sessions for the same customer at the same club somehow complete simultaneously, the loyalty ledger update uses an optimistic-concurrency-safe pattern (Convex's built-in optimistic concurrency control for mutations) to ensure credits are not double-awarded.

The following walk-in conflict edge cases were added in v30:

**Walk-in conflict edge cases**

- **Booking cancelled after alert shown:** If the customer or owner cancels the conflicting booking between the alert being shown and the owner choosing an action, no special handling is needed — "Start Walk-In Anyway" simply starts a normal walk-in session; the booking's own cancellation is handled entirely by the existing Booking Management flow (§7.8), independent of this feature.
- **Owner changes the buffer mid-shift:** The buffer value is read live (reactive query) each time the table grid re-renders; a change in Settings takes effect on the owner's next view of the table grid without requiring an app restart.
- **Booking start time already passed (customer running late):** If a confirmed booking's `startTime` is in the past but the booking has not yet been checked in / converted into a session, it still counts as "within the buffer" (a negative or zero minutes-until value) and the alert is shown, worded as "This booking was due to start at [time]" rather than "starts in X minutes."
- **Walk-in is for the same customer who has the booking:** The system does not attempt to match walk-in customer identity to the conflicting booking's customer; the alert is shown purely based on table + time, regardless of whether the walk-in customer happens to be the same person as the booking (in which case "Start Walk-In Anyway" is the obviously correct action, but the system does not auto-detect this).
- **Multiple available tables, only one flagged:** Only the flagged table shows a badge/alert; other available tables behave normally, allowing the owner to simply choose a different table without friction.
- **Alerts disabled club-wide:** If `walkInConflictAlertsEnabled` is `false`, no badge ever renders and no table tap ever shows the dialog — the Slot Management screen is pixel-identical to pre-v30 behavior.

The following live-streaming edge cases are added in v31:

**Live streaming edge cases**

- **Owner's app crashes or loses connection mid-broadcast:** AWS IVS detects the dropped ingest connection independently of the Owner App and emits a stream-end signal, which is used to correct the `liveStreams` record to `status: 'ended'`, `endedReason: 'connection_lost'`, so the stream does not appear "live" to customers indefinitely. As a final safety net, any `liveStreams` row still marked `live` after several hours with no corroborating signal is automatically closed out by a periodic background check (`endedReason: 'stale_auto_closed'`).
- **Two staff members try to go live for the same club at the same time:** The second attempt is rejected with `LIVESTREAM_001` ("a stream is already live for this club"); only one broadcast per club is permitted at a time, regardless of which staff member or the owner initiates it.
- **Customer opens the Live tab with no internet momentarily, then reconnects:** The reactive query simply resumes once connectivity returns; no special handling is needed beyond the platform's existing offline-state conventions.
- **Admin force-ends a stream the owner is mid-broadcast on:** The owner's broadcast SDK receives a disconnect from AWS IVS (the underlying ingest connection is terminated, not just hidden from the app); the Owner App should detect this and show a clear "Your stream was ended by a platform administrator" message, distinct from a generic connection-loss message, using the `endedReason: 'admin_force_ended'` value and the FCM notification (§9.1) as corroborating signals.
- **Club's subscription expires/freezes while live:** Consistent with the existing `isFrozen` logic (§5.2) — a frozen club cannot start a *new* stream, but an in-progress stream is not forcibly cut off mid-broadcast purely by the subscription state in this phase (this mirrors how an in-progress session is not interrupted by a mid-session freeze elsewhere in the product).
- **Customer is watching a stream when it ends naturally:** The player surfaces a clear "This stream has ended" state (§8.10 Step 4) rather than a generic playback error.
- **Very long-running stream (multiple hours):** The Stream Access Token is refreshed silently in the background before expiry (§8.10 Step 5), so long watch sessions are not unexpectedly interrupted by token expiry.

---

## 15. Known Issues & Technical Debt

Unchanged from v28 §15. All 16 items carried forward unchanged. v29's Loyalty feature, v30's Walk-In Booking Conflict Alert, and v31's Live Streaming feature are not yet built, so no as-built findings exist for any of them.

The recommendation from v28 stands: items 1, 2, 3, 6, 12, and 13 are the highest-priority gaps relative to original v23 commitments and should be triaged before production launch.

---

*Document ends. This version (31.0) supersedes PRD v30.0 as the canonical product specification. v31's only functional addition is Live Streaming — a club owner or authorised staff member can broadcast a live video of a game from the Owner App, using AWS IVS, and any authenticated customer on the platform can watch any club's active stream for free from the Customer App's new Live tab, with no payment, subscription, or club-membership requirement in this phase (§7.13/§8.10). This is the platform's first AWS integration. The feature is additive to existing data: one new Club DB table (`liveStreams`), one new Central DB table (`liveStreamModerationLog`), four new optional fields on `clubs`, and a new `'livestream'` value on `staffRoles.allowedTabs`; no existing table, index, billing formula, or auth provider is changed. Admin gains a narrowly-scoped, logged force-end moderation capability given the cross-club, anonymous-viewer nature of the feature. The next technical design document should be issued as TDD v1.9, aligned to this version, adding the AWS IVS integration design (channel provisioning, stream-key handling, playback-authorization tokens, and the EventBridge webhook) to the technical baseline.*
