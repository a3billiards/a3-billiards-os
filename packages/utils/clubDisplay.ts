const AMENITY_I18N_KEYS: Record<string, string> = {
  ac: "common.amenityPresets.ac",
  "air conditioning": "common.amenityPresets.ac",
  "air-conditioning": "common.amenityPresets.ac",
  parking: "common.amenityPresets.parking",
  cafe: "common.amenityPresets.cafe",
  café: "common.amenityPresets.cafe",
  wifi: "common.amenityPresets.wifi",
  "wi-fi": "common.amenityPresets.wifi",
  lounge: "common.amenityPresets.lounge",
  restrooms: "common.amenityPresets.restrooms",
  restroom: "common.amenityPresets.restrooms",
  washroom: "common.amenityPresets.restrooms",
  washrooms: "common.amenityPresets.restrooms",
};

const TABLE_TYPE_I18N_KEYS: Record<string, string> = {
  american: "common.tableTypes.americanPool",
  "american-pool": "common.tableTypes.americanPool",
  "american pool": "common.tableTypes.americanPool",
  french: "common.tableTypes.frenchBilliards",
  "french-billiards": "common.tableTypes.frenchBilliards",
  "french billiards": "common.tableTypes.frenchBilliards",
  snooker: "common.tableTypes.snooker",
  "8-ball": "common.tableTypes.eightBall",
  "8ball": "common.tableTypes.eightBall",
  "eight-ball": "common.tableTypes.eightBall",
  "eight ball": "common.tableTypes.eightBall",
  "9-ball": "common.tableTypes.nineBall",
  "9ball": "common.tableTypes.nineBall",
  "nine-ball": "common.tableTypes.nineBall",
  "nine ball": "common.tableTypes.nineBall",
};

function normalizeKey(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function normalizeTableTypeKey(type: string): string {
  return type.trim().toLowerCase().replace(/\s+/g, "-");
}

export function localizedAmenityLabel(
  amenity: string,
  t: (key: string) => string,
): string {
  const key =
    AMENITY_I18N_KEYS[normalizeKey(amenity)] ??
    AMENITY_I18N_KEYS[amenity.trim()];
  return key ? t(key) : amenity;
}

export function localizedTableTypeLabel(
  type: string,
  t: (key: string) => string,
): string {
  const normalized = normalizeTableTypeKey(type);
  const spaced = normalizeKey(type);
  const key =
    TABLE_TYPE_I18N_KEYS[normalized] ??
    TABLE_TYPE_I18N_KEYS[spaced] ??
    TABLE_TYPE_I18N_KEYS[type.trim().toLowerCase()];
  return key ? t(key) : type;
}

export function formatHhmm12h(hhmm: string, locale: string): string {
  const [hStr, mStr] = hhmm.split(":");
  const h = Number(hStr);
  const m = Number(mStr);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return hhmm;
  const d = new Date(2000, 0, 1, h, m);
  try {
    return new Intl.DateTimeFormat(locale || "en", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }).format(d);
  } catch {
    return hhmm;
  }
}
