/**
 * Google Sign-In: internal persistence + completeGoogleRegistration (step 4).
 * Token verification lives in googleAuthActions.ts ("use node").
 */

import { v } from "convex/values";
import {
  parseIndiaE164OrThrow,
  throwIfPhoneUnavailableForNewAccount,
} from "./model/phoneRegistration";
import { ensureGoogleLinkedToUser } from "./googleAuthOps";
import { internalMutation, internalQuery } from "./_generated/server";

function throwErr(message: string): never {
  throw new Error(message);
}

export const findExistingGoogleUser = internalQuery({
  args: {
    googleId: v.string(),
    email: v.optional(v.string()),
  },
  handler: async (ctx, { googleId, email }) => {
    const byGoogle = await ctx.db
      .query("users")
      .withIndex("by_googleId", (q) => q.eq("googleId", googleId))
      .unique();
    if (byGoogle) return byGoogle;

    if (email) {
      const normalized = email.trim().toLowerCase();
      const byEmail = await ctx.db
        .query("users")
        .withIndex("by_email", (q) => q.eq("email", normalized))
        .unique();
      if (byEmail) return byEmail;
    }
    return null;
  },
});

/** Owner app: prefer web onboarding account (password) over a stale Google-only stub. */
export const findExistingOwnerGoogleUser = internalQuery({
  args: {
    googleId: v.string(),
    email: v.optional(v.string()),
  },
  handler: async (ctx, { googleId, email }) => {
    if (email) {
      const normalized = email.trim().toLowerCase();
      const byEmail = await ctx.db
        .query("users")
        .withIndex("by_email", (q) => q.eq("email", normalized))
        .unique();
      if (byEmail?.role === "owner") {
        const passwordAccount = await ctx.db
          .query("authAccounts")
          .withIndex("providerAndAccountId", (q) =>
            q.eq("provider", "password").eq("providerAccountId", normalized),
          )
          .unique();
        if (passwordAccount !== null && passwordAccount.userId === byEmail._id) {
          return byEmail;
        }
      }
    }

    const byGoogle = await ctx.db
      .query("users")
      .withIndex("by_googleId", (q) => q.eq("googleId", googleId))
      .unique();
    if (byGoogle?.role === "owner") return byGoogle;

    if (email) {
      const normalized = email.trim().toLowerCase();
      const byEmail = await ctx.db
        .query("users")
        .withIndex("by_email", (q) => q.eq("email", normalized))
        .unique();
      if (byEmail?.role === "owner") return byEmail;
    }

    return null;
  },
});

export const linkGoogleId = internalMutation({
  args: {
    userId: v.id("users"),
    googleId: v.string(),
    email: v.optional(v.string()),
    requireOwnerRole: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    await ensureGoogleLinkedToUser(ctx, args);
  },
});

export const createGoogleUser = internalMutation({
  args: {
    googleId: v.string(),
    email: v.optional(v.string()),
    name: v.string(),
    phone: v.string(),
    age: v.number(),
    consentGiven: v.boolean(),
  },
  handler: async (ctx, args) => {
    if (!args.consentGiven) throwErr("AUTH_005: Consent not given");
    if (args.age < 18) throwErr("AUTH_007: Must be 18 or older");

    const trimmedName = args.name.trim();
    if (trimmedName.length === 0) throwErr("DATA_001: Name is required");

    const phone = parseIndiaE164OrThrow(args.phone);

    const existingGoogle = await ctx.db
      .query("users")
      .withIndex("by_googleId", (q) => q.eq("googleId", args.googleId))
      .unique();
    if (existingGoogle) {
      throwErr("DATA_002: Google account already registered");
    }

    if (args.email) {
      const emailUser = await ctx.db
        .query("users")
        .withIndex("by_email", (q) => q.eq("email", args.email))
        .unique();
      if (emailUser) throwErr("CLUB_003: Email already registered");
    }

    const existingPhone = await ctx.db
      .query("users")
      .withIndex("by_phone", (q) => q.eq("phone", phone))
      .first();

    /** Pool desk registration: customer row exists with verified phone, no Google yet. */
    const isDeskLinkable =
      existingPhone !== null &&
      existingPhone.role === "customer" &&
      existingPhone.googleId === undefined &&
      existingPhone.phoneVerified === true &&
      (existingPhone.email === undefined ||
        String(existingPhone.email).trim().length === 0);

    if (isDeskLinkable) {
      if (args.email) {
        const emailUser = await ctx.db
          .query("users")
          .withIndex("by_email", (q) => q.eq("email", args.email))
          .unique();
        if (emailUser && emailUser._id !== existingPhone._id) {
          throwErr("CLUB_003: Email already registered");
        }
      }
      await ctx.db.patch(existingPhone._id, {
        googleId: args.googleId,
        email: args.email || undefined,
        name: trimmedName,
      });
      await ctx.db.insert("authAccounts", {
        userId: existingPhone._id,
        provider: "google",
        providerAccountId: args.googleId,
        ...(args.email ? { emailVerified: args.email } : {}),
      });
      return { userId: existingPhone._id };
    }

    throwIfPhoneUnavailableForNewAccount(existingPhone ?? null);

    const now = Date.now();
    const userId = await ctx.db.insert("users", {
      name: trimmedName,
      email: args.email || undefined,
      phone,
      googleId: args.googleId,
      age: args.age,
      role: "customer",
      phoneVerified: false,
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
      provider: "google",
      providerAccountId: args.googleId,
      ...(args.email ? { emailVerified: args.email } : {}),
    });

    return { userId };
  },
});

export const createOwnerGoogleUser = internalMutation({
  args: {
    googleId: v.string(),
    email: v.optional(v.string()),
    name: v.string(),
    phone: v.string(),
    age: v.number(),
    consentGiven: v.boolean(),
  },
  handler: async (ctx, args) => {
    if (!args.consentGiven) throwErr("AUTH_005: Consent not given");
    if (args.age < 18) throwErr("AUTH_007: Must be 18 or older");

    const trimmedName = args.name.trim();
    if (trimmedName.length === 0) throwErr("DATA_001: Name is required");

    const phone = parseIndiaE164OrThrow(args.phone);

    const existingGoogle = await ctx.db
      .query("users")
      .withIndex("by_googleId", (q) => q.eq("googleId", args.googleId))
      .unique();
    if (existingGoogle) {
      throwErr("DATA_002: Google account already registered");
    }

    if (args.email) {
      const emailUser = await ctx.db
        .query("users")
        .withIndex("by_email", (q) => q.eq("email", args.email))
        .unique();
      if (emailUser) throwErr("CLUB_003: Email already registered");
    }

    const existingPhone = await ctx.db
      .query("users")
      .withIndex("by_phone", (q) => q.eq("phone", phone))
      .first();
    throwIfPhoneUnavailableForNewAccount(existingPhone ?? null);

    const now = Date.now();
    const userId = await ctx.db.insert("users", {
      name: trimmedName,
      email: args.email || undefined,
      phone,
      googleId: args.googleId,
      age: args.age,
      role: "owner",
      phoneVerified: false,
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
      provider: "google",
      providerAccountId: args.googleId,
      ...(args.email ? { emailVerified: args.email } : {}),
    });

    return { userId };
  },
});
