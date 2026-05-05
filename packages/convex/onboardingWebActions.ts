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

const FREE_ACCESS_COUPON = "A3A3A3";

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
  ): Promise<{ userId: string }> => {
    if (!consentGiven) {
      throw new Error("AUTH_005: Consent not given");
    }
    if (password.length < 8) {
      throw new Error("DATA_001: Password must be at least 8 characters");
    }

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
    return { userId: String(userId) };
  },
});

export const geocodeClubAddress = action({
  args: { address: v.string() },
  handler: async (_ctx, { address }) => {
    const key = process.env.GOOGLE_MAPS_API_KEY;
    if (!key || key.length === 0) {
      throw new Error(
        "DATA_001: Geocoding is not configured (GOOGLE_MAPS_API_KEY)",
      );
    }
    const q = encodeURIComponent(address.trim());
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${q}&key=${key}`;
    const res = await fetch(url);
    const data = (await res.json()) as {
      status?: string;
      results?: { geometry?: { location?: { lat: number; lng: number } } }[];
    };
    if (data.status !== "OK" || !data.results?.[0]?.geometry?.location) {
      throw new Error(
        "DATA_001: Could not resolve address — check the address and try again",
      );
    }
    const loc = data.results[0].geometry.location;
    return { lat: loc.lat, lng: loc.lng };
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

    const receipt = `a3_${flow}_${String(userId).slice(-8)}_${Date.now()}`;
    const auth = Buffer.from(`${keyId}:${keySecret}`).toString("base64");

    const orderBody = {
      amount: plan.amountPaise,
      currency: plan.currency,
      receipt,
      notes: {
        ownerId: String(userId),
        periodMs: String(plan.periodMs),
        flow,
        planId,
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
      amountPaise: plan.amountPaise,
      currency: plan.currency,
      keyId,
      periodMs: plan.periodMs,
    };
  },
});

export const applyCouponFreeAccess = action({
  args: {
    flow: v.union(v.literal("onboarding"), v.literal("renewal")),
    planId: v.union(v.literal("monthly"), v.literal("yearly")),
    couponCode: v.string(),
  },
  handler: async (ctx, { flow, planId, couponCode }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("AUTH_001: Not authenticated");

    const normalizedCoupon = couponCode.trim().toUpperCase();
    if (normalizedCoupon !== FREE_ACCESS_COUPON) {
      throw new Error("PAYMENT_004: Invalid coupon code");
    }

    const plans = listOnboardingPlansFromEnv();
    const plan = plans.find((p) => p.id === planId);
    if (!plan) throw new Error("DATA_001: Unknown subscription plan");

    await assertFlowEligibility(ctx, userId, flow);

    const paymentId = `coupon_${flow}_${String(userId).slice(-8)}_${Date.now()}`;
    if (flow === "onboarding") {
      await ctx.runMutation(internal.paymentReceipts.processOnboardingPayment, {
        paymentId,
        ownerId: String(userId),
        amount: 0,
        periodMs: plan.periodMs,
      });
    } else {
      await ctx.runMutation(internal.paymentReceipts.processPayment, {
        paymentId,
        ownerId: String(userId),
        amount: 0,
        periodMs: plan.periodMs,
      });
    }

    return { applied: true as const };
  },
});
