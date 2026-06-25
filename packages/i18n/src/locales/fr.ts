import type { TranslationBundle } from "./types";

export const fr: TranslationBundle = {
  common: {
    save: "Enregistrer",
    cancel: "Annuler",
    loading: "Chargement…",
    retry: "Réessayer",
    close: "Fermer",
    confirm: "Confirmer",
    error: "Erreur",
    success: "Succès",
    yes: "Oui",
    no: "Non",
  },
  settings: {
    language: "Langue",
    selectLanguage: "Choisir la langue",
    languageHint:
      "Les menus et messages de cette application s'afficheront dans la langue choisie.",
  },
  tabs: {
    customer: {
      home: "Accueil",
      discover: "Découvrir",
      live: "Direct",
      bookings: "Réservations",
      history: "Historique",
      profile: "Profil",
    },
    owner: {
      home: "Accueil",
      slots: "Tables",
      snacks: "Snacks",
      financials: "Finances",
      complaints: "Réclamations",
      bookings: "Réservations",
      documents: "Docs",
      kitchen: "Cuisine",
      loyalty: "Fidélité",
      livestream: "Direct",
      settings: "Paramètres",
    },
    admin: {
      index: "Accueil",
      users: "Utilisateurs",
      complaints: "Signalements",
      "live-moderation": "Direct",
      audit: "Audit",
      notifications: "Alertes",
    },
  },
  profile: {
    title: "Profil",
    memberSince: "Membre depuis {{date}}",
    profileUpdated: "Profil mis à jour.",
    signOut: "Se déconnecter",
    signOutConfirm: "Se déconnecter de votre compte ?",
  },
  streaming: {
    goLive: "Passer en direct",
    endStream: "Terminer le direct",
    waitingForBroadcaster: "En attente du diffuseur…",
    streamOffline: "Diffusion hors ligne",
    couldNotPlay: "Impossible de lire le flux",
    retryPlayback: "Réessayer",
  },
  config: {
    missingConvexTitle: "Erreur de configuration",
    missingConvexBody:
      "EXPO_PUBLIC_CONVEX_URL est absent de cette version. L'application ne peut pas se connecter au serveur. Réinstallez la dernière version ou contactez support@a3billiards.com.",
  },
  subscription: {
    endedTitle: "Abonnement expiré",
    endedBody:
      "Votre abonnement A3 Billiards OS a expiré. Renouvelez pour retrouver l'accès complet. Vos données, paramètres et historique sont intacts.",
    renew: "Renouveler l'abonnement",
    support: "Des questions ? Contactez support@a3billiards.com",
    graceBanner:
      "Votre abonnement expire bientôt. Renouvelez maintenant pour éviter une interruption.",
    graceRenew: "Renouveler",
  },
};
