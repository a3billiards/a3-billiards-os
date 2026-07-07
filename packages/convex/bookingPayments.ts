/**
 * Customer booking payments via Razorpay.
 * Pay full estimated cost only after owner approves.
 * Cancel + full refund only before (booking start − cancellationWindowMin).
 */

import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import {
  action,
  internalAction,
  internalMutation,
  internalQuery,
} from "./_generated/server";
import { convexSiteOrigin } from "./model/convexSiteOrigin";

function base64EncodeUtf8(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

function razorpayAuthHeader(): string {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) {
    throw new Error("DATA_001: Razorpay is not configured");
  }
  return `Basic ${base64EncodeUtf8(`${keyId}:${keySecret}`)}`;
}

function amountToPaise(amount: number, currency: string): number {
  // INR and most major currencies use 2 decimal subunits.
  const paise = Math.round(amount * 100);
  if (!Number.isFinite(paise) || paise <= 0) {
    throw new Error("PAYMENT_002: Invalid booking amount");
  }
  if (currency !== "INR" && currency !== "USD" && currency !== "EUR") {
    // Still allow; Razorpay account must support the currency.
  }
  return paise;
}

export const getBookingForPayment = internalQuery({
  args: { bookingId: v.id("bookings") },
  handler: async (ctx, { bookingId }) => {
    const booking = await ctx.db.get(bookingId);
    if (!booking) return null;
    const club = await ctx.db.get(booking.clubId);
    return { booking, club };
  },
});

export const markBookingPaymentPending = internalMutation({
  args: {
    bookingId: v.id("bookings"),
    razorpayOrderId: v.string(),
  },
  handler: async (ctx, { bookingId, razorpayOrderId }) => {
    const booking = await ctx.db.get(bookingId);
    if (!booking) throw new Error("DATA_003: Booking not found");
    await ctx.db.patch(bookingId, {
      onlinePaymentStatus: "pending",
      razorpayOrderId,
      updatedAt: Date.now(),
    });
    const log = await ctx.db
      .query("bookingLogs")
      .withIndex("by_bookingId", (q) => q.eq("bookingId", bookingId))
      .unique();
    if (log) {
      await ctx.db.patch(log._id, {
        onlinePaymentStatus: "pending",
        updatedAt: Date.now(),
      });
    }
  },
});

export const processBookingPayment = internalMutation({
  args: {
    paymentId: v.string(),
    bookingId: v.string(),
    customerId: v.string(),
    amountPaise: v.number(),
  },
  handler: async (ctx, { paymentId, bookingId, customerId, amountPaise }) => {
    const existing = await ctx.db
      .query("bookingPayments")
      .withIndex("by_paymentId", (q) => q.eq("paymentId", paymentId))
      .first();
    if (existing) return { status: "duplicate" as const };

    const bookingConvexId = bookingId as Id<"bookings">;
    const customerConvexId = customerId as Id<"users">;
    const booking = await ctx.db.get(bookingConvexId);
    if (!booking) throw new Error("PAYMENT_002: Booking not found");
    if (booking.customerId !== customerConvexId) {
      throw new Error("PAYMENT_002: Payment customer mismatch");
    }
    if (booking.status !== "confirmed") {
      throw new Error("PAYMENT_002: Booking is not awaiting payment");
    }
    if (booking.onlinePaymentStatus === "paid") {
      return { status: "already_paid" as const };
    }

    const now = Date.now();
    await ctx.db.insert("bookingPayments", {
      paymentId,
      bookingId: bookingConvexId,
      customerId: customerConvexId,
      clubId: booking.clubId,
      amountPaise,
      status: "paid",
      processedAt: now,
    });

    await ctx.db.patch(bookingConvexId, {
      onlinePaymentStatus: "paid",
      razorpayPaymentId: paymentId,
      amountPaidPaise: amountPaise,
      paidAt: now,
      updatedAt: now,
    });

    const log = await ctx.db
      .query("bookingLogs")
      .withIndex("by_bookingId", (q) => q.eq("bookingId", bookingConvexId))
      .unique();
    if (log) {
      await ctx.db.patch(log._id, {
        onlinePaymentStatus: "paid",
        amountPaidPaise: amountPaise,
        updatedAt: now,
      });
    }

    return { status: "processed" as const };
  },
});

export const markBookingRefunded = internalMutation({
  args: {
    bookingId: v.id("bookings"),
    paymentId: v.string(),
    refundId: v.string(),
    failed: v.optional(v.boolean()),
  },
  handler: async (ctx, { bookingId, paymentId, refundId, failed }) => {
    const now = Date.now();
    const status = failed ? ("refund_failed" as const) : ("refunded" as const);
    await ctx.db.patch(bookingId, {
      onlinePaymentStatus: status,
      refundId: failed ? undefined : refundId,
      refundedAt: failed ? undefined : now,
      updatedAt: now,
    });
    const log = await ctx.db
      .query("bookingLogs")
      .withIndex("by_bookingId", (q) => q.eq("bookingId", bookingId))
      .unique();
    if (log) {
      await ctx.db.patch(log._id, {
        onlinePaymentStatus: status,
        updatedAt: now,
      });
    }
    const receipt = await ctx.db
      .query("bookingPayments")
      .withIndex("by_paymentId", (q) => q.eq("paymentId", paymentId))
      .first();
    if (receipt && !failed) {
      await ctx.db.patch(receipt._id, {
        status: "refunded",
        refundId,
      });
    }
  },
});

/** Customer creates a Razorpay order for a confirmed unpaid booking (full amount). */
export const createBookingPaymentOrder = action({
  args: { bookingId: v.id("bookings") },
  handler: async (ctx, { bookingId }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("AUTH_001: Not authenticated");

    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keyId || !keySecret) {
      throw new Error("DATA_001: Razorpay is not configured");
    }

    const row = await ctx.runQuery(internal.bookingPayments.getBookingForPayment, {
      bookingId,
    });
    if (!row?.booking) throw new Error("DATA_003: Booking not found");
    const { booking } = row;
    if (booking.customerId !== userId) {
      throw new Error("PERM_001: Not your booking");
    }
    if (booking.status !== "confirmed") {
      throw new Error("BOOKING_006: Pay only after the club accepts your booking");
    }
    if (booking.onlinePaymentStatus === "paid") {
      throw new Error("PAYMENT_002: Booking is already paid");
    }
    const cost = booking.estimatedCost ?? 0;
    if (cost <= 0) {
      throw new Error("PAYMENT_002: Nothing to pay for this booking");
    }

    const amountPaise = amountToPaise(cost, booking.currency);
    const receipt = `bk_${String(bookingId).slice(-10)}_${Date.now()}`.slice(0, 40);
    const auth = razorpayAuthHeader();

    const orderBody = {
      amount: amountPaise,
      currency: booking.currency || "INR",
      receipt,
      notes: {
        flow: "booking",
        bookingId: String(bookingId),
        customerId: String(userId),
        clubId: String(booking.clubId),
      },
    };

    const res = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: {
        Authorization: auth,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(orderBody),
    });
    const raw = await res.text();
    if (!res.ok) {
      console.error("Razorpay booking order error:", raw);
      throw new Error("PAYMENT_003: Could not start payment — try again later");
    }
    const json = JSON.parse(raw) as { id?: string };
    if (!json.id) {
      throw new Error("PAYMENT_003: Invalid Razorpay response");
    }

    await ctx.runMutation(internal.bookingPayments.markBookingPaymentPending, {
      bookingId,
      razorpayOrderId: json.id,
    });

    const user = await ctx.runQuery(internal.otp.getUserById, { userId });
    const description = `Booking ${booking.requestedDate} ${booking.requestedStartTime}`;
    const params = new URLSearchParams({
      orderId: json.id,
      keyId,
      amount: String(amountPaise),
      currency: booking.currency || "INR",
      name: user?.name ?? "",
      email: user?.email ?? "",
      contact: user?.phone ?? "",
      description,
    });
    const checkoutUrl = `${convexSiteOrigin()}/booking-pay?${params.toString()}`;

    return {
      orderId: json.id,
      amountPaise,
      currency: booking.currency || "INR",
      keyId,
      bookingId,
      checkoutUrl,
      prefillName: user?.name ?? "",
      prefillEmail: user?.email ?? "",
      prefillContact: user?.phone ?? "",
      description,
    };
  },
});

/** Full refund via Razorpay (called after cancel is allowed). */
export const refundBookingPayment = internalAction({
  args: {
    bookingId: v.id("bookings"),
    paymentId: v.string(),
    amountPaise: v.number(),
  },
  handler: async (ctx, { bookingId, paymentId, amountPaise }) => {
    try {
      const auth = razorpayAuthHeader();
      const res = await fetch(
        `https://api.razorpay.com/v1/payments/${encodeURIComponent(paymentId)}/refund`,
        {
          method: "POST",
          headers: {
            Authorization: auth,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            amount: amountPaise,
            notes: { bookingId: String(bookingId), flow: "booking_cancel" },
          }),
        },
      );
      const raw = await res.text();
      if (!res.ok) {
        console.error("Razorpay refund error:", raw);
        await ctx.runMutation(internal.bookingPayments.markBookingRefunded, {
          bookingId,
          paymentId,
          refundId: "failed",
          failed: true,
        });
        return { refunded: false as const };
      }
      const json = JSON.parse(raw) as { id?: string };
      const refundId = json.id ?? "unknown";
      await ctx.runMutation(internal.bookingPayments.markBookingRefunded, {
        bookingId,
        paymentId,
        refundId,
      });
      return { refunded: true as const, refundId };
    } catch (e) {
      console.error("Razorpay refund exception:", e);
      await ctx.runMutation(internal.bookingPayments.markBookingRefunded, {
        bookingId,
        paymentId,
        refundId: "failed",
        failed: true,
      });
      return { refunded: false as const };
    }
  },
});

/** Public action: whether Razorpay keys are present (for UI / test mode messaging). */
export const getRazorpayPublicConfig = action({
  args: {},
  handler: async () => {
    const keyId = process.env.RAZORPAY_KEY_ID ?? "";
    return {
      configured: keyId.length > 0,
      keyId: keyId.length > 0 ? keyId : null,
    };
  },
});
