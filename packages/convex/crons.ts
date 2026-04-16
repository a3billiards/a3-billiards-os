import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// ─── 1. Subscription expiry check ───────────────────────────────────────────
// Runs daily at 00:00 UTC.
// Transitions: active → grace (at subscriptionExpiresAt),
//              grace → frozen (24 hours after subscriptionExpiresAt).
// Also dispatches renewal reminder emails at 7 days and 1 day before expiry.
crons.daily(
  "subscriptionCheck",
  { hourUTC: 0, minuteUTC: 0 },
  internal.subscriptions.checkExpiry,
);

// ─── 2. Booking approval deadline ───────────────────────────────────────────
// Runs every 5 minutes.
// (a) At 50% of approvalDeadlineMin elapsed: sends FCM reminder to owner,
//     sets approvalReminderSentAt to prevent duplicates.
// (b) At 100% elapsed: transitions booking pending_approval → expired,
//     mirrors to bookingLogs, sends FCM to customer.
crons.interval(
  "approvalDeadline",
  { minutes: 5 },
  internal.bookings.checkApprovalDeadlines,
);

// ─── 3. No-show detection ────────────────────────────────────────────────────
// Runs every 10 minutes.
// If a confirmed booking's requestedStartTime + 30 min has passed
// and sessionId is still null: transitions confirmed → expired,
// increments noShowCount on customerBookingStats,
// sends FCM to owner and customer.
// Special case: if club is frozen, customer notification body changes
// and owner notification is suppressed.
crons.interval(
  "noShowDetection",
  { minutes: 10 },
  internal.bookings.detectNoShows,
);

// ─── 4. Booking reminder (1 hour before start) ──────────────────────────────
// Runs every 5 minutes.
// For confirmed bookings where reminderSentAt is null and sessionId is null:
// if start time is 55–65 minutes away, sends FCM reminder to customer and owner,
// sets reminderSentAt to prevent duplicate sends.
crons.interval(
  "bookingReminder",
  { minutes: 5 },
  internal.bookings.sendReminders,
);

// ─── 5. FCM stale token cleanup ─────────────────────────────────────────────
// Runs daily at 03:00 UTC.
// Stale tokens are removed reactively on UNREGISTERED FCM response.
// This daily job is a safety-net pass for any tokens missed by the reactive path.
crons.daily(
  "fcmCleanup",
  { hourUTC: 3, minuteUTC: 0 },
  internal.notifications.cleanupStaleTokens,
);

// ─── 6. Account deletion purge ───────────────────────────────────────────────
// Runs daily at 02:00 UTC.
// Hard-deletes users whose deletionRequestedAt + 30 days < now.
// Owner deletion: purges clubs, tables, staffRoles, bookings, snacks.
//   Session billing records retained 90 days then purged separately.
// Customer deletion: users record is deleted; sessions/sessionLogs retained
//   (customerId becomes stale but records remain per PRD §8.7).
// Complaints retained 90 days after deletion request then purged.
crons.daily(
  "deletionPurge",
  { hourUTC: 2, minuteUTC: 0 },
  internal.deletion.purgeSoftDeleted,
);

// ─── 7. Session archiver ─────────────────────────────────────────────────────
// Runs daily at 04:00 UTC.
// CRITICAL: Convex has NO .monthly() method — this runs daily but the handler
// checks `new Date().getUTCDate() !== 1` and returns early on non-first days.
// On the 1st of each month: moves sessions older than 2 years to sessions_archive.
// sessions_archive has no reactive queries — read-only cold storage.
// Monthly financial aggregates are pre-computed at month-end to avoid
// full-table scans on large clubs.
crons.daily(
  "sessionArchiver",
  { hourUTC: 4, minuteUTC: 0 },
  internal.sessions.archiveIfFirstOfMonth,
);

export default crons;
