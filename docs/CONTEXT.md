## Workflow Orchestration

### 1. Plan Node Default
- Enter plan mode for ANY non-trivial task (3+ steps or architectural decisions)
- If something goes sideways, STOP and re-plan immediately - don't keep pushing
- Use plan mode for verification steps, not just building
- Write detailed specs upfront to reduce ambiguity

### 2. Subagent Strategy
- Use subagents liberally to keep main context window clean
- Offload research, exploration, and parallel analysis to subagents
- For complex problems, throw more compute at it via subagents
- One task per subagent for focused execution

### 3. Self-Improvement Loop
- After ANY correction from the user: update `tasks/lessons.md` with the pattern
- Write rules for yourself that prevent the same mistake
- Ruthlessly iterate on these lessons until mistake rate drops
- Review lessons at session start for relevant project

### 4. Verification Before Done
- Never mark a task complete without proving it works
- Diff behavior between main and your changes when relevant
- Ask yourself: "Would a staff engineer approve this?"
- Run tests, check logs, demonstrate correctness

### 5. Demand Elegance (Balanced)
- For non-trivial changes: pause and ask "is there a more elegant way?"
- If a fix feels hacky: "Knowing everything I know now, implement the elegant solution"
- Skip this for simple, obvious fixes - don't over-engineer
- Challenge your own work before presenting it

### 6. Autonomous Bug Fizing
- When given a bug report: just fix it. Don't ask for hand-holding
- Point at logs, errors, failing tests - then resolve them
- Zero context switching required from the user
- Go fix failing CI tests without being told how

### 7. State Persistence (`currentstate.md`)
- **Maintain State**: After every prompt, update `currentstate.md` at the project root.
- **Content**: Keep it concise. Include:
  - **Current Task**: Brief summary of the active objective.
  - **New Decisions**: Any architectural or logic changes made in the last turn.
  - **New Commits/Changes**: Files modified and why.
  - **Active Blockers/Errors**: Unresolved bugs or pending test failures.
- **Context Priming**: Read this file at the start of every new interaction to ensure continuity.
- **Purge Strategy**: Remove completed items once documented in `tasks/lessons.md` to keep the file small.

## Task Management

1. **Plan First**: Write plan to `tasks/todo.md` with checkable items
2. **Verify Plan**: Check in before starting implementation
3. **Track Progress**: Mark items complete as you go
4. **Explain Changes**: High-level summary at each step
5. **Document Results**: Add review section to `tasks/todo.md`
6. **Capture Lessons**: Update `tasks/lessons.md` after corrections

## Core Principles

- **Simplicity First**: Make every change as simple as possible. Impact minimal code.
- **No Laziness**: Find root causes. No temporary fixes. Senior developer standards.
- **Minimat Impact**: Changes should only touch what's necessary. Avoid introducing bugs.



<!-- # A3 Billiards OS — Quick Context for Cursor AI

## What this project is
A multi-panel SaaS app for billiards clubs.
4 apps: Admin App, Owner App, Customer App, Onboarding Website.
All share one Convex backend at https://ardent-albatross-880.convex.cloud

## Stack
- Expo SDK 55, React Native 0.83, React 19.2
- Expo Router 4.0 — file-based routing in /src/app/
- Convex Pro — backend, real-time reactive queries
- @convex-dev/auth 0.0.68 — email/password auth
- TypeScript strict mode throughout
- pnpm 9 + Turborepo 2 monorepo
- OS: Windows PowerShell

## Non-Negotiable Rules (TDD v1.4)
- NEW ARCHITECTURE ONLY — newArchEnabled: true in every app
- DARK MODE ONLY — no light mode, no toggle
- ENGLISH ONLY in v1
- All crypto in Convex ACTIONS (never mutations)
- Zero gap between back-to-back bookings
  (slot ending 3:00 PM does NOT conflict with slot starting 3:00 PM)
- Booking start window: 15 min before to 30 min after booking time
- Touch targets: 44×44pt minimum on all interactive elements
- Status indicators: ALWAYS text + color (never color alone)
- Sessions are NEVER auto-completed — staff must end them manually

## Critical Auth Rule
- @convex-dev/auth@0.0.68 does NOT export isAuthenticated
- Only destructure: { auth, signIn, signOut, store } from convexAuth()

## Package Names
- @a3/admin-app, @a3/owner-app, @a3/customer-app
- @a3/onboarding-web, @a3/convex, @a3/ui, @a3/utils, @a3/emails

## Key File Locations
- Schema (DO NOT MODIFY): packages/convex/schema.ts
- Auth config: packages/convex/auth.config.ts
- Theme colors: packages/ui/theme/colors.ts
- Typography: packages/ui/theme/typography.ts
- Spacing: packages/ui/theme/spacing.ts
- Error codes: packages/ui/errors/errorCodes.ts
- Error boundaries: packages/ui/errors/ErrorBoundary.tsx
- Shared components: packages/ui/components/
- Billing formula: packages/utils/billing.ts
- OTP helpers: packages/utils/otp.ts
- FCM types: packages/utils/fcm.ts
- Availability: packages/utils/availability.ts
- Timezone (IST): packages/utils/timezone.ts
- Analytics: packages/utils/analytics.ts

## Color Tokens (WCAG 2.1 AA)
- bg.primary: #0D1117 (main background)
- bg.secondary: #161B22 (cards)
- bg.tertiary: #21262D (inputs)
- text.primary: #F0F6FC (17.4:1)
- text.secondary: #8B949E (6.2:1)
- accent.green: #43A047 (free tables, success)
- accent.amber: #F57F17 (pending, warnings)
- status.error: #F44336 (errors, occupied)
- status.info: #2196F3 (booking indicators)
- status.disabled: #484F58 (always + text label)

## Billing Formula
actualMinutes = ceil((endTime - startTime) / 60000)
billableMinutes = max(actualMinutes, minBillMinutes)
tableSubtotal = billableMinutes × ratePerMin
discountedTable = tableSubtotal × (1 - discount% / 100)
snackTotal = sum(priceAtOrder × qty)  [never discounted]
FINAL_BILL = discountedTable + snackTotal

## App URL Schemes
- Admin: a3admin://
- Owner: a3owner://
- Customer: a3customer://

## Key Documents
- PRD: docs/A3 Billiards OS 1.0 PRD v23 final.docx
- TDD: docs/A3_Billiards_OS_TDD_v1.4_FINAL.docx
- Booking Spec: docs/booking-spec.md
- Schema reference: docs/schema.md
- Schema file: packages/convex/schema.ts -->
