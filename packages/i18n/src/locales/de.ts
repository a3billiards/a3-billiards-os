import type { TranslationBundle } from "./types";

export const de: TranslationBundle = {
  common: {
    save: "Speichern",
    cancel: "Abbrechen",
    loading: "Wird geladen…",
    retry: "Erneut versuchen",
    close: "Schließen",
    confirm: "Bestätigen",
    error: "Fehler",
    success: "Erfolg",
    yes: "Ja",
    no: "Nein",
  },
  settings: {
    language: "Sprache",
    selectLanguage: "Sprache wählen",
    languageHint:
      "Menüs und Meldungen in dieser App werden in der gewählten Sprache angezeigt.",
  },
  tabs: {
    customer: {
      home: "Start",
      discover: "Entdecken",
      live: "Live",
      bookings: "Buchungen",
      history: "Verlauf",
      profile: "Profil",
    },
    owner: {
      home: "Start",
      slots: "Tische",
      snacks: "Snacks",
      financials: "Finanzen",
      complaints: "Beschwerden",
      bookings: "Buchungen",
      documents: "Dokumente",
      kitchen: "Küche",
      loyalty: "Treue",
      livestream: "Live",
      settings: "Einstellungen",
    },
    admin: {
      index: "Start",
      users: "Benutzer",
      complaints: "Meldungen",
      "live-moderation": "Live",
      audit: "Audit",
      notifications: "Hinweise",
    },
  },
  profile: {
    title: "Profil",
    memberSince: "Mitglied seit {{date}}",
    profileUpdated: "Profil aktualisiert.",
    signOut: "Abmelden",
    signOutConfirm: "Von Ihrem Konto abmelden?",
  },
  streaming: {
    goLive: "Live gehen",
    endStream: "Stream beenden",
    waitingForBroadcaster: "Warte auf Sender…",
    streamOffline: "Stream offline",
    couldNotPlay: "Stream konnte nicht abgespielt werden",
    retryPlayback: "Erneut versuchen",
  },
  config: {
    missingConvexTitle: "Konfigurationsfehler",
    missingConvexBody:
      "EXPO_PUBLIC_CONVEX_URL fehlt in diesem Build. Die App kann keine Verbindung zum Backend herstellen. Bitte installieren Sie den neuesten Build neu oder kontaktieren Sie support@a3billiards.com.",
  },
  subscription: {
    endedTitle: "Abonnement beendet",
    endedBody:
      "Ihr A3 Billiards OS-Abonnement ist abgelaufen. Erneuern Sie es für vollen Zugriff. Ihre Daten, Einstellungen und der Verlauf bleiben erhalten.",
    renew: "Abonnement erneuern",
    support: "Fragen? Kontaktieren Sie support@a3billiards.com",
    graceBanner:
      "Ihr Abonnement läuft bald ab. Erneuern Sie jetzt, um Unterbrechungen zu vermeiden.",
    graceRenew: "Erneuern",
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
};
