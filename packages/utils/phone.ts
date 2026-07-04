/** E.164: + followed by 7–15 digits (first digit after + is non-zero). */
export const E164_REGEX = /^\+[1-9]\d{6,14}$/;

export const DEFAULT_DIAL_CODE = "+91";

/** Initial value for phone fields — dial code only until the user types digits. */
export const DEFAULT_PHONE_E164 = DEFAULT_DIAL_CODE;

export type PhoneCountryOption = {
  iso: string;
  name: string;
  dialCode: string;
  /** Example local number (no country code). */
  placeholder: string;
  /** Max national digits (soft limit in UI). */
  maxLength: number;
};

/** India first, then other common markets alphabetically. */
export const PHONE_COUNTRY_OPTIONS: readonly PhoneCountryOption[] = [
  { iso: "IN", name: "India", dialCode: "+91", placeholder: "9876543210", maxLength: 10 },
  { iso: "AE", name: "United Arab Emirates", dialCode: "+971", placeholder: "501234567", maxLength: 9 },
  { iso: "AU", name: "Australia", dialCode: "+61", placeholder: "412345678", maxLength: 9 },
  { iso: "BH", name: "Bahrain", dialCode: "+973", placeholder: "36001234", maxLength: 8 },
  { iso: "BD", name: "Bangladesh", dialCode: "+880", placeholder: "1712345678", maxLength: 10 },
  { iso: "CA", name: "Canada", dialCode: "+1", placeholder: "4165550123", maxLength: 10 },
  { iso: "CN", name: "China", dialCode: "+86", placeholder: "13123456789", maxLength: 11 },
  { iso: "FR", name: "France", dialCode: "+33", placeholder: "612345678", maxLength: 9 },
  { iso: "DE", name: "Germany", dialCode: "+49", placeholder: "15123456789", maxLength: 11 },
  { iso: "HK", name: "Hong Kong", dialCode: "+852", placeholder: "51234567", maxLength: 8 },
  { iso: "ID", name: "Indonesia", dialCode: "+62", placeholder: "8123456789", maxLength: 11 },
  { iso: "JP", name: "Japan", dialCode: "+81", placeholder: "9012345678", maxLength: 10 },
  { iso: "KW", name: "Kuwait", dialCode: "+965", placeholder: "50123456", maxLength: 8 },
  { iso: "MY", name: "Malaysia", dialCode: "+60", placeholder: "123456789", maxLength: 10 },
  { iso: "NP", name: "Nepal", dialCode: "+977", placeholder: "9812345678", maxLength: 10 },
  { iso: "NL", name: "Netherlands", dialCode: "+31", placeholder: "612345678", maxLength: 9 },
  { iso: "OM", name: "Oman", dialCode: "+968", placeholder: "92123456", maxLength: 8 },
  { iso: "PK", name: "Pakistan", dialCode: "+92", placeholder: "3012345678", maxLength: 10 },
  { iso: "PH", name: "Philippines", dialCode: "+63", placeholder: "9123456789", maxLength: 10 },
  { iso: "QA", name: "Qatar", dialCode: "+974", placeholder: "33123456", maxLength: 8 },
  { iso: "SA", name: "Saudi Arabia", dialCode: "+966", placeholder: "512345678", maxLength: 9 },
  { iso: "SG", name: "Singapore", dialCode: "+65", placeholder: "81234567", maxLength: 8 },
  { iso: "ZA", name: "South Africa", dialCode: "+27", placeholder: "821234567", maxLength: 9 },
  { iso: "LK", name: "Sri Lanka", dialCode: "+94", placeholder: "712345678", maxLength: 9 },
  { iso: "CH", name: "Switzerland", dialCode: "+41", placeholder: "791234567", maxLength: 9 },
  { iso: "TH", name: "Thailand", dialCode: "+66", placeholder: "812345678", maxLength: 9 },
  { iso: "GB", name: "United Kingdom", dialCode: "+44", placeholder: "7911123456", maxLength: 10 },
  { iso: "US", name: "United States", dialCode: "+1", placeholder: "4155550123", maxLength: 10 },
  { iso: "VN", name: "Vietnam", dialCode: "+84", placeholder: "912345678", maxLength: 9 },
] as const;

const DIAL_CODES_LONGEST_FIRST = [...PHONE_COUNTRY_OPTIONS]
  .map((c) => c.dialCode)
  .sort((a, b) => b.length - a.length);

export function findCountryByDialCode(dialCode: string): PhoneCountryOption {
  return (
    PHONE_COUNTRY_OPTIONS.find((c) => c.dialCode === dialCode) ??
    PHONE_COUNTRY_OPTIONS[0]
  );
}

export function parsePhoneParts(raw: string): {
  dialCode: string;
  national: string;
  country: PhoneCountryOption;
} {
  const compact = raw.replace(/\s/g, "");
  if (!compact || compact === "+") {
    const country = findCountryByDialCode(DEFAULT_DIAL_CODE);
    return { dialCode: country.dialCode, national: "", country };
  }

  for (const dialCode of DIAL_CODES_LONGEST_FIRST) {
    if (compact.startsWith(dialCode)) {
      const national = compact.slice(dialCode.length).replace(/\D/g, "");
      return {
        dialCode,
        national,
        country: findCountryByDialCode(dialCode),
      };
    }
  }

  const digits = compact.replace(/\D/g, "");
  const country = findCountryByDialCode(DEFAULT_DIAL_CODE);
  if (compact.startsWith("+")) {
    return { dialCode: country.dialCode, national: digits, country };
  }
  return { dialCode: country.dialCode, national: digits, country };
}

export function composeE164(dialCode: string, nationalDigits: string): string {
  const digits = nationalDigits.replace(/\D/g, "");
  if (digits.length === 0) return dialCode;
  return `${dialCode}${digits}`;
}

export function isValidE164(value: string): boolean {
  return E164_REGEX.test(value.replace(/\s/g, ""));
}

export function isValidIndiaE164(value: string): boolean {
  return /^\+91\d{10}$/.test(value.replace(/\s/g, ""));
}

export function normalizeE164(value: string): string {
  return value.replace(/\s/g, "");
}
