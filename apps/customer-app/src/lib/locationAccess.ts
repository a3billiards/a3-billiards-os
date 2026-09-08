type LocationModule = typeof import("expo-location");

let cached: LocationModule | null | undefined;

/** Load expo-location lazily so missing native module does not break route registration. */
export async function loadLocationModule(): Promise<LocationModule | null> {
  if (cached !== undefined) return cached;
  try {
    cached = await import("expo-location");
    return cached;
  } catch {
    cached = null;
    return null;
  }
}

export type LocationPermission = "granted" | "denied" | "undetermined" | null;

export async function readForegroundLocationPermission(): Promise<LocationPermission> {
  const Location = await loadLocationModule();
  if (!Location) return "denied";
  try {
    const current = await Location.getForegroundPermissionsAsync();
    return current.status;
  } catch {
    return "denied";
  }
}

export async function requestForegroundLocationPermission(): Promise<LocationPermission> {
  const Location = await loadLocationModule();
  if (!Location) return "denied";
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    return status;
  } catch {
    return "denied";
  }
}

export async function getCurrentCoords(): Promise<{ lat: number; lng: number } | null> {
  const Location = await loadLocationModule();
  if (!Location) return null;
  try {
    const last = await Location.getLastKnownPositionAsync({});
    if (last?.coords) {
      return { lat: last.coords.latitude, lng: last.coords.longitude };
    }
    const pos = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    return { lat: pos.coords.latitude, lng: pos.coords.longitude };
  } catch {
    return null;
  }
}
