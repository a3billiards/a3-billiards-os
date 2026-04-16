import * as SecureStore from "expo-secure-store";

/** Canonical key per TDD; legacy key still read for migration. */
const ACTIVE_ROLE_KEY = "activeRoleId";
const LEGACY_ACTIVE_ROLE_KEY = "owner_financials_active_role_id";

export async function getActiveRoleId(): Promise<string | null> {
  const next = await SecureStore.getItemAsync(ACTIVE_ROLE_KEY);
  if (next) return next;
  return SecureStore.getItemAsync(LEGACY_ACTIVE_ROLE_KEY);
}

export async function setActiveRoleId(roleId: string | null): Promise<void> {
  if (roleId === null) {
    await SecureStore.deleteItemAsync(ACTIVE_ROLE_KEY);
    try {
      await SecureStore.deleteItemAsync(LEGACY_ACTIVE_ROLE_KEY);
    } catch {
      /* key may not exist */
    }
    return;
  }
  await SecureStore.setItemAsync(ACTIVE_ROLE_KEY, roleId);
}
