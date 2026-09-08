"use node";

/**
 * Onboarding website actions: owner registration (Scrypt password hash),
 * Razorpay order creation, optional Google Geocoding.
 */

import { Scrypt } from "lucia";
import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { api, internal } from "./_generated/api";
import { action } from "./_generated/server";
import { listOnboardingPlansFromEnv } from "./onboardingPlanPricing";
import { geocodeAddress } from "./model/geocode";
import { assertStrongPasswordOrThrow } from "./model/passwordPolicy";
import {
  GEOCODE_LIMIT_PER_HOUR,
  OWNER_REGISTER_LIMIT_PER_HOUR,
} from "./model/rateLimiter";
import {
  assertAgeYears,
  assertEmailNormalized,
  assertTrimmedLength,
  MAX_NAME_LEN,
} from "./model/inputValidation";
import {
  razorpayBasicAuthHeader,
  razorpayKeyId,
  summarizeProviderHttpError,
} from "./model/envSecrets";
import { parseGenericE164OrThrow } from "./model/phoneRegistration";
import {
  gstBreakdownForTaxableAmount,
  platformGstin,
  platformLegalName,
} from "./model/platformGst";

const HOUR_MS = 3_600_000;

async function assertFlowEligibility(
  ctx: any,
  userId: string,
  flow: "onboarding" | "renewal",
): Promise<void> {
  if (flow === "onboarding") {
    const club = await ctx.runQuery(internal.onboardingWeb.internalGetClubByOwner, {
      ownerId: userId,
    });
    if (club !== null) {
      throw new Error("CLUB_002: Club already exists — sign in to renew");
    }
    const draft = await ctx.runQuery(internal.onboardingWeb.internalGetDraftByOwner, {
      ownerId: userId,
    });
    if (draft === null) {
      throw new Error("DATA_001: Complete club details before payment");
    }
    return;
  }

  const club = await ctx.runQuery(internal.onboardingWeb.internalGetClubByOwner, {
    ownerId: userId,
  });
  if (club === null) {
    throw new Error("DATA_003: No club found — complete onboarding first");
  }
}

export const registerOwnerAccount = action({
  args: {
    email: v.string(),
    password: v.string(),
    name: v.string(),
    age: v.number(),
    phone: v.optional(v.string()),
    consentGiven: v.boolean(),
  },
  handler: async (
    ctx,
    { email, password, name, age, phone, consentGiven },
  ): Promise<{ userId: string; verificationSent: true }> => {
    if (!consentGiven) {
      throw new Error("AUTH_005: Consent not given");
    }

    const normalizedEmail = assertEmailNormalized(email);
    const trimmedName = assertTrimmedLength("Name", name, 2, MAX_NAME_LEN, {
      normalizeWs: true,
    });
    const validAge = assertAgeYears(age);
    let normalizedPhone: string | undefined;
    if (phone !== undefined && phone.trim().length > 0) {
      normalizedPhone = parseGenericE164OrThrow(phone);
    }

    // Rate limit signups per email BEFORE the expensive Scrypt hash so an attacker
    // cannot burn CPU or spam verification emails by replaying registration.
    const emailKey = `register:email:${normalizedEmail}`;
    await ctx.runMutation(internal.rateLimit.consumeFixedWindow, {
      key: emailKey,
      limit: OWNER_REGISTER_LIMIT_PER_HOUR,
      windowMs: HOUR_MS,
    });

    assertStrongPasswordOrThrow(password);
    const passwordHash = await new Scrypt().hash(password);
    const { userId } = await ctx.runMutation(
      internal.onboardingWeb.insertOwnerAccountForWeb,
      {
        email: normalizedEmail,
        passwordHash,
        name: trimmedName,
        age: validAge,
        phone: normalizedPhone,
        consentGiven,
      },
    );

    await ctx.runAction(api.ownerEmailVerificationActions.sendOwnerEmailVerificationCode, {
      email: normalizedEmail,
    });

    return { userId: String(userId), verificationSent: true as const };
  },
});

export const geocodeClubAddress = action({
  args: { address: v.string() },
  handler: async (ctx, { address }) => {
    // Geocoding hits a paid Google API. It is only ever invoked from the authenticated
    // step-2 onboarding screen, so require auth (prevents anonymous cost abuse) and cap
    // per-user calls to a sensible hourly budget.
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("AUTH_001: Not authenticated");
    await ctx.runMutation(internal.rateLimit.consumeFixedWindow, {
      key: `geocode:user:${String(userId)}`,
      limit: GEOCODE_LIMIT_PER_HOUR,
      windowMs: HOUR_MS,
    });

    const { lat, lng } = await geocodeAddress(address);
    return { lat, lng };
  },
});

export const createRazorpayOrder = action({
  args: {
    flow: v.union(v.literal("onboarding"), v.literal("renewal")),
    planId: v.union(v.literal("monthly"), v.literal("yearly")),
  },
  handler: async (ctx, { flow, planId }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("AUTH_001: Not authenticated");

    const plans = listOnboardingPlansFromEnv();
    const plan = plans.find((p) => p.id === planId);
    if (!plan) throw new Error("DATA_001: Unknown subscription plan");

    const keyId = razorpayKeyId();
    const authHeader = razorpayBasicAuthHeader();

    await assertFlowEligibility(ctx, userId, flow);

    const gst = gstBreakdownForTaxableAmount(plan.amountPaise);
    const supplierGstin = platformGstin();

    const receipt = `a3_${flow}_${String(userId).slice(-8)}_${Date.now()}`;

    const orderBody = {
      amount: gst.totalPaise,
      currency: plan.currency,
      receipt,
      notes: {
        ownerId: String(userId),
        periodMs: String(plan.periodMs),
        flow,
        planId,
        supplierName: platformLegalName(),
        ...(supplierGstin ? { supplierGstin } : {}),
        taxableAmountPaise: String(gst.taxablePaise),
        gstAmountPaise: String(gst.gstPaise),
        gstRatePercent: String(gst.gstRatePercent),
        sacCode: "998314",
      },
    };

    const res = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: {
        Authorization: authHeader,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(orderBody),
    });

    const raw = await res.text();
    if (!res.ok) {
      console.error(summarizeProviderHttpError(raw, "Razorpay onboarding order"));
      throw new Error("PAYMENT_003: Could not start payment — try again later");
    }

    const json = JSON.parse(raw) as { id?: string };
    if (!json.id) {
      throw new Error("PAYMENT_003: Invalid Razorpay response");
    }

    return {
      orderId: json.id,
      amountPaise: gst.totalPaise,
      currency: plan.currency,
      keyId,
      periodMs: plan.periodMs,
      gst,
    };
  },
});
