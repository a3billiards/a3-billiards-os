import { Linking, Platform } from "react-native";

export type ClubNavigationTarget = {
  lat?: number | null;
  lng?: number | null;
  address?: string;
  label?: string;
};

function isValidCoord(lat?: number | null, lng?: number | null): boolean {
  return (
    lat != null &&
    lng != null &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    !(lat === 0 && lng === 0)
  );
}

function buildNavigationUrls(target: ClubNavigationTarget): string[] {
  const { lat, lng, address, label } = target;
  const name = label?.trim() || "Club";

  if (isValidCoord(lat, lng)) {
    const coords = `${lat},${lng}`;
    if (Platform.OS === "ios") {
      return [
        `http://maps.apple.com/?daddr=${coords}&dirflg=d`,
        `comgooglemaps://?daddr=${coords}&directionsmode=driving`,
        `https://www.google.com/maps/dir/?api=1&destination=${coords}`,
      ];
    }
    if (Platform.OS === "android") {
      return [
        `google.navigation:q=${coords}`,
        `geo:0,0?q=${coords}(${encodeURIComponent(name)})`,
        `https://www.google.com/maps/dir/?api=1&destination=${coords}`,
      ];
    }
    return [`https://www.google.com/maps/dir/?api=1&destination=${coords}`];
  }

  const query = address?.trim();
  if (!query) return [];

  const encoded = encodeURIComponent(query);
  if (Platform.OS === "ios") {
    return [
      `http://maps.apple.com/?daddr=${encoded}&dirflg=d`,
      `comgooglemaps://?daddr=${encoded}&directionsmode=driving`,
      `https://www.google.com/maps/dir/?api=1&destination=${encoded}`,
    ];
  }
  if (Platform.OS === "android") {
    return [
      `google.navigation:q=${encoded}`,
      `https://www.google.com/maps/dir/?api=1&destination=${encoded}`,
    ];
  }
  return [`https://www.google.com/maps/dir/?api=1&destination=${encoded}`];
}

export function canNavigateToClub(target: ClubNavigationTarget): boolean {
  return isValidCoord(target.lat, target.lng) || Boolean(target.address?.trim());
}

export async function openClubNavigation(target: ClubNavigationTarget): Promise<boolean> {
  const urls = buildNavigationUrls(target);
  if (urls.length === 0) return false;

  for (const url of urls) {
    try {
      if (await Linking.canOpenURL(url)) {
        await Linking.openURL(url);
        return true;
      }
    } catch {
      // try next scheme
    }
  }

  const fallback = urls[urls.length - 1];
  try {
    await Linking.openURL(fallback);
    return true;
  } catch {
    return false;
  }
}
