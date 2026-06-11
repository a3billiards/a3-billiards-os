import { convexAuth } from "@convex-dev/auth/server";
import { A3Password } from "./passwordProviderA3";
import { A3Google, A3GoogleOwner } from "./googleCredentialsProvider";
import { A3PhoneOtp } from "./phoneOtpProvider";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";

/**
 * Custom createOrUpdateUser callback.
 *
 * The default implementation in @convex-dev/auth strips `phoneVerified` and
 * `emailVerified` from the profile object before insertion (they are treated
 * as auth-managed fields and only re-added when shouldLinkViaPhone/Email is
 * true). Our schema requires `phoneVerified: v.boolean()` as non-optional,
 * which causes the insert to fail.
 *
 * This callback writes the user row directly with all required schema fields.
 */
export const { auth, signIn, signOut, store } = convexAuth({
  providers: [A3Password(), A3Google(), A3GoogleOwner(), A3PhoneOtp()],
  callbacks: {
    async createOrUpdateUser(genericCtx, args) {
      const ctx = genericCtx as unknown as MutationCtx;
      const profile = args.profile as Record<string, unknown>;

      if (args.existingUserId !== null) {
        const updates: Record<string, unknown> = {};
        if (typeof profile.name === "string" && profile.name.trim().length > 0) {
          updates.name = profile.name;
        }
        if (typeof profile.email === "string") updates.email = profile.email;
        if (typeof profile.phone === "string") updates.phone = profile.phone;
        if (Object.keys(updates).length > 0) {
          await ctx.db.patch(args.existingUserId as Id<"users">, updates);
        }
        return args.existingUserId;
      }

      const email =
        typeof profile.email === "string" ? profile.email.toLowerCase() : null;
      if (email !== null) {
        const existing = await ctx.db
          .query("users")
          .withIndex("by_email", (q) => q.eq("email", email))
          .first();
        if (existing !== null) {
          return existing._id;
        }
      }

      const now = Date.now();
      const userId = await ctx.db.insert("users", {
        email: email ?? undefined,
        name: typeof profile.name === "string" ? profile.name.trim() : "",
        age: typeof profile.age === "number" ? profile.age : 0,
        phone: typeof profile.phone === "string" ? profile.phone : undefined,
        phoneVerified: profile.phoneVerified === true,
        fcmTokens: [],
        settingsPasscodeSet: false,
        complaints: [],
        isFrozen: false,
        role: "customer",
        consentGiven: profile.consentGiven === true,
        consentGivenAt:
          profile.consentGiven === true
            ? typeof profile.consentGivenAt === "number"
              ? profile.consentGivenAt
              : now
            : undefined,
        createdAt: now,
      });
      return userId;
    },
  },
});
