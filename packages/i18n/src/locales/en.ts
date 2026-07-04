import { errorMessagesEn } from "./errors";
import type { TranslationBundle } from "./types";

export const en = {
  common: {
    save: "Save",
    cancel: "Cancel",
    loading: "Loading…",
    retry: "Retry",
    close: "Close",
    confirm: "Confirm",
    error: "Error",
    success: "Success",
    yes: "Yes",
    no: "No",
  },
  settings: {
    language: "Language",
    selectLanguage: "Choose language",
    languageHint: "Menus and messages in this app will use your selection.",
  },
  phone: {
    countryCode: "Country code",
    selectCountry: "Select country",
    number: "Phone number",
  },
  tabs: {
    customer: {
      home: "Home",
      discover: "Discover",
      live: "Live",
      bookings: "Bookings",
      history: "History",
      profile: "Profile",
    },
    owner: {
      home: "Home",
      slots: "Slots",
      snacks: "Snacks",
      financials: "Finances",
      complaints: "Complaints",
      bookings: "Bookings",
      documents: "Docs",
      kitchen: "Kitchen",
      loyalty: "Loyalty",
      livestream: "Live",
      settings: "Settings",
    },
    admin: {
      index: "Home",
      users: "Users",
      complaints: "Flags",
      "live-moderation": "Live",
      audit: "Audit",
      notifications: "Alerts",
    },
  },
  profile: {
    title: "Profile",
    memberSince: "Member since {{date}}",
    profileUpdated: "Profile updated.",
    signOut: "Sign out",
    signOutConfirm: "Sign out of your account?",
  },
  streaming: {
    goLive: "Go Live",
    endStream: "End Stream",
    waitingForBroadcaster: "Waiting for broadcaster…",
    streamOffline: "Stream is offline",
    couldNotPlay: "Could not play stream",
    retryPlayback: "Retry",
  },
  config: {
    missingConvexTitle: "Configuration Error",
    missingConvexBody:
      "EXPO_PUBLIC_CONVEX_URL is missing from this build. The app cannot connect to the backend. Please reinstall the latest build or contact support at support@a3billiards.com.",
  },
  subscription: {
    endedTitle: "Subscription Ended",
    endedBody:
      "Your A3 Billiards OS subscription has expired. Renew to restore full access. All your data, settings, and history are intact.",
    renew: "Renew Subscription",
    support: "Questions? Contact support at support@a3billiards.com",
    graceBanner:
      "Your subscription expires soon. Renew now to avoid interruption.",
    graceRenew: "Renew",
  },
  inbox: {
    title: "Notifications",
    subtitle: "Messages from A3 Billiards",
    empty: "No notifications yet.",
    markAllRead: "Mark all read",
    alertView: "View",
    alertLater: "Later",
    fromAdmin: "A3 Billiards",
    bellAccessibility: "Notifications",
    loadMore: "Load more",
  },
  errors: errorMessagesEn,
} satisfies TranslationBundle;

export type { TranslationBundle } from "./types";
