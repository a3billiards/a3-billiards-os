/**
 * Onboarding website: club draft persistence + status queries.
 * Owner account + password hash are created via onboardingWebActions.registerOwnerAccount.
 */

import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { parseGenericE164OrThrow } from "./model/phoneRegistration";
import {
  assertAgeYears,
  assertEmailNormalized,
  assertFiniteInRange,
  assertIsoCurrency,
  assertTrimmedLength,
  MAX_ADDRESS_LEN,
  MAX_NAME_LEN,
} from "./model/inputValidation";
import { listOnboardingPlansFromEnv } from "./onboardingPlanPricing";
import {
  getPlatformInvoiceConfig as readPlatformInvoiceConfig,
  gstBreakdownForTaxableAmount,
} from "./model/platformGst";
import { isValidGeocodeLocation } from "./model/geocode";

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

    const name = assertTrimmedLength("Club name", clubName, 2, 120, {
      normalizeWs: true,
    });
    const addr = assertTrimmedLength("Address", address, 5, MAX_ADDRESS_LEN);
    const rate = assertFiniteInRange("Table rate", baseRatePerMin, 0.01, 1_000_000);
    const minM = assertFiniteInRange(
      "Minimum bill minutes",
      minBillMinutes,
      1,
      24 * 60,
      true,
    );
    const tz = assertTrimmedLength("Timezone", timezone, 3, 80);
    const cur = assertIsoCurrency(currency);
    if (!isValidGeocodeLocation(location)) {
      throw new Error(
        "DATA_001: Club location is missing. Pin your club on the map on the club step before continuing.",
      );
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
        baseRatePerMin: rate,
        minBillMinutes: minM,
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
      baseRatePerMin: rate,
      minBillMinutes: minM,
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

    const emailNormalized = (user.email ?? "").trim().toLowerCase();
    let emailVerified = false;
    if (emailNormalized.length > 0) {
      const passwordAccount = await ctx.db
        .query("authAccounts")
        .withIndex("providerAndAccountId", (q) =>
          q.eq("provider", "password").eq("providerAccountId", emailNormalized),
        )
        .unique();
      emailVerified = Boolean(passwordAccount?.emailVerified);
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
      emailVerified,
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
    const normalized = assertEmailNormalized(email);
    const validAge = assertAgeYears(age);
    const trimmedName = assertTrimmedLength("Name", name, 2, MAX_NAME_LEN, {
      normalizeWs: true,
    });

    const dupEmail = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", normalized))
      .unique();
    const existingPasswordAccount = await ctx.db
      .query("authAccounts")
      .withIndex("providerAndAccountId", (q) =>
        q.eq("provider", "password").eq("providerAccountId", normalized),
      )
      .unique();

    // If user row was manually deleted but credential row still exists, cleanup orphan and continue.
    if (existingPasswordAccount) {
      const linkedUser = await ctx.db.get(existingPasswordAccount.userId);
      if (!linkedUser) {
        await ctx.db.delete(existingPasswordAccount._id);
      }
    }

    let normalizedPhone: string | undefined;
    if (phone !== undefined && phone.trim().length > 0) {
      normalizedPhone = parseGenericE164OrThrow(phone);
      const dupPhone = await ctx.db
        .query("users")
        .withIndex("by_phone", (q) => q.eq("phone", normalizedPhone))
        .first();
      if (dupPhone) {
        throw new Error("OTP_007: Phone already registered");
      }
    }

    // Reuse unfinished onboarding owner accounts (no club yet) instead of hard-failing duplicate email.
    if (dupEmail) {
      const existingClub = await ctx.db
        .query("clubs")
        .withIndex("by_owner", (q) => q.eq("ownerId", dupEmail._id))
        .first();
      if (dupEmail.role !== "owner" || existingClub) {
        throw new Error("CLUB_003: Email already registered");
      }
      const passwordAccount = await ctx.db
        .query("authAccounts")
        .withIndex("providerAndAccountId", (q) =>
          q.eq("provider", "password").eq("providerAccountId", normalized),
        )
        .unique();
      if (!passwordAccount || passwordAccount.userId !== dupEmail._id) {
        throw new Error("CLUB_003: Email already registered");
      }

      await ctx.db.patch(dupEmail._id, {
        phone: normalizedPhone,
        phoneVerified: false,
        name: trimmedName,
        age: validAge,
        isFrozen: false,
        settingsPasscodeSet: false,
        consentGiven: true,
        consentGivenAt: Date.now(),
      });
      const staleCodes = await ctx.db
        .query("ownerEmailVerificationCodes")
        .withIndex("by_owner", (q) => q.eq("ownerId", dupEmail._id))
        .filter((q) => q.eq(q.field("used"), false))
        .collect();
      for (const row of staleCodes) {
        await ctx.db.patch(row._id, { used: true });
      }
      await ctx.db.patch(passwordAccount._id, {
        secret: passwordHash,
        emailVerified: undefined,
      });
      return { userId: dupEmail._id };
    }

    const now = Date.now();
    const userId = await ctx.db.insert("users", {
      email: normalized,
      phone: normalizedPhone,
      phoneVerified: false,
      name: trimmedName,
      age: validAge,
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
  handler: async () => {
    const config = readPlatformInvoiceConfig();
    return listOnboardingPlansFromEnv().map((plan) => ({
      ...plan,
      gst: gstBreakdownForTaxableAmount(plan.amountPaise),
      invoiceConfig: config,
    }));
  },
});

export const getPlatformInvoiceConfig = query({
  args: {},
  handler: async () => readPlatformInvoiceConfig(),
});
