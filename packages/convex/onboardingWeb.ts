/**
 * Onboarding website: club draft persistence + status queries.
 * Owner account + password hash are created via onboardingWebActions.registerOwnerAccount.
 */

import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { parseIndiaE164OrThrow } from "./model/phoneRegistration";
import { listOnboardingPlansFromEnv } from "./onboardingPlanPricing";

const locationObj = v.object({
  lat: v.number(),
  lng: v.number(),
});

export const saveClubDraft = mutation({
  args: {
    clubName: v.string(),
    address: v.string(),
    location: locationObj,
    currency: v.string(),
    baseRatePerMin: v.number(),
    minBillMinutes: v.number(),
    timezone: v.string(),
  },
  handler: async (
    ctx,
    {
      clubName,
      address,
      location,
      currency,
      baseRatePerMin,
      minBillMinutes,
      timezone,
    },
  ) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("AUTH_001: Not authenticated");

    const user = await ctx.db.get(userId);
    if (!user || user.role !== "owner") {
      throw new Error("PERM_001: Owner account required");
    }

    const existingClub = await ctx.db
      .query("clubs")
      .withIndex("by_owner", (q) => q.eq("ownerId", userId))
      .first();
    if (existingClub) {
      throw new Error("CLUB_002: Club already exists for this account");
    }

    const name = clubName.trim();
    const addr = address.trim();
    if (name.length < 2 || name.length > 120) {
      throw new Error("DATA_001: Club name must be 2–120 characters");
    }
    if (addr.length < 5 || addr.length > 500) {
      throw new Error("DATA_001: Address must be 5–500 characters");
    }
    if (baseRatePerMin <= 0 || baseRatePerMin > 1_000_000) {
      throw new Error("DATA_001: Table rate must be positive");
    }
    if (minBillMinutes < 1 || minBillMinutes > 24 * 60) {
      throw new Error("DATA_001: Minimum bill minutes must be between 1 and 1440");
    }
    const tz = timezone.trim();
    if (tz.length < 3 || tz.length > 80) {
      throw new Error("DATA_001: Invalid timezone");
    }
    const cur = currency.trim().toUpperCase();
    if (cur.length !== 3) {
      throw new Error("DATA_001: Currency must be a 3-letter ISO code");
    }

    const now = Date.now();
    const draft = await ctx.db
      .query("onboardingClubDrafts")
      .withIndex("by_owner", (q) => q.eq("ownerId", userId))
      .first();

    if (draft) {
      await ctx.db.patch(draft._id, {
        clubName: name,
        address: addr,
        location,
        currency: cur,
        baseRatePerMin,
        minBillMinutes,
        timezone: tz,
        updatedAt: now,
      });
      return { draftId: draft._id };
    }

    const draftId = await ctx.db.insert("onboardingClubDrafts", {
      ownerId: userId,
      clubName: name,
      address: addr,
      location,
      currency: cur,
      baseRatePerMin,
      minBillMinutes,
      timezone: tz,
      updatedAt: now,
    });
    return { draftId };
  },
});

export const getMyClubDraft = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;

    const user = await ctx.db.get(userId);
    if (!user || user.role !== "owner") return null;

    return await ctx.db
      .query("onboardingClubDrafts")
      .withIndex("by_owner", (q) => q.eq("ownerId", userId))
      .first();
  },
});

export const getMyOnboardingStatus = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      return { loggedIn: false as const };
    }

    const user = await ctx.db.get(userId);
    if (!user || user.role !== "owner") {
      return { loggedIn: false as const };
    }

    const club = await ctx.db
      .query("clubs")
      .withIndex("by_owner", (q) => q.eq("ownerId", userId))
      .first();

    const draft = await ctx.db
      .query("onboardingClubDrafts")
      .withIndex("by_owner", (q) => q.eq("ownerId", userId))
      .first();

    return {
      loggedIn: true as const,
      email: user.email ?? null,
      name: user.name,
      hasClub: club !== null,
      clubId: club?._id ?? null,
      subscriptionStatus: club?.subscriptionStatus ?? null,
      subscriptionExpiresAt: club?.subscriptionExpiresAt ?? null,
      hasClubDraft: draft !== null,
    };
  },
});

/** Subscription plans for onboarding / renew UI (amounts from Convex env). */
export const internalGetClubByOwner = internalQuery({
  args: { ownerId: v.id("users") },
  handler: async (ctx, { ownerId }) => {
    return await ctx.db
      .query("clubs")
      .withIndex("by_owner", (q) => q.eq("ownerId", ownerId))
      .first();
  },
});

export const internalGetDraftByOwner = internalQuery({
  args: { ownerId: v.id("users") },
  handler: async (ctx, { ownerId }) => {
    return await ctx.db
      .query("onboardingClubDrafts")
      .withIndex("by_owner", (q) => q.eq("ownerId", ownerId))
      .first();
  },
});

export const insertOwnerAccountForWeb = internalMutation({
  args: {
    email: v.string(),
    passwordHash: v.string(),
    name: v.string(),
    age: v.number(),
    phone: v.optional(v.string()),
    consentGiven: v.boolean(),
  },
  handler: async (
    ctx,
    { email, passwordHash, name, age, phone, consentGiven },
  ) => {
    if (!consentGiven) throw new Error("AUTH_005: Consent not given");
    if (age < 18) throw new Error("AUTH_007: Must be 18 or older");

    const normalized = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
      throw new Error("DATA_001: Invalid email address");
    }

    const trimmedName = name.trim();
    if (trimmedName.length < 2 || trimmedName.length > 100) {
      throw new Error("DATA_001: Name must be 2–100 characters");
    }

    const dupEmail = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", normalized))
      .unique();
    if (dupEmail) {
      throw new Error("CLUB_003: Email already registered");
    }

    let normalizedPhone: string | undefined;
    if (phone !== undefined && phone.trim().length > 0) {
      normalizedPhone = parseIndiaE164OrThrow(phone);
      const dupPhone = await ctx.db
        .query("users")
        .withIndex("by_phone", (q) => q.eq("phone", normalizedPhone))
        .first();
      if (dupPhone) {
        throw new Error("OTP_007: Phone already registered");
      }
    }

    const existingPasswordAccount = await ctx.db
      .query("authAccounts")
      .withIndex("providerAndAccountId", (q) =>
        q.eq("provider", "password").eq("providerAccountId", normalized),
      )
      .unique();
    if (existingPasswordAccount) {
      throw new Error("CLUB_003: Email already registered");
    }

    const now = Date.now();
    const userId = await ctx.db.insert("users", {
      email: normalized,
      phone: normalizedPhone,
      phoneVerified: false,
      name: trimmedName,
      age,
      role: "owner",
      isFrozen: false,
      settingsPasscodeSet: false,
      complaints: [],
      fcmTokens: [],
      consentGiven: true,
      consentGivenAt: now,
      createdAt: now,
    });

    await ctx.db.insert("authAccounts", {
      userId,
      provider: "password",
      providerAccountId: normalized,
      secret: passwordHash,
    });

    return { userId };
  },
});

export const deleteClubDraftByOwner = internalMutation({
  args: { ownerId: v.id("users") },
  handler: async (ctx, { ownerId }) => {
    const draft = await ctx.db
      .query("onboardingClubDrafts")
      .withIndex("by_owner", (q) => q.eq("ownerId", ownerId))
      .first();
    if (draft) await ctx.db.delete(draft._id);
  },
});

export const listSubscriptionPlans = query({
  args: {},
  handler: async () => listOnboardingPlansFromEnv(),
});
