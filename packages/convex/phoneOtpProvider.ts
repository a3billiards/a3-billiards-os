/**
 * Phone + WhatsApp OTP credentials provider for Convex Auth.
 *
 * Two flows, both gated on a successful OTP verification:
 *
 *   - flow="signIn"   – phone must already have an authAccount; returns its userId.
 *   - flow="signUp"   – phone must be free; receives name/age/email/consent params,
 *                       calls createAccount which routes through createOrUpdateUser
 *                       to insert the new user row.
 *
 * The "secret" stored on the authAccounts row is intentionally an empty string —
 * each login uses a fresh OTP code which is verified separately via internal.otp.
 */

import { ConvexCredentials } from "@convex-dev/auth/providers/ConvexCredentials";
import { createAccount } from "@convex-dev/auth/server";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";

const E164_REGEX = /^\+[1-9]\d{6,14}$/;

export function A3PhoneOtp() {
  return ConvexCredentials({
    id: "phoneOtp",
    authorize: async (params, ctx) => {
      const phone = String(params.phone ?? "").trim();
      const code = String(params.code ?? "").replace(/\s/g, "");
      const flow = params.flow;

      if (!E164_REGEX.test(phone)) {
        throw new Error("OTP_005: Invalid phone number format");
      }
      if (!/^\d{6}$/.test(code)) {
        throw new Error("OTP_002: Please enter the 6-digit code sent to your phone.");
      }

      // Verify OTP in its own mutation (must not throw after writes — attempts would roll back).
      const otpResult = await ctx.runMutation(internal.otp.attemptVerify, {
        phone,
        code,
      });
      if (!otpResult.ok) {
        throw new Error(otpResult.error);
      }

      const existingAccount: Doc<"authAccounts"> | null = await ctx.runQuery(
        internal.phoneOtp.findAccountByPhone,
        { phone },
      );

      // ───── signUp flow ─────
      if (flow === "signUp") {
        if (existingAccount) {
          throw new Error(
            "OTP_007: This phone is already registered. Please sign in instead.",
          );
        }
        const name = String(params.name ?? "").trim();
        const ageRaw = params.age;
        const age = typeof ageRaw === "number" ? ageRaw : Number(ageRaw);
        const email =
          typeof params.email === "string" && params.email.trim().length > 0
            ? params.email.trim().toLowerCase()
            : undefined;
        const consentGiven = params.consentGiven === true;

        if (name.length < 2) throw new Error("DATA_001: Name is required");
        if (!Number.isInteger(age) || age < 18) {
          throw new Error("AUTH_007: You must be 18 or older to register.");
        }
        if (!consentGiven) throw new Error("AUTH_005: Consent not given");

        const result = await createAccount(ctx, {
          provider: "phoneOtp",
          account: { id: phone, secret: "" },
          profile: {
            name,
            age,
            phone,
            phoneVerified: true,
            customerRegisteredVia: "app",
            consentGiven: true,
            consentGivenAt: Date.now(),
            ...(email !== undefined ? { email } : {}),
          },
          shouldLinkViaEmail: false,
          shouldLinkViaPhone: false,
        });

        if (!result.user) {
          throw new Error("AUTH_001: Could not create user");
        }
        return { userId: result.user._id as Id<"users"> };
      }

      // ───── signIn flow (default) ─────
      if (!existingAccount) {
        throw new Error(
          "AUTH_009: No account found for this phone. Please sign up first.",
        );
      }
      const user = await ctx.runQuery(internal.otp.getUserById, {
        userId: existingAccount.userId as Id<"users">,
      });
      if (!user) {
        throw new Error("DATA_003: User record missing");
      }
      if (user.isFrozen) {
        throw new Error("AUTH_002: Account is frozen");
      }
      if (user.deletionRequestedAt !== undefined) {
        throw new Error("AUTH_006: Account pending deletion");
      }
      return { userId: user._id };
    },
    crypto: {
      async hashSecret() {
        return "";
      },
      async verifySecret() {
        return true;
      },
    },
  });
}
