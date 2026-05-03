/**
 * Google Sign-In: internal persistence + completeGoogleRegistration (step 4).
 * Token verification lives in googleAuthActions.ts ("use node").
 */

import { v } from "convex/values";
import {
  parseIndiaE164OrThrow,
  throwIfPhoneUnavailableForNewAccount,
} from "./model/phoneRegistration";
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
      const byEmail = await ctx.db
        .query("users")
        .withIndex("by_email", (q) => q.eq("email", email))
        .unique();
      if (byEmail) return byEmail;
    }
    return null;
  },
});

export const linkGoogleId = internalMutation({
  args: { userId: v.id("users"), googleId: v.string() },
  handler: async (ctx, { userId, googleId }) => {
    const conflict = await ctx.db
      .query("users")
      .withIndex("by_googleId", (q) => q.eq("googleId", googleId))
      .unique();
    if (conflict !== null && conflict._id !== userId) {
      throwErr("DATA_002: Google account already linked to another user");
    }
    await ctx.db.patch(userId, { googleId });
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
