import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";
import { parseIndiaE164OrThrow, throwIfPhoneUnavailableForNewAccount } from "./model/phoneRegistration";

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
    if (age < 18) {
      throw new Error("AUTH_007: Must be 18 or older");
    }
    const trimmed = name.trim();
    if (trimmed.length === 0) {
      throw new Error("DATA_001: Name is required");
    }

    const normalized = parseIndiaE164OrThrow(phone);
    const existing = await ctx.db
      .query("users")
      .withIndex("by_phone", (q) => q.eq("phone", normalized))
      .first();
    throwIfPhoneUnavailableForNewAccount(existing);

    const now = Date.now();
    const userId = await ctx.db.insert("users", {
      name: trimmed,
      age,
      phone: normalized,
      role: "customer",
      phoneVerified: true,
      isFrozen: false,
      settingsPasscodeSet: false,
      complaints: [],
      fcmTokens: [],
      consentGiven: true,
      consentGivenAt: now,
      createdAt: now,
    });

    return { userId };
  },
});
