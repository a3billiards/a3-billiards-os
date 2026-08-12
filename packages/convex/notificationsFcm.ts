"use node";

/**
 * FCM via firebase-admin + Resend HTML emails (plain HTML templates).
 * Secrets: FIREBASE_PROJECT_ID, FIREBASE_SERVICE_ACCOUNT_JSON, RESEND_API_KEY.
 */

import { v } from "convex/values";
import type { ServiceAccount } from "firebase-admin/app";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getMessaging } from "firebase-admin/messaging";
import { internal } from "./_generated/api";
import { internalAction } from "./_generated/server";
import {
  customerWelcomeHtml,
  dataExportHtml,
  deletionConfirmationHtml,
  mfaCodeHtml,
  onboardingWelcomeHtml,
  ownerEmailVerificationHtml,
  passcodeResetHtml,
  passwordResetHtml,
  renewalConfirmationHtml,
  subscriptionGracePeriodHtml,
  subscriptionReminderHtml,
} from "./model/transactionalEmailHtml";

// Ensure a3billiards.com is verified in your Resend dashboard before deployment.
const RESEND_FROM = "A3 Billiards OS <noreply@a3billiards.com>";

import {
  requireServerEnv,
  summarizeProviderHttpError,
} from "./model/envSecrets";

function parseServiceAccount(): ServiceAccount {
  const raw = requireServerEnv("FIREBASE_SERVICE_ACCOUNT_JSON");
  try {
    return JSON.parse(raw) as ServiceAccount;
  } catch {
    throw new Error(
      "DATA_001: FIREBASE_SERVICE_ACCOUNT_JSON is not valid JSON — paste the full service account file as one line",
    );
  }
}

function ensureFirebaseAdmin(): void {
  if (getApps().length > 0) return;
  const credentials = parseServiceAccount();
  const projectId =
    process.env.FIREBASE_PROJECT_ID ??
    (credentials as ServiceAccount & { project_id?: string }).projectId ??
    (credentials as ServiceAccount & { project_id?: string }).project_id;
  initializeApp({
    credential: cert(credentials),
    ...(typeof projectId === "string" && projectId.length > 0
      ? { projectId }
      : {}),
  });
}

function isStaleFcmError(err: unknown): boolean {
  const code = (err as { code?: string })?.code;
  return (
    code === "messaging/registration-token-not-registered" ||
    code === "messaging/invalid-registration-token" ||
    code === "messaging/invalid-argument"
  );
}

function isExpoPushToken(token: string): boolean {
  return token.startsWith("ExponentPushToken[");
}

function stringifyData(
  data?: Record<string, string> | Record<string, unknown>,
): Record<string, string> | undefined {
  if (!data) return undefined;
  return Object.fromEntries(
    Object.entries(data).map(([k, val]) => [k, String(val)]),
  );
}

export const sendFcmNotification = internalAction({
  args: {
    tokens: v.array(v.string()),
    title: v.string(),
    body: v.string(),
    data: v.optional(v.record(v.string(), v.string())),
  },
  handler: async (ctx, { tokens, title, body, data }) => {
    ensureFirebaseAdmin();
    const messaging = getMessaging();
    const stringData = stringifyData(data);
    const results: Record<string, "sent" | "failed"> = {};

    for (const token of tokens) {
      if (isExpoPushToken(token)) {
        results[token] = "failed";
        continue;
      }
      try {
        await messaging.send({
          token,
          notification: { title, body },
          ...(stringData ? { data: stringData } : {}),
        });
        results[token] = "sent";
      } catch (e) {
        results[token] = "failed";
        if (isStaleFcmError(e)) {
          await ctx.runMutation(internal.users.removeStaleToken, { token });
        }
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
      Authorization: `Bearer ${requireServerEnv("RESEND_API_KEY")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(summarizeProviderHttpError(err, "Resend"));
  }
  return (await res.json()) as unknown;
}

export const sendPasswordResetEmail = internalAction({
  args: { email: v.string(), resetLink: v.string() },
  handler: async (_ctx, { email, resetLink }) => {
    const html = passwordResetHtml(resetLink);
    const text = `Reset your A3 Billiards OS password (expires in 1 hour): ${resetLink}\n\nIf you didn't request this, ignore this email.`;
    await sendEmail({ to: email, subject: "Reset your A3 Billiards OS password", html, text });
  },
});

export const sendPasscodeResetEmail = internalAction({
  args: { email: v.string(), resetLink: v.string() },
  handler: async (_ctx, { email, resetLink }) => {
    const html = passcodeResetHtml(resetLink);
    const text = `Reset your settings PIN: ${resetLink}`;
    await sendEmail({ to: email, subject: "Reset your A3 Billiards OS settings PIN", html, text });
  },
});

export const sendMfaEmail = internalAction({
  args: { email: v.string(), code: v.string() },
  handler: async (_ctx, { email, code }) => {
    const html = mfaCodeHtml(code);
    const text = `Your A3 Billiards OS verification code: ${code}. Expires in 10 minutes.`;
    await sendEmail({ to: email, subject: "Your A3 Billiards OS verification code", html, text });
  },
});

export const sendOwnerEmailVerificationEmail = internalAction({
  args: { email: v.string(), code: v.string() },
  handler: async (_ctx, { email, code }) => {
    const html = ownerEmailVerificationHtml(code);
    const text = `Your A3 Billiards owner email verification code: ${code}. Expires in 10 minutes.`;
    await sendEmail({ to: email, subject: "Verify your A3 Billiards owner email", html, text });
  },
});

export const sendCustomerWelcomeEmail = internalAction({
  args: { email: v.string() },
  handler: async (_ctx, { email }) => {
    const html = customerWelcomeHtml();
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
    const html = onboardingWelcomeHtml(clubName, subscriptionExpiryLabel);
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
    const html = subscriptionReminderHtml(clubName, expiryDate, daysUntil);
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
    const html = subscriptionGracePeriodHtml(clubName, freezeTime);
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
    const html = deletionConfirmationHtml(cancelLink, role);
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
    const html = renewalConfirmationHtml(clubName, newExpiryDate);
    await sendEmail({
      to: email,
      subject: "Subscription renewed — you're all set",
      html,
      text: `Subscription renewed for ${clubName} until ${newExpiryDate}.`,
    });
  },
});

export const sendDataExportEmailWithJson = internalAction({
  args: { email: v.string(), json: v.string(), readableText: v.string() },
  handler: async (_ctx, { email, json, readableText }) => {
    const html = dataExportHtml(readableText);
    const b64 = Buffer.from(json, "utf8").toString("base64");
    await sendEmail({
      to: email,
      subject: "Your A3 Billiards OS data export is ready",
      html,
      text: `${readableText}\n\n---\n\nFull machine-readable export attached as a3-export.json.`,
      attachments: [{ filename: "a3-export.json", content: b64 }],
    });
  },
});
