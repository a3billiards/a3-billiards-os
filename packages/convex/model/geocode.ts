/** Shared address → WGS84 helpers for onboarding and discovery. */

import { assertTrimmedLength, MAX_ADDRESS_LEN } from "./inputValidation";

export function isValidGeocodeLocation(location: {
  lat: number;
  lng: number;
}): boolean {
  if (!Number.isFinite(location.lat) || !Number.isFinite(location.lng)) {
    return false;
  }
  if (location.lat === 0 && location.lng === 0) return false;
  if (location.lat < -90 || location.lat > 90) return false;
  if (location.lng < -180 || location.lng > 180) return false;
  return true;
}

function normalizeAddressQuery(address: string): string {
  const trimmed = address.trim();
  if (!trimmed) return trimmed;
  if (/\bindia\b/i.test(trimmed)) return trimmed;
  return `${trimmed}, India`;
}

async function geocodeWithNominatim(
  address: string,
): Promise<{ lat: number; lng: number } | null> {
  const q = encodeURIComponent(normalizeAddressQuery(address));
  const url = `https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=1`;
  const res = await fetch(url, {
    headers: {
      "User-Agent": "A3BilliardsOS/1.0 (club-onboarding; support@a3billiards.com)",
      Accept: "application/json",
    },
  });
  if (!res.ok) return null;

  const data = (await res.json()) as { lat?: string; lon?: string }[];
  const hit = data[0];
  if (!hit?.lat || !hit.lon) return null;

  const lat = Number(hit.lat);
  const lng = Number(hit.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
}

async function geocodeWithGoogle(
  address: string,
  apiKey: string,
): Promise<{ lat: number; lng: number } | null> {
  const q = encodeURIComponent(normalizeAddressQuery(address));
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${q}&key=${apiKey}`;
  const res = await fetch(url);
  if (!res.ok) return null;

  const data = (await res.json()) as {
    status?: string;
    error_message?: string;
    results?: { geometry?: { location?: { lat: number; lng: number } } }[];
  };

  if (data.status !== "OK" || !data.results?.[0]?.geometry?.location) {
    console.warn(
      "Google geocode failed:",
      data.status ?? "unknown",
      data.error_message ?? "",
    );
    return null;
  }

  const loc = data.results[0].geometry.location;
  return { lat: loc.lat, lng: loc.lng };
}

/**
 * Resolve a postal address to coordinates.
 * Uses OpenStreetMap Nominatim first (no API key), then optional Google Geocoding fallback.
 */
export async function geocodeAddress(address: string): Promise<{
  lat: number;
  lng: number;
  provider: "nominatim" | "google";
}> {
  const trimmed = assertTrimmedLength(
    "Address",
    address,
    5,
    MAX_ADDRESS_LEN,
  );

  const nominatim = await geocodeWithNominatim(trimmed);
  if (nominatim && isValidGeocodeLocation(nominatim)) {
    return { ...nominatim, provider: "nominatim" };
  }

  const googleKey = process.env.GOOGLE_MAPS_API_KEY?.trim();
  if (googleKey) {
    const google = await geocodeWithGoogle(trimmed, googleKey);
    if (google && isValidGeocodeLocation(google)) {
      return { ...google, provider: "google" };
    }
  }

  throw new Error(
    "DATA_001: Could not locate this address. Check spelling and include city/state, then try again.",
  );
}
