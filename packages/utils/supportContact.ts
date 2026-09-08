/** Platform customer-care contact — single source for apps and mailto links. */
export const SUPPORT_EMAIL = "support@a3billiards.com";

export const SUPPORT_CATEGORIES = [
  "account",
  "booking",
  "payment",
  "subscription",
  "technical",
  "other",
] as const;

export type SupportCategory = (typeof SUPPORT_CATEGORIES)[number];

export const CUSTOMER_FAQ_IDS = [
  "discoverBook",
  "payBooking",
  "cancelBooking",
  "sessionHistory",
  "liveStreams",
  "accountFrozen",
  "changePhone",
  "notifications",
] as const;

export type CustomerFaqId = (typeof CUSTOMER_FAQ_IDS)[number];

export const OWNER_FAQ_IDS = [
  "subscription",
  "walkInSessions",
  "onlineBooking",
  "staffRoles",
  "liveStream",
  "gstReport",
  "complaintsFlags",
  "dataExport",
] as const;

export type OwnerFaqId = (typeof OWNER_FAQ_IDS)[number];

export function buildSupportMailtoUrl(options?: {
  subject?: string;
  body?: string;
}): string {
  const params = new URLSearchParams();
  if (options?.subject) params.set("subject", options.subject);
  if (options?.body) params.set("body", options.body);
  const qs = params.toString();
  return qs ? `mailto:${SUPPORT_EMAIL}?${qs}` : `mailto:${SUPPORT_EMAIL}`;
}
