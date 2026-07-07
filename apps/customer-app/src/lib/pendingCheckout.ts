/** In-memory checkout URL handoff (avoids oversized expo-router params). */
let pendingCheckoutUrl: string | null = null;

export function setPendingCheckoutUrl(url: string): void {
  pendingCheckoutUrl = url;
}

export function consumePendingCheckoutUrl(): string | null {
  const url = pendingCheckoutUrl;
  pendingCheckoutUrl = null;
  return url;
}
