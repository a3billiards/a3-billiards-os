import type { errorMessagesEn } from "../errors";

type StringRecord<T> = {
  [K in keyof T]: T[K] extends string ? string : never;
};

export type ErrorMessages = typeof errorMessagesEn;

/** Shape shared by all locale resource files (values are localized strings). */
export interface TranslationBundle {
  common: StringRecord<{
    save: string;
    cancel: string;
    loading: string;
    retry: string;
    close: string;
    confirm: string;
    error: string;
    success: string;
    yes: string;
    no: string;
  }>;
  settings: StringRecord<{
    language: string;
    selectLanguage: string;
    languageHint: string;
  }>;
  tabs: {
    customer: StringRecord<{
      home: string;
      discover: string;
      live: string;
      bookings: string;
      history: string;
      profile: string;
    }>;
    owner: StringRecord<{
      home: string;
      slots: string;
      snacks: string;
      financials: string;
      complaints: string;
      bookings: string;
      documents: string;
      kitchen: string;
      loyalty: string;
      livestream: string;
      settings: string;
    }>;
    admin: StringRecord<{
      index: string;
      users: string;
      complaints: string;
      "live-moderation": string;
      audit: string;
      notifications: string;
    }>;
  };
  profile: StringRecord<{
    title: string;
    memberSince: string;
    profileUpdated: string;
    signOut: string;
    signOutConfirm: string;
  }>;
  streaming: StringRecord<{
    goLive: string;
    endStream: string;
    waitingForBroadcaster: string;
    streamOffline: string;
    couldNotPlay: string;
    retryPlayback: string;
  }>;
  config: StringRecord<{
    missingConvexTitle: string;
    missingConvexBody: string;
  }>;
  subscription: StringRecord<{
    endedTitle: string;
    endedBody: string;
    renew: string;
    support: string;
    graceBanner: string;
    graceRenew: string;
  }>;
  errors?: Partial<ErrorMessages>;
}
