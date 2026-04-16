import type { Doc } from "../_generated/dataModel";

export function assertClubSubscriptionWritable(club: Doc<"clubs">): void {
  if (club.subscriptionStatus === "frozen") {
    throw new Error(
      "SUBSCRIPTION_003: Your subscription has expired. Renew at https://renew.a3billiards.com to continue.",
    );
  }
}
