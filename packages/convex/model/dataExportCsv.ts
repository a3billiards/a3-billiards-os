/**
 * Human-readable CSV exports (Excel / Google Sheets).
 */

import { rowsToCsv } from "@a3/utils/csv";

type AdminUserRow = {
  userId: string;
  role: string;
  name: string;
  phone: string | null;
  email: string | null;
  age: number | null;
  phoneVerified: boolean;
  isFrozen: boolean;
  consentGiven: boolean;
  consentGivenAt: string | null;
  accountCreatedAt: string;
  deletionRequestedAt: string | null;
  sessionHistory: { total: number; lastDate: string | null };
  bookingHistory: { total: number; byStatus: Record<string, number> };
  complaintCount: number;
  ownerClub: {
    clubName: string;
    subscriptionStatus: string;
    subscriptionExpiresAt: string | null;
  } | null;
};

function formatWhen(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function yesNo(value: boolean): string {
  return value ? "Yes" : "No";
}

function bookingBreakdown(byStatus: Record<string, number>): string {
  const parts = Object.entries(byStatus)
    .filter(([, n]) => n > 0)
    .map(([status, n]) => `${status.replaceAll("_", " ")}: ${n}`);
  return parts.length > 0 ? parts.join("; ") : "—";
}

function adminUserTableRow(u: AdminUserRow): (string | number)[] {
  return [
    u.name,
    u.email ?? "—",
    u.phone ?? "—",
    u.role.charAt(0).toUpperCase() + u.role.slice(1),
    u.age ?? "—",
    yesNo(u.phoneVerified),
    yesNo(u.isFrozen),
    formatWhen(u.accountCreatedAt),
    u.deletionRequestedAt ? formatWhen(u.deletionRequestedAt) : "—",
    u.sessionHistory.total,
    formatWhen(u.sessionHistory.lastDate),
    u.bookingHistory.total,
    bookingBreakdown(u.bookingHistory.byStatus),
    u.complaintCount,
    u.ownerClub?.clubName ?? "—",
    u.ownerClub?.subscriptionStatus ?? "—",
    u.ownerClub?.subscriptionExpiresAt
      ? formatWhen(u.ownerClub.subscriptionExpiresAt)
      : "—",
  ];
}

const ADMIN_USER_HEADERS = [
  "Name",
  "Email",
  "Phone",
  "Role",
  "Age",
  "Phone verified",
  "Account frozen",
  "Joined",
  "Deletion requested",
  "Total sessions",
  "Last session",
  "Total bookings",
  "Bookings breakdown",
  "Complaints",
  "Club name (owners)",
  "Subscription",
  "Subscription expires",
] as const;

export function adminAllUsersCsv(args: {
  exportedAt: string;
  roleFilter: string;
  userCount: number;
  totalUsers: number;
  truncated: boolean;
  users: AdminUserRow[];
}): string {
  const rows: (string | number)[][] = [
    ["A3 Billiards — User data export"],
    ["Exported on", formatWhen(args.exportedAt)],
    ["Filter", args.roleFilter === "all" ? "All users" : args.roleFilter],
    ["Users in this file", args.userCount],
    ["Total on platform", args.totalUsers],
  ];
  if (args.truncated) {
    rows.push([
      "Note",
      `Only the first ${args.userCount} users are included. Use filters or contact support for a full archive.`,
    ]);
  }
  rows.push(
    [],
    [...ADMIN_USER_HEADERS],
    ...args.users.map(adminUserTableRow),
    [],
    [
      "Privacy note",
      "Summary data only. Detailed billing from individual clubs is not included.",
    ],
  );
  return rowsToCsv(rows);
}

export function adminSingleUserCsv(args: {
  exportedAt: string;
  user: AdminUserRow;
}): string {
  const u = args.user;
  const rows: (string | number)[][] = [
    ["A3 Billiards — User data export"],
    ["Exported on", formatWhen(args.exportedAt)],
    [],
    ["Field", "Value"],
    ["Name", u.name],
    ["Email", u.email ?? "—"],
    ["Phone", u.phone ?? "—"],
    ["Role", u.role.charAt(0).toUpperCase() + u.role.slice(1)],
    ["Age", u.age ?? "—"],
    ["Phone verified", yesNo(u.phoneVerified)],
    ["Account frozen", yesNo(u.isFrozen)],
    ["Consent given", yesNo(u.consentGiven)],
    ["Consent date", formatWhen(u.consentGivenAt)],
    ["Joined", formatWhen(u.accountCreatedAt)],
    [
      "Deletion requested",
      u.deletionRequestedAt ? formatWhen(u.deletionRequestedAt) : "No",
    ],
    ["Total sessions (all clubs)", u.sessionHistory.total],
    ["Last session", formatWhen(u.sessionHistory.lastDate)],
    ["Total bookings (all clubs)", u.bookingHistory.total],
    ["Bookings breakdown", bookingBreakdown(u.bookingHistory.byStatus)],
    ["Complaints filed", u.complaintCount],
  ];
  if (u.ownerClub) {
    rows.push(
      ["Club name", u.ownerClub.clubName],
      ["Subscription", u.ownerClub.subscriptionStatus],
      [
        "Subscription expires",
        u.ownerClub.subscriptionExpiresAt
          ? formatWhen(u.ownerClub.subscriptionExpiresAt)
          : "—",
      ],
    );
  }
  rows.push(
    [],
    [
      "Privacy note",
      "Summary data only. Detailed billing from individual clubs is not included.",
    ],
  );
  return rowsToCsv(rows);
}

type ClubMemberRow = {
  name: string;
  phone: string | null;
  email: string | null;
  age: number | null;
  phoneVerified: boolean;
  accountCreatedAt: string;
  sessionHistoryAtClub: { total: number; lastDate: string | null };
  bookingStatsAtClub: {
    totalBookings: number;
    noShowCount: number;
    lateCancellationCount: number;
  };
  complaintsAtClub: number;
};

export function clubMembersCsv(args: {
  exportedAt: string;
  clubName: string;
  memberCount: number;
  members: ClubMemberRow[];
}): string {
  const rows: (string | number)[][] = [
    ["A3 Billiards — Club members export"],
    ["Club", args.clubName],
    ["Exported on", formatWhen(args.exportedAt)],
    ["Members in this file", args.memberCount],
    [],
    [
      "Name",
      "Email",
      "Phone",
      "Age",
      "Phone verified",
      "Joined",
      "Sessions at this club",
      "Last visit",
      "Bookings at this club",
      "No-shows",
      "Late cancellations",
      "Complaints at this club",
    ],
    ...args.members.map((m) => [
      m.name,
      m.email ?? "—",
      m.phone ?? "—",
      m.age ?? "—",
      yesNo(m.phoneVerified),
      formatWhen(m.accountCreatedAt),
      m.sessionHistoryAtClub.total,
      formatWhen(m.sessionHistoryAtClub.lastDate),
      m.bookingStatsAtClub.totalBookings,
      m.bookingStatsAtClub.noShowCount,
      m.bookingStatsAtClub.lateCancellationCount,
      m.complaintsAtClub,
    ]),
    [],
    [
      "Privacy note",
      "Only activity at this club is included. Visits to other clubs are not shown.",
    ],
  ];
  return rowsToCsv(rows);
}

export function suggestExportFilename(prefix: string): string {
  const stamp = new Date().toISOString().slice(0, 10);
  return `${prefix}-${stamp}.csv`;
}
