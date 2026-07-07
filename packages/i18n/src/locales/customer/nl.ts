/** Customer-app screen copy (Dutch). */
import { customerEn } from "./en";

export const customerNl = {
  ...customerEn,
  book: {
    ...customerEn.book,
    steps: {
      type: "Type",
      table: "Tafel",
      date: "Datum",
      duration: "Duur",
      time: "Tijd",
      review: "Controleren",
    },
    durations: {
      d30: { chip: "30m", summary: "30 minuten", sub: "Snel potje" },
      d60: { chip: "1u", summary: "1 uur", sub: "Standaard sessie" },
      d90: { chip: "1,5u", summary: "1,5 uur", sub: "Langere sessie" },
      d120: { chip: "2u", summary: "2 uur", sub: "Toernooitraining" },
      d180: { chip: "3u", summary: "3 uur", sub: "Lange sessie" },
      chipFallback: "{{count}}m",
      summaryFallback: "{{count}} minuten",
    },
    errors: {
      booking001: "Je hebt al 2 actieve boekingen bij deze club.",
      booking002:
        "Je hebt al actieve boekingen bij 2 clubs. Rond bestaande boekingen af of annuleer ze voordat je bij een nieuwe club boekt.",
      booking003: "Dit tijdslot is niet meer beschikbaar. Kies een andere tijd.",
      booking004: "Deze club accepteert momenteel geen online boekingen.",
      booking008:
        "De gekozen tijd valt buiten de boekbare uren of het datumbereik van de club.",
      booking009: "Dit tafeltype is niet beschikbaar voor online boekingen.",
      booking010: "Boek minstens {{minutes}} minuten van tevoren.",
      auth002: "Je account is momenteel opgeschort.",
      auth004: "Verifieer je telefoonnummer voordat je boekt.",
      auth006: "Je account staat gepland voor verwijdering.",
      subscription003: "Deze club accepteert momenteel geen online boekingen.",
      payment004: "Ongeldige couponcode. Controleer de code van de club en probeer opnieuw.",
      generic: "Er ging iets mis. Probeer het opnieuw.",
    },
    alerts: {
      timeUnavailableTitle: "Tijd niet beschikbaar",
      timeUnavailableBody:
        "Je gekozen tijd is niet meer beschikbaar voor deze duur. Kies een nieuwe tijd.",
      couponRequiredTitle: "Coupon vereist",
      couponRequiredBody: "Voer de boekingscouponcode van de club in.",
      requestSentTitle: "Boekingsverzoek verzonden!",
      requestSentBody: "Je krijgt een melding zodra de club reageert.",
      requestSentPayBody:
        "Je boekingsverzoek is verzonden. Nadat de club goedkeurt, open Mijn boekingen en tik op Nu betalen om de betaling te voltooien.",
      bookingFailedTitle: "Boeken mislukt",
    },
    payAfterApprovalHint:
      "Betaling wordt geïnd nadat de club je boeking goedkeurt. Je ontvangt een melding wanneer het tijd is om te betalen.",
    missingClub: "Club ontbreekt.",
    onlineBookingUnavailable: "Online boeken is niet beschikbaar bij deze club.",
    goBack: "Ga terug",
    setupIncomplete:
      "Deze club heeft de boekingsinstellingen niet voltooid (openingstijden ontbreken).",
    timesShownIn: "Tijden weergegeven in {{tz}}",
    whichTable: "Welke tafel?",
    noTablesEmpty:
      "Geen actieve tafels voor dit type. Vraag de club om de tafelconfiguratie in Instellingen te controleren.",
    pickDate: "Wanneer wil je spelen?",
    today: "Vandaag",
    noDatesAvailable:
      "Geen boekbare datums beschikbaar. De club moet mogelijk het rooster bijwerken.",
    durationHeading: "Hoe lang wil je spelen?",
    minChargeWarning:
      "Minimale kosten zijn {{minutes}} minuten. Je boeking wordt gefactureerd tegen het {{minutes}}-minutentarief.",
    confirmTitle: "Bevestig je boeking",
    summaryTable: "Tafel",
    summaryTableType: "Tafeltype",
    summaryDate: "Datum",
    summaryTime: "Tijd",
    summaryDuration: "Duur",
    summaryEstimatedCost: "Geschatte kosten",
    estimatedCostValue: "Ca. {{amount}} — werkelijke rekening kan afwijken",
    emDash: "—",
    bookingCoupon: "Boekingscoupon",
    couponHint:
      "Voer de couponcode van de club in om deze boeking te bevestigen (geen kaartbetaling in de app).",
    couponPlaceholder: "Couponcode",
    notesOptional: "Opmerkingen (optioneel)",
    notesPlaceholder: "Voeg een opmerking toe voor de club",
    notesCounter: "{{count}}/200",
    confirmBooking: "Boeking bevestigen",
  },
};
