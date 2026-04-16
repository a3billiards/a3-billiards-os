"use node";

/**
 * FCM HTTP v1 (OAuth2, per-token sends) + Resend HTML emails (@react-email).
 * Secrets: FIREBASE_PROJECT_ID, FIREBASE_SERVICE_ACCOUNT_JSON, RESEND_API_KEY.
 *
 * // TODO: cache the FCM access token in memory for its ~1-hour lifetime to avoid redundant OAuth requests
 */

import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalAction } from "./_generated/server";

// Ensure a3billiards.com is verified in your Resend dashboard before deployment.
const RESEND_FROM = "A3 Billiards OS <noreply@a3billiards.com>";

function requireEnv(name: string): string {
  const val = process.env[name];
  if (!val) throw new Error(`DATA_001: Missing ${name}`);
  return val;
}

async function getFcmAccessToken(): Promise<string> {
  const { GoogleAuth } = await import("google-auth-library");
  const raw = requireEnv("FIREBASE_SERVICE_ACCOUNT_JSON");
  const auth = new GoogleAuth({
    credentials: JSON.parse(raw) as Record<string, unknown>,
    scopes: ["https://www.googleapis.com/auth/firebase.messaging"],
  });
  const client = await auth.getClient();
  const { token } = await client.getAccessToken();
  if (!token) throw new Error("DATA_001: Failed to obtain FCM access token");
  return token;
}

function stringifyData(
  data?: Record<string, string> | Record<string, unknown>,
): Record<string, string> | undefined {
  if (!data) return undefined;
  return Object.fromEntries(
    Object.entries(data).map(([k, val]) => [k, String(val)]),
  );
}

function shouldRemoveStaleToken(errJson: unknown): boolean {
  const s = JSON.stringify(errJson);
  if (s.includes("UNREGISTERED")) return true;
  if (s.includes("INVALID_ARGUMENT") && /Registration|token|Token/i.test(s)) {
    return true;
  }
  try {
    const o = errJson as {
      error?: { details?: { errorCode?: string }[] };
    };
    const details = o?.error?.details ?? [];
    return details.some((d) => d?.errorCode === "UNREGISTERED");
  } catch {
    return false;
  }
}

export const sendFcmNotification = internalAction({
  args: {
    tokens: v.array(v.string()),
    title: v.string(),
    body: v.string(),
    data: v.optional(v.record(v.string(), v.string())),
  },
  handler: async (ctx, { tokens, title, body, data }) => {
    const accessToken = await getFcmAccessToken();
    const projectId = requireEnv("FIREBASE_PROJECT_ID");
    const stringData = stringifyData(data);
    const results: Record<string, "sent" | "failed"> = {};

    for (const token of tokens) {
      try {
        const res = await fetch(
          `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              message: {
                token,
                notification: { title, body },
                ...(stringData ? { data: stringData } : {}),
              },
            }),
          },
        );
        if (res.ok) {
          results[token] = "sent";
        } else {
          results[token] = "failed";
          const errJson: unknown = await res.json().catch(() => ({}));
          if (shouldRemoveStaleToken(errJson)) {
            await ctx.runMutation(internal.users.removeStaleToken, { token });
          }
        }
      } catch {
        results[token] = "failed";
      }
    }
    return results;
  },
});

type SendEmailOpts = {
  to: string;
  subject: string;
  html: string;
  text?: string;
  attachments?: { filename: string; content: string }[];
};

async function sendEmail({ to, subject, html, text, attachments }: SendEmailOpts) {
  const body: Record<string, unknown> = {
    from: RESEND_FROM,
    to: [to],
    subject,
    html,
  };
  if (text) body.text = text;
  if (attachments?.length) body.attachments = attachments;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${requireEnv("RESEND_API_KEY")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Resend error: ${err}`);
  }
  return (await res.json()) as unknown;
}

export const sendPasswordResetEmail = internalAction({
  args: { email: v.string(), resetLink: v.string() },
  handler: async (_ctx, { email, resetLink }) => {
    const { render } = await import("@react-email/render");
    const { PasswordReset } = await import("../../emails/templates/PasswordReset");
    const html = await render(PasswordReset({ resetLink }));
    const text = `Reset your A3 Billiards OS password (expires in 1 hour): ${resetLink}\n\nIf you didn't request this, ignore this email.`;
    await sendEmail({
      to: email,
      subject: "Reset your A3 Billiards OS password",
      html,
      text,
    });
  },
});

export const sendPasscodeResetEmail = internalAction({
  args: { email: v.string(), resetLink: v.string() },
  handler: async (_ctx, { email, resetLink }) => {
    const { render } = await import("@react-email/render");
    const { PasscodeReset } = await import("../../emails/templates/PasscodeReset");
    const html = await render(PasscodeReset({ resetLink }));
    const text = `Reset your settings PIN: ${resetLink}`;
    await sendEmail({
      to: email,
      subject: "Reset your A3 Billiards OS settings PIN",
      html,
      text,
    });
  },
});

export const sendMfaEmail = internalAction({
  args: { email: v.string(), code: v.string() },
  handler: async (_ctx, { email, code }) => {
    const { render } = await import("@react-email/render");
    const { AdminMfa } = await import("../../emails/templates/AdminMfa");
    const html = await render(AdminMfa({ code }));
    const text = `Your A3 Billiards OS verification code: ${code}. Expires in 10 minutes.`;
    await sendEmail({
      to: email,
      subject: "Your A3 Billiards OS verification code",
      html,
      text,
    });
  },
});

export const sendCustomerWelcomeEmail = internalAction({
  args: { email: v.string() },
  handler: async (_ctx, { email }) => {
    const { render } = await import("@react-email/render");
    const { CustomerWelcome } = await import("../../emails/templates/CustomerWelcome");
    const html = await render(CustomerWelcome());
    await sendEmail({
      to: email,
      subject: "Welcome to A3 Billiards OS",
      html,
      text: "Welcome to A3 Billiards OS. Open the app: https://links.a3billiards.com/customer/home",
    });
  },
});

export const sendOnboardingWelcomeEmail = internalAction({
  args: {
    email: v.string(),
    clubName: v.string(),
    subscriptionExpiryLabel: v.string(),
  },
  handler: async (_ctx, { email, clubName, subscriptionExpiryLabel }) => {
    const { render } = await import("@react-email/render");
    const { OnboardingWelcome } = await import("../../emails/templates/OnboardingWelcome");
    const html = await render(
      OnboardingWelcome({ clubName, subscriptionExpiryLabel }),
    );
    await sendEmail({
      to: email,
      subject: "Your club is live on A3 Billiards OS",
      html,
      text: `Your club ${clubName} is live. Subscription through ${subscriptionExpiryLabel}.`,
    });
  },
});

export const sendSubscriptionReminderEmail = internalAction({
  args: {
    email: v.string(),
    clubName: v.string(),
    expiryDate: v.string(),
    daysUntil: v.number(),
  },
  handler: async (_ctx, { email, clubName, expiryDate, daysUntil }) => {
    const { render } = await import("@react-email/render");
    const { SubscriptionReminder } = await import("../../emails/templates/SubscriptionReminder");
    const html = await render(
      SubscriptionReminder({ clubName, expiryDate, daysUntil }),
    );
    const dayLabel = daysUntil === 1 ? "1 day" : `${daysUntil} days`;
    await sendEmail({
      to: email,
      subject: `Your A3 Billiards OS subscription renews in ${dayLabel}`,
      html,
      text: `Subscription for ${clubName} expires ${expiryDate} (${dayLabel}). Renew: https://register.a3billiards.com/renew`,
    });
  },
});

export const sendSubscriptionGracePeriodEmail = internalAction({
  args: {
    email: v.string(),
    clubName: v.string(),
    freezeTime: v.string(),
  },
  handler: async (_ctx, { email, clubName, freezeTime }) => {
    const { render } = await import("@react-email/render");
    const { SubscriptionGracePeriod } = await import(
      "../../emails/templates/SubscriptionGracePeriod"
    );
    const html = await render(
      SubscriptionGracePeriod({ clubName, freezeTime }),
    );
    await sendEmail({
      to: email,
      subject: "Action required: renew your A3 Billiards OS subscription",
      html,
      text: `Your subscription for ${clubName} has expired. Access ends after ${freezeTime}. Renew: https://register.a3billiards.com/renew`,
    });
  },
});

export const sendDeletionConfirmationEmail = internalAction({
  args: {
    email: v.string(),
    cancelLink: v.string(),
    role: v.string(),
  },
  handler: async (_ctx, { email, cancelLink, role }) => {
    const { render } = await import("@react-email/render");
    const { DeletionConfirmation } = await import(
      "../../emails/templates/DeletionConfirmation"
    );
    const html = await render(DeletionConfirmation({ cancelLink, role }));
    await sendEmail({
      to: email,
      subject: "Your A3 Billiards OS account deletion is scheduled",
      html,
      text: `Account deletion scheduled. Cancel: ${cancelLink}`,
    });
  },
});

export const sendRenewalConfirmationEmail = internalAction({
  args: {
    email: v.string(),
    clubName: v.string(),
    newExpiryDate: v.string(),
  },
  handler: async (_ctx, { email, clubName, newExpiryDate }) => {
    const { render } = await import("@react-email/render");
    const { RenewalConfirmation } = await import(
      "../../emails/templates/RenewalConfirmation"
    );
    const html = await render(RenewalConfirmation({ clubName, newExpiryDate }));
    await sendEmail({
      to: email,
      subject: "Subscription renewed — you're all set",
      html,
      text: `Subscription renewed for ${clubName} until ${newExpiryDate}.`,
    });
  },
});

export const sendDataExportEmailWithJson = internalAction({
  args: { email: v.string(), json: v.string() },
  handler: async (_ctx, { email, json }) => {
    const { render } = await import("@react-email/render");
    const { DataExport } = await import("../../emails/templates/DataExport");
    const html = await render(DataExport({ attached: true }));
    const b64 = Buffer.from(json, "utf8").toString("base64");
    await sendEmail({
      to: email,
      subject: "Your A3 Billiards OS data export is ready",
      html,
      text: "Your A3 Billiards OS data export is attached as JSON.",
      attachments: [{ filename: "a3-export.json", content: b64 }],
    });
  },
});
