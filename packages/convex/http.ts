import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { auth } from "./auth";
import { convexSiteOrigin } from "./model/convexSiteOrigin";

const http = httpRouter();

function onboardingWebOrigin(): string {
  return convexSiteOrigin();
}

function htmlPage(title: string, body: string): Response {
  return new Response(
    `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title} — A3 Billiards</title><style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:system-ui,sans-serif;background:#0a0a0a;color:#f0f0f0;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:16px}.card{background:#1a1a1a;border:1px solid #2a2a2a;border-radius:16px;padding:28px 24px;width:100%;max-width:420px}h1{font-size:1.4rem;margin-bottom:8px}p.muted{color:#888;font-size:.9rem;margin-bottom:16px}label{display:block;font-size:.85rem;color:#aaa;margin-bottom:4px;margin-top:12px}input{width:100%;padding:10px 12px;background:#111;border:1px solid #333;border-radius:8px;color:#f0f0f0;font-size:1rem;outline:none}.bar-wrap{display:flex;align-items:center;gap:8px;margin:6px 0 2px}.bar-segs{flex:1;display:flex;gap:4px}.seg{flex:1;height:4px;border-radius:2px;background:#333}.bar-label{font-size:12px;font-weight:600;min-width:40px;text-align:right}.btn{display:block;width:100%;margin-top:20px;padding:12px;background:#4ade80;color:#000;font-weight:700;border:none;border-radius:10px;font-size:1rem;cursor:pointer}.btn:disabled{opacity:.5;cursor:not-allowed}.error{background:#3d1515;border:1px solid #7b2222;color:#f87171;border-radius:8px;padding:10px 12px;margin-top:12px;font-size:.9rem}.success{background:#143d22;border:1px solid #226b3d;color:#4ade80;border-radius:8px;padding:10px 12px;margin-top:12px;font-size:.9rem}.logo{font-size:1.1rem;font-weight:700;color:#4ade80;margin-bottom:16px}</style></head><body><div class="card">${body}</div></body></html>`,
    { headers: { "Content-Type": "text/html; charset=utf-8" } },
  );
}

// Convex Auth: OIDC metadata + JWKS for session JWT verification.
auth.addHttpRoutes(http);

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
// URL format: {CONVEX_SITE_URL}/cancel-deletion?token={rawToken}
// Processes the cancellation inline and returns a styled HTML page.
// ─────────────────────────────────────────────
http.route({
  path: "/cancel-deletion",
  method: "GET",
  handler: httpAction(async (ctx, req) => {
    const url = new URL(req.url);
    const token = url.searchParams.get("token");

    if (!token) {
      return htmlPage(
        "Cancellation Failed",
        `<div class="logo">A3 Billiards</div>
         <h1>Invalid Link</h1>
         <p class="muted">This cancellation link is missing a token. Please use the link from your email.</p>`,
      );
    }

    try {
      await ctx.runAction(internal.deletion.redeemCancellationToken, { token });
      return htmlPage(
        "Deletion Cancelled",
        `<div class="logo">A3 Billiards</div>
         <h1>✓ Account Deletion Cancelled</h1>
         <p class="muted">Your account deletion request has been cancelled. You can sign back into the app normally.</p>`,
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "unknown_error";
      const isExpired = message.includes("expired") || message.includes("used") || message.includes("DATA_003");
      return htmlPage(
        "Cancellation Failed",
        `<div class="logo">A3 Billiards</div>
         <h1>${isExpired ? "Link Expired" : "Cancellation Failed"}</h1>
         <p class="muted">${isExpired
           ? "This cancellation link has already been used or has expired. If your account was deleted in error, please contact support."
           : "Something went wrong. Please try the link from your email again."}</p>`,
      );
    }
  }),
});

// ─────────────────────────────────────────────
// ROUTE 5a: Password Reset — Inline HTML Form (GET)
// Email reset links point here. Returns a styled password-reset form.
// ─────────────────────────────────────────────
http.route({
  path: "/reset-password",
  method: "GET",
  handler: httpAction(async (_ctx, req) => {
    const token = new URL(req.url).searchParams.get("token") ?? "";
    const siteUrl = convexSiteOrigin();
    const bodyHtml = `
      <div class="logo">A3 Billiards</div>
      <h1>Reset Password</h1>
      <p class="muted">Enter your new password below.</p>
      <div id="msg"></div>
      <div id="form">
        <label for="pw">New password</label>
        <input id="pw" type="password" autocomplete="new-password" placeholder="At least 8 characters" oninput="onPwInput()">
        <div class="bar-wrap" id="barWrap" style="display:none">
          <div class="bar-segs"><div class="seg" id="s0"></div><div class="seg" id="s1"></div><div class="seg" id="s2"></div></div>
          <span class="bar-label" id="barLbl"></span>
        </div>
        <label for="pw2">Confirm password</label>
        <input id="pw2" type="password" autocomplete="new-password" placeholder="Repeat password">
        <button class="btn" id="submitBtn" onclick="doReset()">Update password</button>
      </div>
      <script>
        var TOKEN=${JSON.stringify(token)},SITE=${JSON.stringify(siteUrl)},COMP_TOKEN=null;
        var COLORS={weak:"#e53935",good:"#fb8c00",strong:"#43a047"};
        function strength(p){if(!p)return"none";var c=0;if(p.length>=8)c++;if(/[A-Z]/.test(p))c++;if(/[a-z]/.test(p))c++;if(/[0-9]/.test(p))c++;if(/[^A-Za-z0-9]/.test(p))c++;return c<=2?"weak":c<=4?"good":"strong";}
        function onPwInput(){var s=strength(document.getElementById("pw").value);var bw=document.getElementById("barWrap");if(s==="none"){bw.style.display="none";return;}bw.style.display="flex";var c=COLORS[s]||"#ccc";var segs=s==="weak"?1:s==="good"?2:3;["s0","s1","s2"].forEach(function(id,i){document.getElementById(id).style.background=i<segs?c:"#333";});document.getElementById("barLbl").textContent=s.charAt(0).toUpperCase()+s.slice(1);document.getElementById("barLbl").style.color=c;}
        function showMsg(text,ok){var el=document.getElementById("msg");el.className=ok?"success":"error";el.textContent=text;}
        async function doReset(){
          var btn=document.getElementById("submitBtn");
          btn.disabled=true;
          var pw=document.getElementById("pw").value,pw2=document.getElementById("pw2").value;
          if(pw!==pw2){showMsg("Passwords do not match.",false);btn.disabled=false;return;}
          if(pw.length<8){showMsg("Password must be at least 8 characters.",false);btn.disabled=false;return;}
          if(!COMP_TOKEN){
            var r=await fetch(SITE+"/reset-password-verify",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({token:TOKEN})});
            var d=await r.json();
            if(!d.valid){showMsg("This reset link is invalid or has expired. Please request a new one.",false);btn.disabled=false;return;}
            COMP_TOKEN=d.completionToken;
          }
          var r2=await fetch(SITE+"/reset-password-complete",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({completionToken:COMP_TOKEN,newPassword:pw})});
          var d2=await r2.json();
          if(d2.success){document.getElementById("form").style.display="none";showMsg("Password updated! You can now sign in to the app.",true);}
          else{showMsg(d2.error||"Reset failed. Please request a new link.",false);btn.disabled=false;}
        }
      </script>`;
    return htmlPage("Reset Password", bodyHtml);
  }),
});

// ─────────────────────────────────────────────
// ROUTE 5b: Password Reset — Verify token (POST, called by the HTML form above)
// ─────────────────────────────────────────────
http.route({
  path: "/reset-password-verify",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    try {
      const { token } = (await req.json()) as { token: string };
      const result = await ctx.runAction(
        internal.passwordResetActions.verifyResetTokenInternal,
        { token: token ?? "" },
      );
      return Response.json(result);
    } catch (err: unknown) {
      return Response.json(
        { valid: false, error: err instanceof Error ? err.message : "error" },
        { status: 400 },
      );
    }
  }),
});

// ─────────────────────────────────────────────
// ROUTE 5c: Password Reset — Complete reset (POST, called by the HTML form above)
// ─────────────────────────────────────────────
http.route({
  path: "/reset-password-complete",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    try {
      const { completionToken, newPassword } = (await req.json()) as {
        completionToken: string;
        newPassword: string;
      };
      await ctx.runAction(
        internal.passwordResetActions.resetPasswordInternal,
        { completionToken: completionToken ?? "", newPassword: newPassword ?? "" },
      );
      return Response.json({ success: true });
    } catch (err: unknown) {
      const msg = err instanceof Error
        ? err.message.replace(/^[A-Z_]+_\d+:\s*/, "")
        : "Reset failed";
      return Response.json({ success: false, error: msg }, { status: 400 });
    }
  }),
});

// ─────────────────────────────────────────────
// ROUTE 5: AWS EventBridge — IVS Stream State Change (Live Streaming)
// EventBridge API Destination POSTs IVS events here.
// Verify X-A3-EventBridge-Secret header against AWS_EVENTBRIDGE_WEBHOOK_SECRET.
// On Stream End: reconcile liveStreams rows still marked live (connection_lost).
// Invalid secret → 403. Valid payloads always → 200 (idempotent no-ops OK).
// ─────────────────────────────────────────────
http.route({
  path: "/webhooks/ivs-events",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    const rawBody = await req.text();
    const secretHeader = req.headers.get("x-a3-eventbridge-secret") ?? "";

    try {
      await ctx.runAction(internal.livestreamWebhook.handleIvsEventWebhook, {
        rawBody,
        secretHeader,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes("Invalid webhook secret") || message.includes("PERM_001")) {
        return new Response("Forbidden", { status: 403 });
      }
      console.error("IVS EventBridge webhook error:", message);
    }

    return new Response("OK", { status: 200 });
  }),
});

// ─────────────────────────────────────────────
// Booking payment Checkout (opened from Customer app)
// Query: orderId, keyId, amount, currency, name, email, contact, description
// ─────────────────────────────────────────────
http.route({
  path: "/booking-pay",
  method: "GET",
  handler: httpAction(async (_ctx, req) => {
    const url = new URL(req.url);
    const orderId = url.searchParams.get("orderId") ?? "";
    const keyId = url.searchParams.get("keyId") ?? "";
    const amount = url.searchParams.get("amount") ?? "";
    const currency = url.searchParams.get("currency") ?? "INR";
    const name = url.searchParams.get("name") ?? "";
    const email = url.searchParams.get("email") ?? "";
    const contact = url.searchParams.get("contact") ?? "";
    const description = url.searchParams.get("description") ?? "Booking payment";

    if (!orderId || !keyId || !amount) {
      return htmlPage(
        "Payment",
        `<div class="logo">A3 Billiards</div><h1>Payment unavailable</h1><p class="muted">Missing payment details. Return to the app and try again.</p>`,
      );
    }

    const safe = (s: string) =>
      s.replace(/\\/g, "\\\\").replace(/'/g, "\\'").replace(/</g, "");

    const body = `
<div class="logo">A3 Billiards</div>
<h1>Complete payment</h1>
<p class="muted">${safe(description)}</p>
<p class="muted" id="status">Opening Razorpay…</p>
<div id="msg"></div>
<script src="https://checkout.razorpay.com/v1/checkout.js"><\/script>
<script>
(function(){
  var opts = {
    key: '${safe(keyId)}',
    amount: ${Number(amount)},
    currency: '${safe(currency)}',
    name: 'A3 Billiards',
    description: '${safe(description)}',
    order_id: '${safe(orderId)}',
    prefill: {
      name: '${safe(name)}',
      email: '${safe(email)}',
      contact: '${safe(contact)}'
    },
    theme: { color: '#4ade80' },
    handler: function(resp){
      document.getElementById('status').textContent = 'Payment successful';
      document.getElementById('msg').innerHTML = '<div class="success">Payment received. You can close this page and return to the A3 Customer app. Pull to refresh your booking.</div>';
      post({ type: 'success', paymentId: resp && resp.razorpay_payment_id });
    },
    modal: {
      ondismiss: function(){
        document.getElementById('status').textContent = 'Payment cancelled';
        document.getElementById('msg').innerHTML = '<div class="error">Payment was not completed. Return to the app to try again.</div>';
        post({ type: 'dismiss' });
      }
    }
  };
  function post(payload) {
    if (window.ReactNativeWebView) {
      window.ReactNativeWebView.postMessage(JSON.stringify(payload));
    }
  }
  try {
    var rzp = new Razorpay(opts);
    rzp.on('payment.failed', function(resp){
      document.getElementById('status').textContent = 'Payment failed';
      var reason = (resp && resp.error && resp.error.description) ? resp.error.description : 'Payment failed';
      document.getElementById('msg').innerHTML = '<div class="error">' + reason + '</div>';
      post({ type: 'failed', reason: reason });
    });
    rzp.open();
  } catch (e) {
    document.getElementById('status').textContent = 'Could not open checkout';
    document.getElementById('msg').innerHTML = '<div class="error">Razorpay could not start. Check that keys are configured.</div>';
    post({ type: 'error', reason: String(e) });
  }
})();
<\/script>`;

    return htmlPage("Pay for booking", body);
  }),
});

export default http;
