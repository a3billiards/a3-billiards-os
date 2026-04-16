import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";

const http = httpRouter();

// ─────────────────────────────────────────────
// ROUTE 1: WhatsApp — Hub Challenge Verification
// Called by Meta when the webhook is first registered.
// Meta sends a GET with hub.mode=subscribe, hub.verify_token, and hub.challenge.
// Respond with the hub.challenge value to confirm ownership.
// ─────────────────────────────────────────────
http.route({
  path: "/whatsapp/webhook",
  method: "GET",
  handler: httpAction(async (_, req) => {
    const url = new URL(req.url);
    const mode = url.searchParams.get("hub.mode");
    const verifyToken = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");

    if (
      mode === "subscribe" &&
      verifyToken === process.env.WHATSAPP_VERIFY_TOKEN
    ) {
      return new Response(challenge, { status: 200 });
    }

    return new Response("Forbidden", { status: 403 });
  }),
});

// ─────────────────────────────────────────────
// ROUTE 2: WhatsApp — Incoming Messages & Status Updates
// Meta sends delivery receipts, read receipts, and incoming messages here.
// For A3 Billiards OS, outbound OTPs are the only messages sent.
// Incoming payloads are delivery status updates — log and return 200.
// No OTP verification logic here — OTP is verified via client calling
// the verifyOtp mutation directly. This route only handles Meta callbacks.
// TODO: process delivery status updates to track OTP delivery success/failure if needed in a future iteration.
// ─────────────────────────────────────────────
http.route({
  path: "/whatsapp/webhook",
  method: "POST",
  handler: httpAction(async (_ctx, req) => {
    const body = await req.json();
    void body;
    return new Response("OK", { status: 200 });
  }),
});

// ─────────────────────────────────────────────
// ROUTE 3: Razorpay — Payment Webhook (Idempotent)
// Razorpay calls this on payment.captured and other events.
// rawBody MUST be read as text (not JSON) before HMAC-SHA256 verification.
// Parsing as JSON first corrupts the raw bytes and breaks the signature check.
// HMAC verification is delegated to an action (crypto only runs in actions).
// Always return 200 — Razorpay retries on non-200, and the idempotency
// check in processPayment handles any duplicate webhook deliveries safely.
// ─────────────────────────────────────────────
http.route({
  path: "/razorpay/webhook",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    const rawBody = await req.text();
    const sig = req.headers.get("x-razorpay-signature") ?? "";

    try {
      await ctx.runAction(internal.paymentReceipts.handleWebhook, {
        rawBody,
        signature: sig,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("Razorpay webhook error:", message);
    }

    return new Response("OK", { status: 200 });
  }),
});

// ─────────────────────────────────────────────
// ROUTE 4: Deletion Cancellation — Redemption Link
// Linked from the account deletion confirmation email.
// URL format: https://api.a3billiards.com/cancel-deletion?token={rawToken}
// The raw token is SHA-256 hashed and matched against users.deletionCancelToken.
// Crypto runs in the redeemCancellationToken action (not here directly).
// On success: redirect to a success page on the web domain.
// On failure: redirect with an error query param for display.
// ─────────────────────────────────────────────
http.route({
  path: "/cancel-deletion",
  method: "GET",
  handler: httpAction(async (ctx, req) => {
    const url = new URL(req.url);
    const token = url.searchParams.get("token");

    if (!token) {
      return Response.redirect(
        "https://a3billiards.com/deletion-cancelled?error=missing_token",
        302,
      );
    }

    try {
      await ctx.runAction(internal.deletion.redeemCancellationToken, {
        token,
      });
      return Response.redirect(
        "https://a3billiards.com/deletion-cancelled?success=true",
        302,
      );
    } catch (err: unknown) {
      const message = encodeURIComponent(
        err instanceof Error ? err.message : "unknown_error",
      );
      return Response.redirect(
        `https://a3billiards.com/deletion-cancelled?error=${message}`,
        302,
      );
    }
  }),
});

export default http;
