import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";
import { parseGenericE164OrThrow, throwIfPhoneUnavailableForNewAccount } from "./model/phoneRegistration";
import {
  assertAgeYears,
  assertTrimmedLength,
  MAX_NAME_LEN,
} from "./model/inputValidation";

export const assertOwnerHasClub = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const u = await ctx.db.get(userId);
    if (!u || u.role !== "owner") {
      return { ok: false as const, reason: "not_owner" as const };
    }
    if (u.isFrozen || u.deletionRequestedAt !== undefined) {
      return { ok: false as const, reason: "account_blocked" as const };
    }
    const club = await ctx.db
      .query("clubs")
      .withIndex("by_owner", (q) => q.eq("ownerId", userId))
      .unique();
    if (!club) {
      return { ok: false as const, reason: "no_club" as const };
    }
    return { ok: true as const, clubId: club._id };
  },
});

export const insertDeskRegisteredCustomer = internalMutation({
  args: {
    phone: v.string(),
    name: v.string(),
    age: v.number(),
    consentGiven: v.boolean(),
  },
  handler: async (ctx, { phone, name, age, consentGiven }) => {
    if (!consentGiven) {
      throw new Error("AUTH_005: Consent not given");
    }
    const validAge = assertAgeYears(age);
    const trimmed = assertTrimmedLength("Name", name, 2, MAX_NAME_LEN, {
      normalizeWs: true,
    });

    const normalized = parseGenericE164OrThrow(phone);
    const existing = await ctx.db
      .query("users")
      .withIndex("by_phone", (q) => q.eq("phone", normalized))
      .first();
    throwIfPhoneUnavailableForNewAccount(existing);

    const now = Date.now();
    const userId = await ctx.db.insert("users", {
      name: trimmed,
      age: validAge,
      phone: normalized,
      role: "customer",
      customerRegisteredVia: "desk",
      phoneVerified: true,
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
      provider: "phoneOtp",
      providerAccountId: normalized,
      secret: "",
    });

    return { userId };
  },
});
