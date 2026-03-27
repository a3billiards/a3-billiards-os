/** PostHog analytics helpers. TDD §2.1. Stubs for Phase 9 integration. */
 // React Native global — declared here for non-RN TypeScript context
declare const __DEV__: boolean;
export type AnalyticsEvent =
  | "login_success" | "login_failed" | "signup_started" | "signup_completed"
  | "google_signin_success" | "google_signin_failed" | "logout"
  | "discover_search" | "club_profile_viewed"
  | "booking_started" | "booking_date_selected" | "booking_table_type_selected"
  | "booking_slot_selected" | "booking_submitted"
  | "booking_approved" | "booking_rejected"
  | "booking_cancelled_by_customer" | "booking_cancelled_by_owner"
  | "booking_stale_warning_shown"
  | "session_started" | "session_ended" | "session_cancelled"
  | "snack_added" | "discount_applied"
  | "subscription_renewed" | "subscription_grace_started" | "subscription_frozen"
  | "error_shown";
 
export type EventProperties = Record<string, string | number | boolean | null | undefined>;
 
/** Track an event. TODO Phase 9: PostHog.capture(event, properties) */
export function track(event: AnalyticsEvent, properties?: EventProperties): void {
  if (__DEV__) console.log("[Analytics]", event, properties);
}
 
/** Identify user after login. TODO Phase 9: PostHog.identify(userId, traits) */
export function identify(userId: string, traits?: EventProperties): void {
  if (__DEV__) console.log("[Analytics] identify", userId, traits);
}
 
/** Reset identity on logout. TODO Phase 9: PostHog.reset() */
export function reset(): void {
  if (__DEV__) console.log("[Analytics] reset");
}
 
/** Screen view tracking — call in each screen useFocusEffect. */
export function screen(name: string, properties?: EventProperties): void {
  if (__DEV__) console.log("[Analytics] screen", name, properties);
}