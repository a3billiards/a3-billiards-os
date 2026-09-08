/** Plain HTML transactional emails — avoids @react-email in the Convex bundle. */

const BG = "#0D1117";
const FG = "#F0F6FC";
const MUTED = "#8b949e";
const ACCENT = "#43A047";

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function layout(title: string, bodyHtml: string): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>${escapeHtml(title)}</title></head>
<body style="background-color:${BG};font-family:system-ui,sans-serif;margin:0;padding:24px;">
  <div style="max-width:560px;margin:0 auto;">
    <h1 style="color:${FG};font-size:22px;margin:0 0 16px;">${escapeHtml(title)}</h1>
    ${bodyHtml}
  </div>
</body>
</html>`;
}

function button(href: string, label: string): string {
  const safeHref = escapeHtml(href);
  return `<p style="margin:16px 0;">
  <a href="${safeHref}" style="background-color:${ACCENT};color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block;">${escapeHtml(label)}</a>
</p>
<p style="color:${MUTED};font-size:12px;line-height:1.5;">Plain link: <a href="${safeHref}" style="color:${MUTED};">${safeHref}</a></p>`;
}

function paragraph(text: string): string {
  return `<p style="color:${FG};font-size:15px;line-height:1.6;">${escapeHtml(text)}</p>`;
}

function muted(text: string): string {
  return `<p style="color:${MUTED};font-size:13px;line-height:1.5;">${escapeHtml(text)}</p>`;
}

export function passwordResetHtml(resetLink: string): string {
  return layout(
    "Reset Your Password",
    `${paragraph("Click the button below to set a new password. This link expires in 1 hour and can only be used once.")}
${button(resetLink, "Reset Password")}
<hr style="border-color:#30363d;margin:24px 0;" />
${muted("If you didn't request this, you can safely ignore this email.")}`,
  );
}

export function passcodeResetHtml(resetLink: string): string {
  return layout(
    "Reset Your Settings PIN",
    `${paragraph("Use the link below to reset your settings PIN.")}
${button(resetLink, "Reset PIN")}`,
  );
}

export function mfaCodeHtml(code: string): string {
  return layout(
    "Verification Code",
    `${paragraph(`Your verification code is ${code}. It expires in 10 minutes.`)}
<p style="color:${FG};font-size:28px;font-weight:700;letter-spacing:4px;margin:16px 0;">${escapeHtml(code)}</p>`,
  );
}

export function ownerEmailVerificationHtml(code: string): string {
  return layout(
    "Verify Your Owner Email",
    `${paragraph("Enter this code in the owner app to verify your email address.")}
<p style="color:${FG};font-size:28px;font-weight:700;letter-spacing:4px;margin:16px 0;">${escapeHtml(code)}</p>
${muted("This code expires in 10 minutes.")}`,
  );
}

export function customerWelcomeHtml(): string {
  return layout(
    "Welcome to A3 Billiards OS",
    `${paragraph("Your account is ready. Open the customer app to discover clubs, book tables, and watch live games.")}
${button("https://links.a3billiards.com/customer/home", "Open Customer App")}`,
  );
}

export function onboardingWelcomeHtml(
  clubName: string,
  subscriptionExpiryLabel: string,
): string {
  return layout(
    "Your Club Is Live",
    `${paragraph(`Your club "${clubName}" is now live on A3 Billiards OS.`)}
${paragraph(`Subscription active through ${subscriptionExpiryLabel}.`)}
${button("https://links.a3billiards.com/owner/home", "Open Owner App")}`,
  );
}

export function subscriptionReminderHtml(
  clubName: string,
  expiryDate: string,
  daysUntil: number,
): string {
  const dayLabel = daysUntil === 1 ? "1 day" : `${daysUntil} days`;
  return layout(
    "Subscription Renewal Reminder",
    `${paragraph(`Your subscription for ${clubName} expires on ${expiryDate} (${dayLabel} from now).`)}
${button("https://register.a3billiards.com/renew", "Renew Subscription")}`,
  );
}

export function subscriptionGracePeriodHtml(clubName: string, freezeTime: string): string {
  return layout(
    "Subscription Expired",
    `${paragraph(`Your subscription for ${clubName} has expired.`)}
${paragraph(`Access will end after ${freezeTime} unless you renew.`)}
${button("https://register.a3billiards.com/renew", "Renew Now")}`,
  );
}

export function deletionConfirmationHtml(cancelLink: string, role: string): string {
  if (role === "customer") {
    return layout(
      "Account Deletion Confirmed",
      `${paragraph("Your A3 Billiards account deletion request has been confirmed.")}
${paragraph("Your account has been signed out and your data will be permanently deleted. This action cannot be undone.")}
${paragraph("If you believe this was a mistake, tap the button below to cancel within 24 hours.")}
${button(cancelLink, "Cancel Deletion")}`,
    );
  }
  // Owner: keep cancel link since they may have pending bookings
  return layout(
    "Account Deletion Scheduled",
    `${paragraph(`Your ${role} account deletion has been scheduled.`)}
${paragraph("You can cancel this request using the link below.")}
${button(cancelLink, "Cancel Deletion")}`,
  );
}

export function renewalConfirmationHtml(clubName: string, newExpiryDate: string): string {
  return layout(
    "Subscription Renewed",
    `${paragraph(`Your subscription for ${clubName} has been renewed.`)}
${paragraph(`New expiry date: ${newExpiryDate}.`)}`,
  );
}

export function dataExportHtml(summary: string): string {
  return layout(
    "Your Data Export",
    `${paragraph("Your data export is attached as a CSV file.")}
<pre style="color:${FG};font-size:13px;line-height:1.5;white-space:pre-wrap;background:#161b22;padding:16px;border-radius:8px;">${escapeHtml(summary)}</pre>`,
  );
}
