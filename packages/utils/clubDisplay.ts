const AMENITY_I18N_KEYS: Record<string, string> = {  AC: "common.amenityPresets.ac",
  Parking: "common.amenityPresets.parking",
  Cafe: "common.amenityPresets.cafe",
  WiFi: "common.amenityPresets.wifi",
  Lounge: "common.amenityPresets.lounge",
  Restrooms: "common.amenityPresets.restrooms",
};

const TABLE_TYPE_I18N_KEYS: Record<string, string> = {
  american: "common.tableTypes.americanPool",
  french: "common.tableTypes.frenchBilliards",
  snooker: "common.tableTypes.snooker",
  "8-ball": "common.tableTypes.eightBall",
  "9-ball": "common.tableTypes.nineBall",
};

function normalizeTableTypeKey(type: string): string {
  return type.trim().toLowerCase().replace(/\s+/g, "-");
}

export function localizedAmenityLabel(
  amenity: string,
  t: (key: string) => string,
): string {
  const key = AMENITY_I18N_KEYS[amenity];
  return key ? t(key) : amenity;
}

export function localizedTableTypeLabel(
  type: string,
  t: (key: string) => string,
): string {
  const key = TABLE_TYPE_I18N_KEYS[normalizeTableTypeKey(type)];
  return key ? t(key) : type;
}

export function formatHhmm12h(hhmm: string, locale: string): string {
  const [hStr, mStr] = hhmm.split(":");
  const h = Number(hStr);
  const m = Number(mStr);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return hhmm;
  const d = new Date(2000, 0, 1, h, m);
  return new Intl.DateTimeFormat(locale, {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(d);
}
