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
  gstBreakdownForTaxableAmount,
  platformGstin,
  platformLegalName,
} from "./model/platformGst";

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
    assertStrongPasswordOrThrow(password);
    const passwordHash = await new Scrypt().hash(password);
    const { userId } = await ctx.runMutation(
      internal.onboardingWeb.insertOwnerAccountForWeb,
      {
        email,
        passwordHash,
        name,
        age,
        phone,
        consentGiven,
      },
    );

    await ctx.runAction(api.ownerEmailVerificationActions.sendOwnerEmailVerificationCode, {
      email: email.trim().toLowerCase(),
    });

    return { userId: String(userId), verificationSent: true as const };
  },
});

export const geocodeClubAddress = action({
  args: { address: v.string() },
  handler: async (_ctx, { address }) => {
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

    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keyId || !keySecret) {
      throw new Error("DATA_001: Razorpay is not configured");
    }

    await assertFlowEligibility(ctx, userId, flow);

    const gst = gstBreakdownForTaxableAmount(plan.amountPaise);
    const supplierGstin = platformGstin();

    const receipt = `a3_${flow}_${String(userId).slice(-8)}_${Date.now()}`;
    const auth = Buffer.from(`${keyId}:${keySecret}`).toString("base64");

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
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(orderBody),
    });

    const raw = await res.text();
    if (!res.ok) {
      console.error("Razorpay order error:", raw);
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
