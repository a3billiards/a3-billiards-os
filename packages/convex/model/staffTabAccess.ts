import type { Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { OWNER_UNRESTRICTED_TABS } from "./passcodePermissions";

export async function assertStaffTabAllowed(
  ctx: QueryCtx | MutationCtx,
  clubId: Id<"clubs">,
  tab: string,
  roleId?: Id<"staffRoles">,
): Promise<void> {
  if (!roleId) return;
  const role = await ctx.db.get(roleId);
  if (!role || role.clubId !== clubId) {
    throw new Error("PERM_001: Staff role not found");
  }
  if (!role.allowedTabs.includes(tab)) {
    throw new Error(`PERM_001: ${tab} tab not allowed for active role`);
  }
}

/** Chef preset: kitchen tab only — may advance orders and toggle menu availability. */
export function isChefKitchenRole(allowedTabs: string[]): boolean {
  return allowedTabs.length === 1 && allowedTabs[0] === "kitchen";
}

export async function resolveStaffTabAccess(
  ctx: QueryCtx,
  clubId: Id<"clubs">,
  roleId?: Id<"staffRoles">,
): Promise<{ allowedTabs: string[]; isOwnerMode: boolean; isChefKitchenRole: boolean }> {
  if (!roleId) {
    return {
      allowedTabs: [...OWNER_UNRESTRICTED_TABS],
      isOwnerMode: true,
      isChefKitchenRole: false,
    };
  }
  const role = await ctx.db.get(roleId);
  if (!role || role.clubId !== clubId) {
    return { allowedTabs: [], isOwnerMode: false, isChefKitchenRole: false };
  }
  const allowedTabs = [...role.allowedTabs];
  return {
    allowedTabs,
    isOwnerMode: false,
    isChefKitchenRole: isChefKitchenRole(allowedTabs),
  };
}
