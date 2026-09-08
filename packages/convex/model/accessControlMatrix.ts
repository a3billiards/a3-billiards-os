/**
 * Access control matrix — role × resource permissions (OWASP A01: Broken Access Control).
 *
 * Enforcement lives in `model/viewer.ts`, `model/staffTabAccess.ts`, and per-endpoint
 * checks. This file is the canonical policy reference for reviewers and new endpoints.
 *
 * Roles:
 * - **admin** — platform operator; MFA required for privileged reads/writes (`requireAdminWithMfa`).
 * - **owner** — single club via `clubs.by_owner`; unrestricted tabs when `roleId` omitted (owner mode).
 * - **staff** — owner account acting with `staffRoles` row (`roleId`); tab/table/discount limits enforced server-side.
 * - **customer** — own `userId` only; club data via public/discovery rules.
 * - **anonymous** — onboarding web actions only (rate-limited); no club/customer PII.
 *
 * Staff passcode: client gate only; server trusts authenticated owner JWT. When `roleId` is
 * omitted, owner mode receives full tab access (matches post-passcode unrestricted flow).
 * Future hardening: server-side passcode session token (documented gap).
 */

export type ActorRole = "admin" | "owner" | "staff" | "customer" | "anonymous";

export type AccessLevel =
  | "none" // denied
  | "own" // own userId / own club only
  | "club" // any data for viewer's clubId
  | "platform" // admin or intentional cross-club platform operation
  | "public"; // unauthenticated discovery fields

export type ResourcePolicy = {
  resource: string;
  admin: AccessLevel;
  owner: AccessLevel;
  staff: AccessLevel;
  customer: AccessLevel;
  anonymous: AccessLevel;
  enforcement: string;
  idorNotes?: string;
};

/** Canonical matrix — extend when adding Convex endpoints. */
export const ACCESS_CONTROL_MATRIX: ResourcePolicy[] = [
  {
    resource: "users (profile)",
    admin: "platform",
    owner: "club",
    staff: "club",
    customer: "own",
    anonymous: "none",
    enforcement: "users.getUser → ownerCanViewCustomer; updateUser → self or admin+MFA",
    idorNotes: "Owners cannot read arbitrary userId without club relationship.",
  },
  {
    resource: "users (desk lookup: name/phone/QR)",
    admin: "none",
    owner: "platform",
    staff: "platform",
    customer: "none",
    anonymous: "none",
    enforcement: "ownerCustomerLookup.* + complaints.searchCustomerByPhone; auth owner only",
    idorNotes:
      "Intentional platform-wide lookup for walk-in desk and complaint filing. Rate-limited separately.",
  },
  {
    resource: "clubs",
    admin: "platform",
    owner: "own",
    staff: "own",
    customer: "public",
    anonymous: "public",
    enforcement: "getClubForViewer; assertMutationClubScope",
  },
  {
    resource: "bookings (customer submit/cancel)",
    admin: "none",
    owner: "none",
    staff: "none",
    customer: "own",
    anonymous: "none",
    enforcement: "bookingLogs.customerId === viewer.userId",
  },
  {
    resource: "bookings (owner approve/reject/cancel/start)",
    admin: "none",
    owner: "club",
    staff: "club",
    customer: "none",
    anonymous: "none",
    enforcement: "booking.clubId === owner.clubId; assertStaffTabAllowed(bookings); roleContext tables",
  },
  {
    resource: "sessions / slots",
    admin: "none",
    owner: "club",
    staff: "club",
    customer: "own",
    anonymous: "none",
    enforcement: "table.clubId; assertSlotsTabPermission; table lock token on walk-in",
  },
  {
    resource: "complaints (file/retract)",
    admin: "platform",
    owner: "club",
    staff: "club",
    customer: "none",
    anonymous: "none",
    enforcement: "reportedByClubId; staff canFileComplaints when roleId set",
  },
  {
    resource: "complaints (active list for customer)",
    admin: "platform",
    owner: "club",
    staff: "club",
    customer: "own",
    anonymous: "none",
    enforcement:
      "getCustomerActiveComplaints requires clubId; descriptions redacted for other clubs",
    idorNotes: "Cross-club summary (type, club name) shown for session safety; no foreign descriptions.",
  },
  {
    resource: "financials / paymentReceipts",
    admin: "platform",
    owner: "own",
    staff: "club",
    customer: "none",
    anonymous: "none",
    enforcement: "financials assertMutationClubScope + tab; getPaymentHistory admin MFA or own ownerId",
  },
  {
    resource: "staffRoles / passcode",
    admin: "none",
    owner: "club",
    staff: "none",
    customer: "none",
    anonymous: "none",
    enforcement: "assertMutationClubScope; passcode hash never returned (sanitizeUser)",
  },
  {
    resource: "snacks / kitchen / documents / livestream",
    admin: "none",
    owner: "club",
    staff: "club",
    customer: "club",
    anonymous: "none",
    enforcement: "assertStaffTabAllowed per tab; chef role kitchen-only",
  },
  {
    resource: "admin audit / freeze / MFA",
    admin: "platform",
    owner: "none",
    staff: "none",
    customer: "none",
    anonymous: "none",
    enforcement: "requireAdminWithMfa on all admin mutations",
  },
];

/** Lookup helper for docs and tests. */
export function policyForResource(resource: string): ResourcePolicy | undefined {
  return ACCESS_CONTROL_MATRIX.find((p) => p.resource === resource);
}
