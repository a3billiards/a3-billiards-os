# Translation review needed

## Completed sections (all 9 locale files: en + 8 non-English)

| Section | Leaf keys (en) | Status |
|---------|----------------|--------|
| `common.*` | 92 | ✅ Complete |
| `errors.*` | 76 | ✅ Complete |
| `notifications.*` | 32 | ✅ Complete |
| `sharedUi.*` | 152 | ✅ Complete |
| `customerApp.*` | 3 | ✅ Complete (audit-gap keys only) |
| `ownerApp.*` | ~900+ | ✅ Full TS surface migrated |
| `customerApp.*` | ~400+ | ✅ Full TS surface migrated |
| `auth.*` | 310 | ✅ Complete (TS + accountBlocked patch) |
| `adminApp.*` | 294 | ✅ Complete (from TS locale modules) |

**en.json total: 2,139 leaf keys** (+1,044 from 1,095 baseline). All 8 non-English files match en key-for-key.

### Migration batch (2026-07-02)
- `migrate-ts-to-json.ts` added 1,037 keys from legacy TS bundles
- `gap-translations/*.json` patched 330 English-fallback keys (ar, kn, ml, te, ta, fr, nl)
- Screen-audit gap keys added: `ownerApp.complaints.existingComplaintsWarning`, `retractModalBody`, `home.staffRoleAccessibility`, `settings.disableTableBodyExtended`, `photoPickerDevBuildBody`, `deleteAccountBodyDetailed`, `financials.perMinEquals`
- `auth.customer.accountBlocked.*` restored after TS sync overwrite

Source merge files: `packages/i18n/locales/_merge/`. Main locale files are the canonical target (not `_merge/` alone).

---

## Keys flagged for native-speaker / product review

### errors.*
- `errors.BOOKING_010` — references internal config key `slotDurationOptions`
- `errors.BOOKING_011` — references internal config key `bookableHours`
- `errors.GOOGLE_AUTH_001` — JWT/Google technical terms; kn/ml/te/ta keep "Audience mismatch" in English
- `errors.OTP_005` — E.164 phone format standard name
- `errors.LIVESTREAM_002` — AWS IVS API product name
- `errors.PUSH_001` — Firebase product name
- `errors.PROMOTE_001` — "Onboarding Website" product name

### common.* (intentional English — do not flag)
- `common.chartMonths.*`, `common.tableTypes.*` — product/proper nouns
- Brand/input tokens: `logoA3`, `pushChannelName`, `confirmKeyword`, `deleteKeyword`

### customerApp.*
- `customerApp.googleAuth.expoGo` — keeps `GOOGLE_AUTH_001` error code prefix and `Expo Go` product name
- `customerApp.googleAuth.missingToken` — keeps `GOOGLE_AUTH_001` and `Google ID token`
- `customerApp.checkInPayload` — technical QR payload format `a3customer:{{userId}}` (unchanged across locales)

### sharedUi.*
- `sharedUi.placeholders.*` — React component names kept in English intentionally
- `sharedUi.liveStreamCard.liveBadge` — kept as `LIVE` intentionally
- `sharedUi.complaintBanner.warning` — emoji prefix `⚠` preserved

### ownerApp.*
- `ownerApp.settings.typeDeleteConfirm` — user must type `DELETE` (backend token)
- `ownerApp.settings.timezonePlaceholder` — `Asia/Kolkata` example kept
- `ownerApp.settings.currencyIso` — `ISO 4217` standard
- `ownerApp.settings.timezoneIana` — `IANA` standard
- `ownerApp.settings.gstinPlaceholder` / `itcNote` — Indian tax acronyms GSTIN/ITC
- `ownerApp.settings.hhmmStart` / `hhmmEnd` — `HH:MM` format labels
- `ownerApp.loyalty.programmeNamePlaceholder` — `A3 Regulars` brand example

### auth.*
- `auth.admin.shell.configErrorBody` — contains `EXPO_PUBLIC_CONVEX_URL`, `support@a3billiards.com`
- `auth.owner.login.googleDeveloperError` — Firebase SHA-1 fingerprint, package name, file names (technical setup instructions)
- `auth.owner.login.googleAuthFailed` — `GOOGLE_WEB_CLIENT_ID` Convex env reference
- `auth.customer.login.invalidPhone` / `auth.customer.register.*` — E.164 format examples (`+91...`)
- `auth.admin.userProfile.promoteWarning` / `demoteWarning` — user must type `CONFIRM`
- `auth.phone.*` — added to non-en from en until root locale TS files define `phone` per language

### adminApp.*
- `adminApp.complaints.dateFormatHint` — `YYYY-MM-DD` format hint
- `adminApp.moderation.forceEndBody` — AWS IVS reference
- `adminApp.notifications.warnNoPush` / `pushNotConfigured` — Firebase setup instructions
- `adminApp.userProfile.promoteWarning` / `demoteWarning` — `CONFIRM` keyword
- `adminApp.userProfile.phonePlaceholder` — E.164 example `+919876543210`

### Screen-audit gap keys (new)
- `ownerApp.settings.photoPickerDevBuildBody` — EAS CLI command kept in English
- `ownerApp.settings.deleteAccountBodyDetailed` — user must type `DELETE`
- `ownerApp.financials.perMinEquals` — format fragment `/min = `
- `ownerApp.complaints.existingComplaintsWarning` — emoji prefix preserved

### gap-translations batch (330 keys × 7 locales)
- Native review recommended for `ownerApp.settings.content` (98 keys) in ar, kn, ml, te, ta, fr, nl
- `ownerApp.slots.*` checkout/group strings translated from hi reference
- `auth.nl.*` and `adminApp.nl.*` were rewritten in Netherlands Dutch (2026-07-02). Native speaker should spot-check formal vs informal tone (`u`/`uw`).

---

## Not yet in JSON locale files

~~Legacy TS bundles still contain additional screen strings~~ **Migrated.** Screen wiring (`t()` calls) is the next step — keys exist in JSON; ~159 hardcoded strings in app source still need wiring (no new keys required except the 7 gap keys above, now added).
