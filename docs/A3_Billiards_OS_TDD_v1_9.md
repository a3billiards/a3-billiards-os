# A3 BILLIARDS OS

## Technical Design Document

### Version 1.9 — PRD v31-Aligned (Live Streaming / AWS IVS Design Specification)

*Implementation-Ready Technical Specification*

| Field | Value |
|---|---|
| Version | 1.9 (PRD v31-Aligned) |
| PRD | v31.0 — Live Streaming (AWS IVS) Addition |
| Date | June 2026 |
| Status | Active — supersedes TDD v1.8 for the Live Streaming feature. TDD v1.8's design baseline for the Walk-In Booking Conflict Alert remains the accurate technical reference for that feature and is carried forward unchanged. TDD v1.7's design baseline for Membership Loyalty, and TDD v1.6's for Document Holder/Customer Directions/GST & Tax Report/Kitchen & Chef Role, remain accurate and are carried forward unchanged. TDD v1.5's as-built audit baseline remains accurate for all previously-shipped functionality. |
| Stack | Expo ~55.0.15 · RN 0.83.4 · React 19.2.0 · Convex ^1.13 · @convex-dev/auth 0.0.68 · **AWS IVS (NEW)** |
| Platforms | iOS 15.1+, Android API 24+, Web |
| Package manager | pnpm 9.15.9 workspaces, Node ≥20 |
| Reconciled against | PRD v31.0 — Live Streaming (§7.13 / §8.10) |

> **ℹ How to read this document:** TDD v1.5 documented the as-built codebase. TDD v1.6, v1.7, and v1.8 each added a forward-looking design specification for one or more new PRD features. **This document (TDD v1.9) follows the same pattern: it is a forward-looking design specification for the single new feature in PRD v31 (Live Streaming), not an as-built audit finding.** The new subsections are explicitly marked **"NEW — Design Specification, Not Yet Implemented."** Engineers should read TDD v1.5 + v1.6 + v1.7 + v1.8 + v1.9 as a layered stack. Once all seven net-new features (v25–v31) are implemented, a unified as-built audit should be commissioned and a TDD v1.10 (or a fully consolidated v2.0) issued.
>
> **ℹ Note on scope relative to prior versions:** Live Streaming is the most architecturally significant feature specified since TDD v1.5's original audit. It is the **first integration with a cloud provider other than Firebase** (FCM) — it introduces AWS as a new vendor, new IAM credentials, new environment variables, two new native-module dependencies (one per mobile app), and a new inbound webhook surface (AWS EventBridge → Convex HTTP Action). It also introduces the platform's **first intentional, narrowly-scoped exception to the per-club data isolation model** (§3.3 of every prior PRD version) — cross-club live stream discovery is a deliberate design decision, not an oversight, and is scoped tightly to a handful of non-sensitive fields (see §4.11).

---

## 1. Introduction

### 1.1 Purpose

This TDD adds the implementation-ready design detail needed to build the Live Streaming feature introduced in PRD v31 (§7.13 / §8.10). It carries forward TDD v1.8 in full and extends it with the AWS IVS integration design (§6.11–§6.13), the Live Streaming schema (§4.0.7), the channel-provisioning and broadcast-lifecycle design (§4.10), the cross-club discovery query design (§4.11), the playback-authorization token design (§4.12), and the app-specific implementation notes (§8.18–§8.20).

### 1.2 Scope

Unchanged from TDD v1.8 §1.2, extended with:

- **Live Streaming** — new Owner App `livestream` tab (§8.18), new Customer App `live` tab (§8.19), new Admin App moderation screen (§8.20), new AWS IVS integration (channel provisioning, broadcast, playback authorization, EventBridge webhook), one new Club DB table, one new Central DB table, four new optional fields on `clubs`, and a new `livestream` `allowedTabs` value.

### 1.3 Confirmed Assumptions

All assumptions in TDD v1.6–v1.8 §1.3 remain accurate. The following are added:

- **A new AWS account/IAM role is available to the backend.** Convex actions will call the AWS SDK (`@aws-sdk/client-ivs`) using credentials stored as Convex environment variables (§2.4). The IAM principal needs `ivs:CreateChannel`, `ivs:GetChannel`, `ivs:CreateStreamKey`, `ivs:GetStreamKey`, `ivs:StopStream`, `ivs:GetStream`, and (one-time, likely performed manually outside the app) `ivs:ImportPlaybackKeyPair`.
- **AWS IVS "Private Channel" / playback authorization is used**, not open/public playback. Every IVS channel is configured to require a signed JWT for playback. This is an access-control mechanism (anti-hotlinking), not a payment gate — per PRD §8.10, any authenticated customer is granted a token on request, with no subscription or tier check.
- **A single, platform-wide ECDSA key pair is used for playback authorization**, registered once with AWS IVS (`ivs:ImportPlaybackKeyPair`, a one-time manual setup step, not a runtime operation). The private key is stored as a Convex environment variable / secret and used server-side to sign short-lived playback JWTs. There is no per-club key pair in this phase — simpler operationally, and sufficient since the token is not used to enforce per-club entitlements (cross-club viewing is intentionally unrestricted, PRD §7.13 Concept).
- **The broadcast SDK runs on-device in the Owner App**, using the device's own camera and microphone — there is no server-side video processing, transcoding configuration, or media server operated by this team; AWS IVS handles ingest, transcoding, and playback packaging entirely as a managed service.
- **No new authentication provider or cross-cutting authorization mechanism is introduced.** The `livestream` tab value slots into the existing `allowedTabs`/`staffTabAccess.ts` mechanism exactly as `loyalty` and the walk-in conflict feature's `slots` reuse did. The Customer App's playback-token request requires only a standard authenticated customer session — no new permission tier.

---

## 2. System Architecture

### 2.1 Architecture Diagram

Unchanged from TDD v1.8 §2.1 in topology, with one major addition:

> **ℹ NEW — Design note:** Live Streaming introduces a new external system in the architecture diagram: **AWS IVS**, reached two ways:
> 1. **Outbound, from the backend:** Convex actions call the AWS IVS control-plane API (`@aws-sdk/client-ivs`) to provision channels, mint stream keys, and force-stop broadcasts.
> 2. **Outbound, from the Owner App device directly to AWS:** the broadcast SDK on the owner/staff member's phone streams video **directly to AWS IVS's ingest endpoint** — video bytes never pass through the Convex backend. Convex only ever handles metadata (channel ARNs, stream keys, playback tokens, start/end timestamps), never video.
> 3. **Inbound, from AWS to the backend:** AWS EventBridge delivers Stream Start / Stream End events to a new Convex HTTP Action (`livestreamWebhook.ts`), used to reconcile `liveStreams.status` independently of the Owner App's own "End Stream" tap (TDD v1.8-style reliability pattern, but webhook-driven rather than purely deferred-action-driven).
>
> Similarly, the Customer App's playback SDK connects **directly to AWS IVS's playback endpoint** using a token signed by Convex — playback video bytes never pass through the Convex backend either.

### 2.2 Architecture Layers

Unchanged from TDD v1.8 §2.2, with one addition: a new **External Media Platform** layer (AWS IVS), sitting alongside the existing Firebase/WhatsApp/Razorpay external integrations, but architecturally distinct in that two of its three integration points (broadcast ingest and playback) bypass the Convex backend entirely and go device-to-AWS directly. Convex's role for this feature is exclusively **control plane** (provisioning, authorization, metadata, lifecycle), never **data plane** (it never touches a video byte).

### 2.3 Domains / 2.4 Environment Variables

> **⚠ NEW — Design Specification:** Extends TDD v1.8 §2.3/§2.4. The following new environment variables are required:

| Variable | Purpose |
|---|---|
| `AWS_IVS_REGION` | AWS region hosting the IVS channels (e.g. `ap-south-1`, chosen for proximity to the primary user base). |
| `AWS_IVS_ACCESS_KEY_ID` | IAM access key for the Convex backend's AWS SDK calls. |
| `AWS_IVS_SECRET_ACCESS_KEY` | Corresponding IAM secret key. Stored as a Convex secret, never logged, never returned by any query. |
| `AWS_IVS_PLAYBACK_AUTH_KEY_PAIR_ID` | The ARN/ID of the platform-wide playback-authorization key pair registered with IVS (`ivs:ImportPlaybackKeyPair`, one-time setup). |
| `AWS_IVS_PLAYBACK_AUTH_PRIVATE_KEY` | The PEM-encoded private key half of the same key pair, used server-side to sign playback JWTs (§4.12). Stored as a Convex secret. |
| `AWS_EVENTBRIDGE_WEBHOOK_SECRET` | A shared secret used to verify that inbound requests to `livestreamWebhook.ts` genuinely originate from the configured EventBridge API Destination, not an arbitrary caller (§5). |

No existing domain or subdomain configuration changes. No new outbound domain needs to be added to any mobile app's network allow-list beyond AWS IVS's standard ingest/playback hostnames (handled internally by the IVS SDKs).

### 2.5 Monorepo Structure (Additions)

> **⚠ NEW — Design Specification, Not Yet Implemented:** Extends TDD v1.8 §2.5. These paths do not exist in the audited codebase; they are the recommended file layout for implementation, matching PRD v31 §13's appendix additions.

```
a3-billiards-os/
├── apps/
│   ├── owner-app/
│   │   └── src/app/
│   │       └── (tabs)/
│   │           └── livestream.tsx           # NEW — Go Live / broadcast controls, gated by allowedTabs.livestream
│   ├── customer-app/
│   │   └── src/app/
│   │       └── (tabs)/
│   │           └── live.tsx                 # NEW — cross-club discovery list + player launch
│   └── admin-app/
│       └── src/app/
│           └── (tabs)/
│               └── live-moderation.tsx      # NEW — platform-wide active stream list + Force-End Stream
├── packages/
│   ├── convex/
│   │   ├── livestream.ts                    # NEW — queries/mutations: provisionChannel, startStream, endStream,
│   │   │                                     #        getActiveStreamsForClub, getActiveStreamsPlatformWide,
│   │   │                                     #        getPlaybackToken, adminForceEndStream
│   │   ├── livestreamActions.ts             # NEW — AWS SDK calls: createIvsChannel, createStreamKey, stopIvsStream
│   │   └── livestreamWebhook.ts             # NEW — Convex HTTP Action receiving AWS EventBridge events
│   └── ui/
│       └── components/
│           ├── LiveStreamBroadcastControls.tsx   # NEW — Owner App Go Live / End Stream UI + camera preview
│           ├── LiveStreamCard.tsx                # NEW — Customer App discovery list card
│           ├── LiveStreamPlayer.tsx              # NEW — Customer App full-screen IVS player wrapper
│           └── LiveStreamModerationList.tsx      # NEW — Admin App moderation list + force-end dialog
```

### 2.6 `packages/convex` File Structure (Additions)

> **⚠ NEW — Design Specification:** Extends TDD v1.8 §2.6.

```
packages/convex/
├── ... (unchanged from TDD v1.8 §2.6)
├── livestream.ts          # NEW — public queries/mutations (see §2.5 above)
├── livestreamActions.ts   # NEW — internalAction wrappers around @aws-sdk/client-ivs calls
└── livestreamWebhook.ts   # NEW — httpAction for the EventBridge → Convex webhook (§5)
```

> **ℹ Note on `model/staffTabAccess.ts`:** This file gains one additional string literal value, `'livestream'`, in the `allowedTabs` union — the ninth such addition, following the same pattern as `'documents'`, `'kitchen'`, and `'loyalty'`.

---

## 3. Authentication & Security

Unchanged from TDD v1.8 §3 in pattern. The Live Streaming feature slots in as follows:

- **`livestream.tsx` (Owner App tab)** is gated by `allowedTabs.livestream` via `staffTabAccess.ts`, enforced per-call on every livestream mutation a staff member might invoke — the same pattern as every other tab.
- **`startStream` / `endStream` mutations** require `requireStaffTabAccess(ctx, roleId, 'livestream')` (or `requireOwner`, for the owner's own device, which always implicitly has every tab). There is no separate "view-only" tier for staff in this phase (PRD §7.7).
- **`provisionChannel`** (the one-time-per-club AWS IVS channel creation) is invoked internally as a side-effect of the first `startStream` call for a club that has no `ivsChannelArn` yet — it is not a standalone, directly callable mutation, to avoid any path that could create orphaned channels without an accompanying stream attempt.
- **`getPlaybackToken`** (Customer App) requires only a standard authenticated customer session (`ctx.auth.getUserIdentity()`), exactly as `getCustomerLoyaltyStatus` does (TDD v1.7 §8.16) — **no `allowedTabs` concept applies to the Customer App at all**, and no additional entitlement check (subscription, club membership) is performed, per PRD §8.10's explicit "free to watch" design decision.
- **`adminForceEndStream`** requires the existing Admin authentication/authorization pattern (consistent with other Admin-only mutations referenced in TDD v1.5/v1.6, e.g. the session force-end capability) and **additionally requires a non-empty `reason` string**, persisted to `liveStreamModerationLog`.
- **AWS credentials** (`AWS_IVS_ACCESS_KEY_ID`/`AWS_IVS_SECRET_ACCESS_KEY`) and the **playback-authorization private key** are used exclusively inside `internalAction`s — never inside a `query` or any function whose result is returned directly to a client. The IVS stream key itself (the secret that lets a broadcaster authenticate to the ingest endpoint) is fetched fresh, server-side, at the moment `startStream` succeeds, and returned **once**, directly to the calling owner/staff device, over the standard authenticated Convex connection — it is never persisted to any field readable by a different role (Customer App, Admin App) and the Owner App is expected to hold it only in memory for the duration of the active broadcast (not in persistent storage on-device).

---

## 4. Data Architecture

### 4.0.7 PRD v31 Live Streaming Schema (NEW — Design Specification, Not Yet Implemented)

> **⚠ NEW — Design Specification:** One new Club DB table, one new Central DB table, and four new optional fields on the existing `clubs` table. Field names match PRD v31 §10 exactly.

#### `clubs` table additions

```typescript
// Additive fields on the existing clubs table definition:
ivsChannelArn: v.optional(v.string()),       // set on first provisioning; null/absent = never gone live
ivsIngestEndpoint: v.optional(v.string()),   // RTMPS ingest URL, returned by IVS at channel-creation time
ivsStreamKeyArn: v.optional(v.string()),     // reference only — NOT the secret value itself (see note below)
ivsPlaybackUrl: v.optional(v.string()),      // persistent HLS playback URL for this club's channel
```

> **⚠ Security note:** `ivsStreamKeyArn` stores the AWS **ARN** of the stream key resource, which is safe to keep in this field — it is an identifier, not a credential. The actual secret stream-key **value** (the string AWS IVS requires for ingest authentication) is **never** persisted in Convex at all. It is fetched fresh from AWS (`ivs:GetStreamKey`, using the ARN) inside the `startStream` action each time a broadcast begins, and handed directly to the calling client in the mutation's response — it does not need to be stored once the broadcast SDK has consumed it. This avoids any at-rest secret-value storage for this particular credential.

#### `liveStreams` (Club DB)

```typescript
liveStreams: defineTable({
  clubId: v.id('clubs'),
  title: v.optional(v.string()),             // ≤80 chars, free text, owner-supplied
  tableLabel: v.optional(v.string()),        // free text only — never a foreign key to `tables` or `sessions`
  status: v.union(v.literal('live'), v.literal('ended')),
  startedBy: v.id('users'),
  startedAt: v.number(),
  endedAt: v.optional(v.number()),
  endedReason: v.optional(v.union(
    v.literal('owner_ended'),
    v.literal('admin_force_ended'),
    v.literal('connection_lost'),
    v.literal('stale_auto_closed'),
  )),
  peakViewerCount: v.optional(v.number()),   // best-effort, updated by periodic polling (§4.10)
})
  .index('by_clubId_status', ['clubId', 'status'])     // enforce "one active stream per club"
  .index('by_status_startedAt', ['status', 'startedAt']), // cross-club discovery query (§4.11)
```

> **ℹ Design note — why `tableLabel` is a free-text field, not a foreign key:** PRD §7.13 deliberately keeps stream metadata free of any link to a real session, booking, or customer record, since the stream is visible to anonymous viewers platform-wide. Making `tableLabel` a `v.id('tables')` reference would make it trivial to later join against `tables`/`sessions` and leak operational data; a plain string avoids that risk structurally, not just by convention.

#### `liveStreamModerationLog` (Central DB)

```typescript
liveStreamModerationLog: defineTable({
  clubId: v.id('clubs'),
  liveStreamId: v.id('liveStreams'),
  adminId: v.id('users'),
  reason: v.string(),     // required, non-empty, enforced in the mutation
  endedAt: v.number(),
}).index('by_clubId', ['clubId']),
```

#### `staffRoles.allowedTabs` addition

The union in the `allowedTabs` field validation gains `v.literal('livestream')` alongside the existing eight values.

---

### 4.10 Channel Provisioning & Broadcast Lifecycle (NEW — Design Specification, Not Yet Implemented)

```typescript
// packages/convex/livestream.ts

export const startStream = mutation({
  args: {
    clubId: v.id('clubs'),
    roleId: v.optional(v.id('staffRoles')),
    title: v.optional(v.string()),
    tableLabel: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireStaffTabAccess(ctx, args.roleId, 'livestream'); // owner always passes implicitly

    // Step 1 — Enforce one active stream per club
    const existingLive = await ctx.db
      .query('liveStreams')
      .withIndex('by_clubId_status', q => q.eq('clubId', args.clubId).eq('status', 'live'))
      .first();
    if (existingLive) {
      throw new Error('LIVESTREAM_001: A stream is already live for this club');
    }

    // Step 2 — Ensure the club has an IVS channel (lazy, one-time provisioning)
    const club = await ctx.db.get(args.clubId);
    let { ivsChannelArn, ivsIngestEndpoint, ivsStreamKeyArn, ivsPlaybackUrl } = club!;
    if (!ivsChannelArn) {
      const provisioned = await ctx.scheduler.runAfter(0, internal.livestreamActions.createIvsChannel, {
        clubId: args.clubId,
      });
      // createIvsChannel is awaited via a runMutation-from-action callback pattern in the real
      // implementation (or invoked as a direct runAction call here rather than scheduled, since
      // the caller needs the result synchronously to proceed) — see implementation note below.
    }

    // Step 3 — Fetch a fresh stream key value from AWS (never persisted at rest, see §4.0.7)
    const streamKeyValue = await ctx.runAction(internal.livestreamActions.getStreamKeyValue, {
      ivsStreamKeyArn: club!.ivsStreamKeyArn,
    });

    // Step 4 — Create the liveStreams record
    const liveStreamId = await ctx.db.insert('liveStreams', {
      clubId: args.clubId,
      title: args.title,
      tableLabel: args.tableLabel,
      status: 'live',
      startedBy: ctx.auth.userId()!,
      startedAt: Date.now(),
    });

    return {
      liveStreamId,
      ingestEndpoint: club!.ivsIngestEndpoint,
      streamKeyValue, // returned once, directly to the broadcasting client — never stored server-side
    };
  },
});
```

> **ℹ Implementation note — synchronous channel provisioning:** Because the very first "Go Live" tap for a club needs the IVS channel's ingest endpoint and stream key *before* the broadcast SDK can start, channel provisioning on a club's first-ever stream cannot use the pure fire-and-forget `ctx.scheduler.runAfter(0, …)` pattern used elsewhere in this product (TDD v1.7 §6.1, TDD v1.8 §4.9) — it must be awaited synchronously within the `startStream` flow (e.g. via `ctx.runAction(internal.livestreamActions.createIvsChannel, …)` called directly, not scheduled, accepting the small one-time latency cost on a club's very first stream only). Every subsequent stream for that club skips this step entirely, since `ivsChannelArn` is already set.

```typescript
export const endStream = mutation({
  args: { clubId: v.id('clubs'), roleId: v.optional(v.id('staffRoles')) },
  handler: async (ctx, args) => {
    await requireStaffTabAccess(ctx, args.roleId, 'livestream');
    const live = await ctx.db
      .query('liveStreams')
      .withIndex('by_clubId_status', q => q.eq('clubId', args.clubId).eq('status', 'live'))
      .first();
    if (!live) {
      throw new Error('LIVESTREAM_003: No stream is currently live for this club');
    }
    await ctx.db.patch(live._id, {
      status: 'ended', endedAt: Date.now(), endedReason: 'owner_ended',
    });
    // Best-effort, non-blocking: ask AWS IVS to confirm/close the ingest session.
    await ctx.scheduler.runAfter(0, internal.livestreamActions.stopIvsStream, { clubId: args.clubId });
  },
});
```

**Best-effort viewer count:** A lightweight, periodic (e.g. every 30–60s, client-driven poll while the Owner App's broadcast screen is open) call to `internal.livestreamActions.getViewerCount` (wrapping `ivs:GetStream`) updates `liveStreams.peakViewerCount` if the latest count exceeds the stored value. This is explicitly best-effort per PRD §7.13 Out of Scope — there is no push-based, per-viewer-join/leave tracking.

---

### 4.11 Cross-Club Live Stream Discovery Query (NEW — Design Specification, Not Yet Implemented)

This is the platform's first intentional, narrowly-scoped exception to per-club data isolation (PRD §3.3). It is implemented as a single dedicated query — the same architectural pattern already used for Admin's cross-club revenue aggregate (TDD v1.5, referenced in every PRD version's §3.3 table) — rather than a duplicated central registry table.

```typescript
// packages/convex/livestream.ts

export const getActiveStreamsPlatformWide = query({
  args: {}, // any authenticated customer; no clubId scoping by design
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return []; // unauthenticated → empty list, not an error

    const liveStreams = await ctx.db
      .query('liveStreams')
      .withIndex('by_status_startedAt', q => q.eq('status', 'live'))
      .order('desc') // newest-first
      .collect();

    // Join only the minimal, non-sensitive club fields needed for display.
    return Promise.all(liveStreams.map(async (stream) => {
      const club = await ctx.db.get(stream.clubId);
      return {
        liveStreamId: stream._id,
        clubId: stream.clubId,
        clubName: club?.name,
        clubBannerImageUrl: club?.profileImageUrl, // existing public club-profile field, unchanged
        title: stream.title,
        tableLabel: stream.tableLabel,
        startedAt: stream.startedAt,
        viewerCount: stream.peakViewerCount ?? 0,
      };
    }));
  },
});
```

> **ℹ Design note — why this does not weaken club data isolation:** Every other field on `clubs`, `tables`, `sessions`, `bookings`, etc. remains completely inaccessible cross-club. This query returns **only** five club-level fields that are already public by nature (a club's own name and profile banner are already shown to any customer via Club Discovery, PRD §8.2) plus three stream-level fields the owner explicitly chose to make public by going live (`title`, `tableLabel`, `startedAt`) and a best-effort viewer count. No session, booking, financial, staff, or document data is reachable through this query, directly or via any join. This mirrors the existing "Club DB read-only aggregates" carve-out used for Admin's revenue totals (PRD §3.3) — same architectural pattern, different (and even more restrictive) field set, different audience.

---

### 4.12 Playback Authorization Token Design (NEW — Design Specification, Not Yet Implemented)

AWS IVS channels are configured as **private** (`authorized: true` at channel-creation time), meaning playback requires a valid signed JWT, regardless of viewer identity or entitlement. This is purely an access-control mechanism — per PRD §8.10, **every authenticated customer is granted a token on request**, with no subscription, payment, or club-membership check.

```typescript
// packages/convex/livestream.ts

export const getPlaybackToken = query({
  args: { liveStreamId: v.id('liveStreams') },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error('UNAUTHENTICATED');

    const stream = await ctx.db.get(args.liveStreamId);
    if (!stream || stream.status !== 'live') {
      throw new Error('LIVESTREAM_004: This stream is not currently active');
    }
    const club = await ctx.db.get(stream.clubId);

    // Token signing itself requires the AWS_IVS_PLAYBACK_AUTH_PRIVATE_KEY secret,
    // so the actual signing happens in an internalAction, invoked here via ctx.runAction.
    const token = await ctx.runAction(internal.livestreamActions.signPlaybackToken, {
      channelArn: club!.ivsChannelArn,
    });

    return { playbackUrl: club!.ivsPlaybackUrl, token, expiresInSeconds: 3600 };
  },
});
```

```typescript
// packages/convex/livestreamActions.ts (excerpt)

export const signPlaybackToken = internalAction({
  args: { channelArn: v.string() },
  handler: async (ctx, args) => {
    // ECDSA-signed JWT per AWS IVS's private-channel playback-authorization spec:
    // claims include the channel ARN, an expiry (~1 hour), and the registered key-pair ID.
    return signJwt({
      keyPairId: process.env.AWS_IVS_PLAYBACK_AUTH_KEY_PAIR_ID!,
      privateKeyPem: process.env.AWS_IVS_PLAYBACK_AUTH_PRIVATE_KEY!,
      claims: {
        'aws:channel-arn': args.channelArn,
        'aws:access-control-allow-origin': '*',
        exp: Math.floor(Date.now() / 1000) + 3600,
      },
    });
  },
});
```

> **ℹ Design note — token refresh for long watch sessions:** Tokens expire after 1 hour. The Customer App's `LiveStreamPlayer` component re-calls `getPlaybackToken` roughly every 45 minutes while actively playing (PRD §8.10 Step 5), well before expiry, and hands the IVS Player SDK the refreshed token without interrupting playback. This is a client-side responsibility — the token itself carries no server-side session state to revoke or extend.

> **ℹ Design note — this is not a per-customer entitlement check:** `getPlaybackToken`'s only gate is "is the caller an authenticated customer" and "is the stream currently live." There is intentionally no lookup against any subscription, payment, or per-club entitlement table, since none exists for this feature in this phase (PRD §7.13/§8.10).

---

## 5. Infrastructure & CI/CD

Unchanged from TDD v1.8 §5, with one addition:

> **⚠ NEW — Design Specification:** A new inbound HTTP route is required: `livestreamWebhook.ts`, a Convex `httpAction` registered at a path such as `/webhooks/ivs-events`. AWS EventBridge is configured (one-time, infrastructure-level setup, not application code) with a rule matching AWS IVS's `Stream Start` and `Stream End` events, targeting an **API Destination** pointed at this Convex HTTP route. The webhook handler verifies a shared-secret header (`AWS_EVENTBRIDGE_WEBHOOK_SECRET`, §2.4) before trusting the payload — the same defensive pattern already assumed to be in place for the existing Razorpay webhook (referenced but not detailed in this layered document stack; TDD v1.5/onboarding-web territory). On a verified `Stream End` event for a `liveStreams` row still marked `live`, the handler patches it to `status: 'ended'`, `endedReason: 'connection_lost'` (unless it was already closed via the normal `endStream` mutation or an admin force-end, in which case the event is a no-op). This is the mechanism referenced in PRD §7.13 "Reliability" and §14's first edge case.
>
> No new CI signal or build step is required beyond what any new TypeScript file already triggers in the existing pipeline (type-check, lint, test).

---

## 6. Integrations

### 6.1–6.10 Carried Forward

Unchanged from TDD v1.7 §6.1–§6.9 and TDD v1.8 §6.10.

### 6.11 AWS IVS — Channel Provisioning & Broadcast (NEW)

```
Owner App: "Go Live" tapped
    └─→ Convex mutation: livestream.startStream
            └─→ (first stream only) ctx.runAction(livestreamActions.createIvsChannel)
            │       └─→ AWS SDK: ivs.CreateChannel({ authorized: true, latencyMode: 'LOW', type: 'STANDARD' })
            │       └─→ AWS SDK: ivs.CreateStreamKey({ channelArn })
            │       └─→ ctx.db.patch(clubId, { ivsChannelArn, ivsIngestEndpoint, ivsStreamKeyArn, ivsPlaybackUrl })
            └─→ ctx.runAction(livestreamActions.getStreamKeyValue)
            │       └─→ AWS SDK: ivs.GetStreamKey({ arn: ivsStreamKeyArn }) → { value }
            └─→ ctx.db.insert('liveStreams', { status: 'live', ... })
            └─→ returns { ingestEndpoint, streamKeyValue } to the Owner App, once
Owner App device
    └─→ Amazon IVS Broadcast SDK (React Native) connects directly to ingestEndpoint using streamKeyValue
    └─→ video/audio bytes flow device → AWS IVS directly; never through Convex
```

`latencyMode: 'LOW'` is used for every channel, matching PRD §11's glass-to-glass latency target.

### 6.12 AWS IVS — Playback & EventBridge Webhook (NEW)

```
Customer App: stream card tapped
    └─→ Convex query: livestream.getPlaybackToken(liveStreamId)
            └─→ ctx.runAction(livestreamActions.signPlaybackToken) → JWT
            └─→ returns { playbackUrl, token }
Customer App device
    └─→ Amazon IVS Player SDK (React Native) connects directly to playbackUrl with token
    └─→ video bytes flow AWS IVS → device directly; never through Convex

AWS IVS (independently of the app)
    └─→ Stream Start / Stream End events → EventBridge rule → API Destination
            └─→ HTTPS POST → Convex httpAction: livestreamWebhook.ts
                    └─→ verify AWS_EVENTBRIDGE_WEBHOOK_SECRET header
                    └─→ on Stream End for a still-'live' liveStreams row: patch to 'ended' / 'connection_lost'
```

### 6.13 Admin Force-End (NEW)

```
Admin App: "Force-End Stream" + reason entered
    └─→ Convex mutation: livestream.adminForceEndStream({ liveStreamId, reason })
            └─→ requires admin auth + non-empty reason
            └─→ ctx.db.patch(liveStreamId, { status: 'ended', endedReason: 'admin_force_ended' })
            └─→ ctx.db.insert('liveStreamModerationLog', { adminId, reason, ... })
            └─→ ctx.scheduler.runAfter(0, livestreamActions.stopIvsStream)  # AWS SDK: ivs.StopStream({ channelArn })
            └─→ ctx.scheduler.runAfter(0, notificationsActions.sendLiveStreamForceEndedNotification)  # FCM, owner-directed
```

`ivs.StopStream` immediately terminates the underlying ingest session at the AWS level — the broadcaster's app is disconnected, not merely hidden from the Customer App's list (PRD §7.13 Validation Summary, item 7).

---

## 7. Cron Jobs

Unchanged from TDD v1.8 §7, with one addition:

> **⚠ NEW — Design Specification:** A new periodic cron job, `closeStaleLiveStreams`, runs every 30 minutes. It queries `liveStreams` via `by_status_startedAt` for rows with `status: 'live'` and `startedAt` older than a safety threshold (e.g. 8 hours — comfortably longer than any realistic billiards broadcast), and closes them out with `endedReason: 'stale_auto_closed'`. This is the final safety net referenced in PRD §14, covering the rare case where both the Owner App's own "End Stream" call *and* the AWS EventBridge webhook (§5/§6.12) fail to reconcile a stream's true offline state (e.g. a webhook delivery failure). This is the only cron job introduced across v25–v31; no other feature in this document stack has required one.

---

## 8. PRD Feature Implementation Notes

### 8.1–8.17 Carried Forward

Unchanged from TDD v1.6 §8.1–§8.14, TDD v1.7 §8.15–§8.16, and TDD v1.8 §8.17.

### 8.18 Owner App — Live Streaming (NEW — Design Specification, Not Yet Implemented)

Implements PRD §7.13's owner-facing UI.

- **`livestream.tsx` — new tab**, gated by `allowedTabs.livestream`, not passcode-gated (consistent with all operational tabs).
- **`LiveStreamBroadcastControls.tsx`** wraps the Amazon IVS Broadcast SDK for React Native. Key responsibilities: request camera/mic permission on first use; render the local camera preview; call `startStream` on "Go Live" and immediately initialize the broadcast session with the returned `ingestEndpoint`/`streamKeyValue`; call `endStream` on "End Stream" and tear down the broadcast session; poll `getViewerCount` periodically while live (§4.10); surface AWS connection-state changes (e.g. a brief network hiccup) without necessarily ending the stream record, distinguishing transient SDK-level reconnects from a true `Stream End` event (the latter is what the EventBridge webhook reacts to, not every transient SDK state change).
- **Title/table-label input:** a simple text field and optional free-text table picker, submitted as part of the `startStream` call's args — no separate "save metadata" step.

> **ℹ Implementation note — native module / Expo config plugin required:** The Amazon IVS Broadcast SDK is a native module (camera/mic capture, RTMPS encoding) and is **not** usable inside Expo Go. This requires an Expo config plugin and a custom development build (EAS Build or local prebuild) for the Owner App — the first such requirement introduced by any feature in this document stack for the Owner App specifically (the Customer App already has a known, unrelated prebuild issue — see tech debt item 17, carried through every prior TDD version — which does not block the Owner App).

### 8.19 Customer App — Watch Live (NEW — Design Specification, Not Yet Implemented)

Implements PRD §8.10's customer-facing UI.

- **`live.tsx` — new top-level tab.** Calls `useQuery(api.livestream.getActiveStreamsPlatformWide, {})`, reactive, no manual refresh needed. Renders a grid/list of `LiveStreamCard` components; renders the empty state when the result is `[]`.
- **`LiveStreamCard.tsx`** — presentational only; displays club banner, name, "LIVE" badge, title, table label, viewer count. On tap, navigates to a full-screen player route, passing `liveStreamId`.
- **`LiveStreamPlayer.tsx`** — wraps the Amazon IVS Player SDK for React Native. On mount, calls `getPlaybackToken(liveStreamId)`, then initializes playback with `{ playbackUrl, token }`. Sets a `setInterval` (≈45 min) to silently re-call `getPlaybackToken` and hand the SDK a refreshed token before the prior one's ~1-hour expiry (§4.12). Listens for the player SDK's "ended"/"disconnected" event to show the "This stream has ended" state (PRD §8.10 Step 4) rather than a generic error.

> **ℹ Implementation note — native module / Expo config plugin required:** The Amazon IVS Player SDK is also a native module, requiring the same Expo config plugin + custom dev client treatment as the Broadcast SDK (§8.18).
>
> **⚠ Dependency reminder:** Per TDD v1.6 §10.2 / TDD v1.7 §10.2 / TDD v1.8 §10.2, the Customer App's dev build currently fails at prebuild (tech debt item 17). This pre-existing issue **also blocks** testing `live.tsx` and `LiveStreamPlayer.tsx` on-device, in addition to the Loyalty Status card and Directions features it already blocked. Live Streaming's native-module requirement makes resolving item 17 even more urgent than before, since — unlike the Loyalty card, which degrades gracefully without a native module — the Watch Live feature cannot function at all without a successful custom dev client build.

### 8.20 Admin App — Live Stream Moderation (NEW — Design Specification, Not Yet Implemented)

Implements PRD §6's moderation capability.

- **`live-moderation.tsx` — new tab.** Calls `getActiveStreamsPlatformWide` (the same query the Customer App uses — no separate admin-only query needed, since the data exposed is already non-sensitive by design, §4.11) joined with each stream's `startedBy` user for staff/owner attribution (an admin-only addition to the returned shape, via a thin admin-scoped wrapper query that adds the `startedBy` user's name, not exposed to the Customer App's version).
- **`LiveStreamModerationList.tsx`** — list of active streams with a **Force-End** button per row, opening a confirmation dialog requiring a non-empty reason before calling `adminForceEndStream`.
- No native module required — this screen is pure Convex query + standard RN views (the Admin App does not need to play or broadcast video, only list and terminate streams).

---

## 9. Error Handling

### 9.1 Carried Forward

Unchanged from TDD v1.8 §9.1 (which itself carried forward TDD v1.7 §9.1).

### 9.2 Error Code Registry (Additions)

> **⚠ NEW — Design Specification:** Extends the registry (TDD v1.7 §9.2; TDD v1.8 added none) with Live Streaming-specific codes.

| Code | Meaning | Domain |
|---|---|---|
| `LIVESTREAM_001` | A stream is already live for this club — only one active stream per club is permitted at a time | Live Streaming, §4.10 |
| `LIVESTREAM_002` | An AWS IVS API call failed during channel provisioning, stream-key retrieval, or stop-stream | Live Streaming, §4.10, §6.11, §6.13 |
| `LIVESTREAM_003` | Attempted to end a stream that is not currently live | Live Streaming, §4.10 |
| `LIVESTREAM_004` | Attempted to request a playback token for a stream that is not currently active (already ended or never started) | Live Streaming, §4.12 |

These codes should be added to `packages/ui/errors/errorCodes.ts` alongside the existing `KITCHEN_*`, `TAX_*`, `DOC_*`, and `LOYALTY_*` codes. No `LIVESTREAM_005`-style "insufficient entitlement" code exists, by design — there is no entitlement check to fail (PRD §8.10).

### 9.3 Client-Side Error Architecture

Unchanged from TDD v1.6 §9.3. The `parseConvexError` / `TabErrorBoundary` architecture picks up `LIVESTREAM_*` codes automatically once added to `errorCodes.ts`. `LIVESTREAM_002` (AWS API failure) should surface as a generic, retry-able error in the Owner App UI — engineers should not surface raw AWS SDK error messages to end users.

---

## 10. App-Specific Technical Details

### 10.1 Owner App (Additions)

Carried forward from TDD v1.6–v1.8 §10.1 in full, with one addition:

- **Live Stream tab (`livestream.tsx`):** gated by `allowedTabs.livestream`, not passcode-gated. **Requires a new native module** (Amazon IVS Broadcast SDK) and an Expo config plugin — the Owner App will need a custom development build going forward; it can no longer be fully exercised inside Expo Go once this feature is merged. Camera and microphone permission strings must be added to `app.json`/`Info.plist`/`AndroidManifest.xml` for both platforms.

### 10.2 Customer App (Additions)

Carried forward from TDD v1.6–v1.8 §10.2 in full, with one addition:

- **Live tab (`live.tsx`) and `LiveStreamPlayer`:** **Requires a new native module** (Amazon IVS Player SDK) and the same Expo config plugin treatment as the Owner App. **This feature cannot be validated on-device until tech debt item 17 (Customer App prebuild failure) is resolved** — see §8.19's dependency reminder. Unlike the Loyalty Status card, which renders nothing and is otherwise harmless if untestable, the Watch Live tab is non-functional without a successful native build, since the player SDK itself is a native module with no pure-JS fallback.

### 10.3 Admin App (Additions)

- **Live moderation tab (`live-moderation.tsx`):** No new native module — pure Convex queries/mutations + standard RN views, consistent with the rest of the Admin App.

### 10.4 Onboarding Web

Unchanged from TDD v1.6–v1.8 §10.4. Live Streaming has no Onboarding Website surface (PRD §5).

---

## 11. Design System

Unchanged from TDD v1.8 §11. The following usage guidance is added for Live Streaming UI:

- **"LIVE" badge:** use `status.error`/red or a dedicated high-attention accent (consistent with the near-universal convention of red "LIVE" indicators), distinct from the amber `status.warning` token used for the Walk-In Conflict badge (TDD v1.8 §11) and the green/blue tokens used for Loyalty (TDD v1.7 §11) — this is the first UI element in the product that should read as "urgent/now," not "advisory" or "positive."
- **Camera preview / player containers:** full-bleed, no rounded corners or card chrome around the video surface itself (standard video-player convention); surrounding metadata (title, club name, viewer count) uses the existing typography scale and dark theme already established (§11 of prior TDD versions; no new design tokens are introduced).
- **Force-End dialog (Admin App):** reuse the existing generic confirmation-dialog primitive (as established in TDD v1.8 §11 for `WalkInConflictDialog`), styled with the destructive/danger button variant already used elsewhere for irreversible actions (e.g. Loyalty's "Reset all credit balances," TDD v1.7 §8.15).

---

## 12. Testing & CI

Carried forward from TDD v1.8 §12. The target test plan for Live Streaming:

| Area | Critical-path tests |
|---|---|
| Channel provisioning | First `startStream` for a club with no `ivsChannelArn` provisions a channel and persists all four `clubs` fields; subsequent `startStream` calls skip provisioning; provisioning failure surfaces `LIVESTREAM_002` and leaves no orphaned `liveStreams` row |
| Stream lifecycle | `startStream` rejected with `LIVESTREAM_001` if already live; `endStream` rejected with `LIVESTREAM_003` if not live; successful `endStream` sets `endedReason: 'owner_ended'` |
| RBAC | Staff without `livestream` cannot call `startStream`/`endStream` (server-side rejection, tab hidden client-side); owner always succeeds regardless of `allowedTabs` |
| Cross-club discovery | `getActiveStreamsPlatformWide` returns streams from multiple different clubs in one result set; ended/never-started streams excluded; only the documented minimal field set is present in the response (no session/booking/financial leakage) |
| Playback token | `getPlaybackToken` succeeds for any authenticated customer regardless of which club they've visited; rejected with `LIVESTREAM_004` for an ended/nonexistent stream; rejected for an unauthenticated caller |
| EventBridge webhook | Verified `Stream End` event closes a still-`live` row with `endedReason: 'connection_lost'`; event for an already-`ended` row is a no-op; request with an invalid/missing shared-secret header is rejected |
| Stale-stream cron | A `liveStreams` row with `status: 'live'` and `startedAt` older than the threshold is closed out with `endedReason: 'stale_auto_closed'` by the periodic job; a recent `live` row is left untouched |
| Admin moderation | `adminForceEndStream` requires a non-empty reason; results in `endedReason: 'admin_force_ended'`, a `liveStreamModerationLog` insert, an `ivs:StopStream` call, and a best-effort FCM notification to the owner |
| Regression | Existing Slot Management, billing, and walk-in conflict alert behavior (TDD v1.5/v1.8) is completely unaffected — Live Streaming touches no existing table, mutation, or query |

---

## 13. Consolidated Technical Debt & Recommended Fixes

### Carried Forward from TDD v1.8 §13 (Items 1–26, Unchanged)

All 26 items in TDD v1.8 §13 remain open and unchanged. Item 17 (Customer App prebuild failure) is now blocking **two** features (Loyalty Status card, and as of this version, the entire Watch Live tab) — see §10.2's escalated note.

### New Items (This Version)

| # | Item | Recommended Fix | Reference |
|---|---|---|---|
| 31 | Live Streaming is specified (PRD v31 / TDD v1.9) but **not yet implemented**, and is the most architecturally complex feature specified to date (first AWS integration, two native-module SDKs, first inbound webhook surface) | Implement against this design (§4.0.7, §4.10–§4.12, §5, §6.11–§6.13, §8.18–§8.20); given the complexity, consider implementing and testing the Owner App broadcast path and the Customer App playback path as separate, sequential milestones rather than one combined release | PRD §15, this document throughout |
| 32 | Item 17 (Customer App prebuild failure) now blocks a fully non-functional feature (Watch Live), not just a degraded one (Loyalty card) | Re-prioritize fixing item 17 ahead of Watch Live's on-device QA; consider it a hard pre-requisite for shipping Live Streaming, not a nice-to-have | §8.19, §10.2 |
| 33 | The Owner App's Live Stream tab and the Customer App's Live tab both require a custom Expo development build going forward (no longer Expo-Go-compatible) | Confirm the team's CI/CD and local-dev workflows are updated to build and distribute custom dev clients for both apps before this feature merges; document the new build requirement in the project README | §8.18, §10.1 |
| 34 | The playback-authorization private key (`AWS_IVS_PLAYBACK_AUTH_PRIVATE_KEY`) is a long-lived secret that, if leaked, would allow minting valid playback tokens for any channel indefinitely until rotated | Establish a key-rotation runbook (even if manual/infrequent) and ensure the secret is stored only in Convex's environment-variable secret store, never committed or logged | §2.4, §4.12 |
| 35 | No analytics on stream watch time, unique viewers, or discovery-to-watch conversion | Out of scope per PRD §7.13/§8.10, but flagged as a natural follow-up once the core feature is live and usage data is needed for product decisions | §7.13/§8.10 (PRD) |

---

## 14. Appendix

### 14.1 Version History

| Version | Changes |
|---|---|
| 1.0–1.5 | See TDD v1.5 §14.1 for full history through the June 2026 as-built audit. |
| 1.6 | PRD v28 alignment. Document Holder, Customer Directions, GST & Tax Report, Kitchen & Chef Role. See TDD v1.6 §14.1. |
| 1.7 | PRD v29 alignment. Membership Loyalty. See TDD v1.7 §14.1. |
| 1.8 | PRD v30 alignment. Walk-In Booking Conflict Alert. See TDD v1.8 §14.1. |
| **1.9** | **PRD v31 alignment (this version). Adds forward-looking design specification for Live Streaming (PRD §7.13/§8.10) — the platform's first AWS integration. New schema: one Club DB table (`liveStreams`), one Central DB table (`liveStreamModerationLog`), four new optional fields on `clubs` (`ivsChannelArn`, `ivsIngestEndpoint`, `ivsStreamKeyArn`, `ivsPlaybackUrl`), and a new `'livestream'` value on `staffRoles.allowedTabs`. New Convex files: `livestream.ts` (queries/mutations), `livestreamActions.ts` (AWS SDK calls), `livestreamWebhook.ts` (EventBridge inbound webhook, the platform's first inbound webhook surface in this document stack). New environment variables: `AWS_IVS_REGION`, `AWS_IVS_ACCESS_KEY_ID`, `AWS_IVS_SECRET_ACCESS_KEY`, `AWS_IVS_PLAYBACK_AUTH_KEY_PAIR_ID`, `AWS_IVS_PLAYBACK_AUTH_PRIVATE_KEY`, `AWS_EVENTBRIDGE_WEBHOOK_SECRET`. New error codes: LIVESTREAM_001–LIVESTREAM_004. New UI components across three apps: `LiveStreamBroadcastControls`, `LiveStreamCard`, `LiveStreamPlayer`, `LiveStreamModerationList`. New cron job: `closeStaleLiveStreams` (the first cron job introduced across the entire v25–v31 feature set). Two new native-module dependencies (Amazon IVS Broadcast SDK in the Owner App; Amazon IVS Player SDK in the Customer App), each requiring a custom Expo development build going forward. The platform's first deliberate, narrowly-scoped exception to per-club data isolation (§4.11), modeled directly on the existing Admin cross-club revenue aggregate pattern. No subscription, payment, or per-customer entitlement check is implemented — viewing is free for any authenticated customer, per PRD §8.10. No existing table, index, mutation, billing formula, or auth provider is changed. Consolidated technical debt extended with items 31–35. TDD v1.5's as-built baseline and TDD v1.6–v1.8's prior feature designs are carried forward unchanged.** |

---

*End of Document — TDD v1.9 supersedes TDD v1.8 for the Live Streaming design specification only; TDD v1.8 remains the canonical design reference for the Walk-In Booking Conflict Alert; TDD v1.7 remains canonical for Membership Loyalty; TDD v1.6 remains canonical for Document Holder, Customer Directions, GST & Tax Report, and Kitchen & Chef Role; TDD v1.5 remains the canonical as-built reference for all previously-shipped functionality. Once Live Streaming (and ideally all seven net-new features from PRD v25–v31) is implemented, a code audit should be commissioned and TDD v1.10 (or a consolidated v2.0) issued to reconcile all design specifications against the real build.*
