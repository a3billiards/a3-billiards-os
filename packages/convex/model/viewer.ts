/**
 * Security contexts for Convex queries/mutations.
 *
 * - Admin: unrestricted.
 * - Owner: scoped to clubId (resolved via clubs.by_owner).
 * - Customer: scoped to own userId; club reads only via getClubForViewer (public rules).
 *
 * Call requireViewer() at the top of every mutation, then assert scope helpers as needed.
 */

import { getAuthUserId } from "@convex-dev/auth/server";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";

export type UserRole = "admin" | "owner" | "customer";

type AuthCtx = QueryCtx | MutationCtx;

export type AdminViewer = {
  userId: Id<"users">;
  role: "admin";
  isFrozen: boolean;
  deletionRequestedAt?: number;
};

export type OwnerViewer = {
  userId: Id<"users">;
  role: "owner";
  /** Resolved via `clubs.by_owner`. Null until the owner completes venue onboarding (web). */
  clubId: Id<"clubs"> | null;
  isFrozen: boolean;
  deletionRequestedAt?: number;
};

export type CustomerViewer = {
  userId: Id<"users">;
  role: "customer";
  isFrozen: boolean;
  deletionRequestedAt?: number;
};

export type Viewer = AdminViewer | OwnerViewer | CustomerViewer;

function throwAuth(message: string): never {
  throw new Error(message);
}

async function clubIdForOwner(
  ctx: AuthCtx,
  ownerUserId: Id<"users">,
): Promise<Id<"clubs"> | null> {
  const club = await ctx.db
    .query("clubs")
    .withIndex("by_owner", (q) => q.eq("ownerId", ownerUserId))
    .unique();
  return club?._id ?? null;
}

/**
 * Loads the current viewer or null if not signed in.
 * Does not enforce frozen/deletion (use requireViewer for mutations).
 */
export async function getViewer(ctx: AuthCtx): Promise<Viewer | null> {
  const userId = await getAuthUserId(ctx);
  if (userId === null) {
    return null;
  }

  const user = await ctx.db.get(userId);
  if (!user) {
    return null;
  }

  const role = user.role;
  if (role === "admin") {
    return {
      userId,
      role: "admin",
      isFrozen: user.isFrozen,
      deletionRequestedAt: user.deletionRequestedAt,
    };
  }
  if (role === "owner") {
    const clubId = await clubIdForOwner(ctx, userId);
    return {
      userId,
      role: "owner",
      clubId,
      isFrozen: user.isFrozen,
      deletionRequestedAt: user.deletionRequestedAt,
    };
  }
  return {
    userId,
    role: "customer",
    isFrozen: user.isFrozen,
    deletionRequestedAt: user.deletionRequestedAt,
  };
}

/**
 * Enforce authenticated, non-frozen, not pending deletion.
 * Use at the top of every mutation (and privileged queries).
 */
export async function requireViewer(ctx: AuthCtx): Promise<Viewer> {
  const viewer = await getViewer(ctx);
  if (viewer === null) {
    throwAuth("AUTH_001: Not authenticated");
  }
  if (viewer.isFrozen) {
    throwAuth("AUTH_002: Account is frozen");
  }
  if (viewer.deletionRequestedAt !== undefined) {
    throwAuth("AUTH_006: Account pending deletion");
  }
  return viewer;
}

export function requireAdmin(viewer: Viewer): AdminViewer {
  if (viewer.role !== "admin") {
    throwAuth("PERM_001: Admin only");
  }
  return viewer;
}

export function requireOwner(viewer: Viewer): OwnerViewer {
  if (viewer.role !== "owner") {
    throwAuth("PERM_001: Owner only");
  }
  return viewer;
}

/** Owner viewer with a club row; use for mutations/queries that need `clubId`. */
export function requireOwnerWithClub(viewer: Viewer): OwnerViewer & {
  clubId: Id<"clubs">;
} {
  const o = requireOwner(viewer);
  if (o.clubId === null) {
    throwAuth("AUTH_008: No club found for owner account");
  }
  return o as OwnerViewer & { clubId: Id<"clubs"> };
}

export function requireCustomer(viewer: Viewer): CustomerViewer {
  if (viewer.role !== "customer") {
    throwAuth("PERM_001: Customer only");
  }
  return viewer;
}

/**
 * Owner/admin mutations touching club-scoped data: admin any club; owner only their club.
 */
export function assertMutationClubScope(
  viewer: Viewer,
  clubId: Id<"clubs">,
): void {
  if (viewer.role === "admin") {
    return;
  }
  if (viewer.role === "owner") {
    if (viewer.clubId === null) {
      throwAuth("AUTH_008: No club found for owner account");
    }
    if (viewer.clubId !== clubId) {
      throwAuth("PERM_001: Cannot access another club's data");
    }
    return;
  }
  throwAuth("PERM_001: Insufficient role for club-scoped action");
}

/**
 * Customer's own user row or documents keyed by customerId.
 */
export function assertCustomerUserScope(
  viewer: Viewer,
  customerUserId: Id<"users">,
): void {
  if (viewer.role === "admin" || viewer.role === "owner") {
    return;
  }
  if (viewer.userId !== customerUserId) {
    throwAuth("PERM_001: Cannot access another user's data");
  }
}

export type ClubReadMode = "standard" | "discovery";

/**
 * Load a club document with role-appropriate access.
 *
 * - Admin: any club.
 * - Owner: only their clubId.
 * - Customer: club must exist, subscription not frozen; if mode === "discovery", also isDiscoverable.
 */
export async function getClubForViewer(
  ctx: AuthCtx,
  viewer: Viewer,
  clubId: Id<"clubs">,
  mode: ClubReadMode = "standard",
): Promise<Doc<"clubs">> {
  const club = await ctx.db.get(clubId);
  if (!club) {
    throwAuth("DATA_003: Club not found");
  }

  if (viewer.role === "admin") {
    return club;
  }

  if (viewer.role === "owner") {
    if (viewer.clubId !== null) {
      if (viewer.clubId !== clubId) {
        throwAuth("PERM_001: Cannot access another club's data");
      }
    } else if (club.ownerId !== viewer.userId) {
      throwAuth("PERM_001: Cannot access another club's data");
    }
    return club;
  }

  // Customer — public info only
  if (club.subscriptionStatus === "frozen") {
    throwAuth("SUBSCRIPTION_003: Club account is frozen");
  }
  if (mode === "discovery" && !club.isDiscoverable) {
    throwAuth("DATA_003: Club not found");
  }

  return club;
}
