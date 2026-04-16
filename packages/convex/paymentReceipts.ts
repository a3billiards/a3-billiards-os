/**
 * Razorpay webhooks: HMAC verification (action) + idempotent `processPayment` (mutation).
 * TDD §1.3: signature verification runs in an action (no Node `crypto` import — Web Crypto only).
 *
 * // Ensure ownerId and periodMs are set in Razorpay order notes at order creation on the Onboarding Website.
 */

import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import { internalAction, internalMutation, query } from "./_generated/server";
import { requireViewer } from "./model/viewer";

/** HMAC-SHA256 hex digest; matches Node `createHmac("sha256", secret).update(body).digest("hex")`. */
async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  const bytes = new Uint8Array(sig);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export const handleWebhook = internalAction({
  args: {
    rawBody: v.string(),
    signature: v.string(),
  },
  handler: async (ctx, { rawBody, signature }) => {
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
    if (!secret || secret.length === 0) {
      throw new Error(
        "DATA_001: RAZORPAY_WEBHOOK_SECRET is missing — cannot verify webhook signature",
      );
    }

    const expected = await hmacSha256Hex(secret, rawBody);
    if (expected !== signature) {
      throw new Error("PAYMENT_001: Invalid signature");
    }

    const event = JSON.parse(rawBody) as {
      event?: string;
      payload?: { payment?: { entity?: Record<string, unknown> } };
    };

    if (event.event !== "payment.captured") {
      return { status: "ignored" as const, event: event.event ?? "unknown" };
    }

    const entity = event.payload?.payment?.entity;
    if (!entity || typeof entity !== "object") {
      return {
        status: "ignored" as const,
        event: event.event ?? "payment.captured",
      };
    }

    const notes =
      (entity.notes as Record<string, unknown> | undefined) ?? {};
    const ownerId = notes.ownerId != null ? String(notes.ownerId) : "";
    const amount = Number(entity.amount);
    const periodMs = Number(notes.periodMs);
    const paymentId = String(entity.id ?? "").trim();

    if (!ownerId || !Number.isFinite(periodMs) || Number.isNaN(periodMs)) {
      throw new Error(
        "PAYMENT_002: Missing ownerId or periodMs in payment notes",
      );
    }
    if (periodMs <= 0) {
      throw new Error(
        "PAYMENT_002: Missing ownerId or periodMs in payment notes",
      );
    }
    if (!paymentId) {
      throw new Error(
        "PAYMENT_002: Missing ownerId or periodMs in payment notes",
      );
    }

    await ctx.runMutation(internal.paymentReceipts.processPayment, {
      paymentId,
      ownerId,
      amount,
      periodMs,
    });

    return { status: "processed" as const, paymentId };
  },
});

export const processPayment = internalMutation({
  args: {
    paymentId: v.string(),
    ownerId: v.string(),
    amount: v.number(),
    periodMs: v.number(),
  },
  handler: async (ctx, { paymentId, ownerId, amount, periodMs }) => {
    const existing = await ctx.db
      .query("paymentReceipts")
      .withIndex("by_paymentId", (q) => q.eq("paymentId", paymentId))
      .first();
    if (existing) return;

    const ownerConvexId = ownerId as Id<"users">;

    const club = await ctx.db
      .query("clubs")
      .withIndex("by_owner", (q) => q.eq("ownerId", ownerConvexId))
      .first();
    if (!club) throw new Error("PAYMENT_002: Club not found for this owner");

    const now = Date.now();

    // amountPaid stored in paise (Razorpay's smallest unit). Divide by 100 for display if needed.
    await ctx.db.insert("paymentReceipts", {
      paymentId,
      ownerId: ownerConvexId,
      clubId: club._id,
      amountPaid: amount,
      processedAt: now,
    });

    // newExpiresAt = max(currentSubscriptionExpiresAt, now) + purchasedPeriod
    // Active (early) renewal: max() = currentExpiresAt → unused time preserved.
    // Grace or frozen renewal: expiresAt is past → max() = now → now + period.
    const newExpiresAt = Math.max(club.subscriptionExpiresAt, now) + periodMs;

    await ctx.db.patch(club._id, {
      subscriptionStatus: "active",
      subscriptionExpiresAt: newExpiresAt,
    });

    await ctx.scheduler.runAfter(
      0,
      internal.notifications.sendRenewalConfirmationEmail,
      {
        ownerId: ownerConvexId,
        clubId: club._id,
        clubName: club.name,
        newExpiresAt,
      },
    );
  },
});

export const getPaymentHistory = query({
  args: { ownerId: v.id("users") },
  handler: async (ctx, { ownerId }) => {
    const viewer = await requireViewer(ctx);
    if (viewer.role === "admin") {
      // admin may load any owner's receipts
    } else if (viewer.role === "owner" && viewer.userId === ownerId) {
      // owner may load own receipts only
    } else {
      throw new Error("PERM_001: Not authorized to view this payment history");
    }

    return await ctx.db
      .query("paymentReceipts")
      .withIndex("by_owner", (q) => q.eq("ownerId", ownerId))
      .order("desc")
      .collect();
  },
});
