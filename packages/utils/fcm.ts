/** FCM notification type definitions and client helpers. TDD §2.1 */
 
export type FcmNotificationType =
  | "NEW_BOOKING_REQUEST" | "BOOKING_EXPIRED_OWNER" | "CREDIT_SESSION_PENDING"
  | "SESSION_TIMER_ALERT" | "SUBSCRIPTION_GRACE_STARTED" | "SUBSCRIPTION_FROZEN"
  | "SUBSCRIPTION_RENEWED" | "BOOKING_APPROVED" | "BOOKING_REJECTED"
  | "BOOKING_CANCELLED_BY_OWNER" | "BOOKING_EXPIRY_WARNING"
  | "SESSION_STARTED" | "SESSION_ENDED" | "NEW_COMPLAINT" | "ADMIN_BROADCAST";
 
export interface FcmPayload {
  type: FcmNotificationType;
  deepLink?: string;
  [key: string]: string | undefined;
}
 
/** Parse deep link from FCM notification data. Used in cold-start handler. */
export function parseDeepLink(data: Record<string, string>): string | null {
  return data?.deepLink ?? null;
}
 
export function notificationTitle(type: FcmNotificationType): string {
  const titles: Record<FcmNotificationType, string> = {
    NEW_BOOKING_REQUEST: "New Booking Request",
    BOOKING_EXPIRED_OWNER: "Booking Approval Expired",
    CREDIT_SESSION_PENDING: "Credit Payment Pending",
    SESSION_TIMER_ALERT: "Session Timer Alert",
    SUBSCRIPTION_GRACE_STARTED: "Subscription Expiring Soon",
    SUBSCRIPTION_FROZEN: "Account Frozen",
    SUBSCRIPTION_RENEWED: "Subscription Renewed",
    BOOKING_APPROVED: "Booking Approved",
    BOOKING_REJECTED: "Booking Rejected",
    BOOKING_CANCELLED_BY_OWNER: "Booking Cancelled",
    BOOKING_EXPIRY_WARNING: "Booking Expiring Soon",
    SESSION_STARTED: "Session Started",
    SESSION_ENDED: "Session Ended",
    NEW_COMPLAINT: "New Customer Complaint",
    ADMIN_BROADCAST: "Platform Announcement",
  };
  return titles[type] ?? "Notification";
}
 
const HIGH_PRIORITY_ARRAY: FcmNotificationType[] = [
    "NEW_BOOKING_REQUEST",
    "BOOKING_APPROVED",
    "BOOKING_REJECTED",
    "SESSION_TIMER_ALERT",
    "SUBSCRIPTION_FROZEN",
    "NEW_COMPLAINT",
  ];
  export const HIGH_PRIORITY_TYPES = new Set<FcmNotificationType>(HIGH_PRIORITY_ARRAY);