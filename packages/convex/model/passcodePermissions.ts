import type { Doc, Id } from "../_generated/dataModel";

export const OWNER_UNRESTRICTED_TABS = [
  "slots",
  "snacks",
  "financials",
  "complaints",
  "bookings",
] as const;

export type PasscodePermissions = {
  allowedTabs: string[];
  allowedTableIds: Id<"tables">[] | null;
  canFileComplaints: boolean;
  canApplyDiscount: boolean;
  maxDiscountPercent: number | null;
};

/** Success payload from passcodeActions.verifyPasscode */
export type VerifyPasscodeResult = {
  verified: true;
  permissions: PasscodePermissions;
  staffRoleId?: Id<"staffRoles">;
  staffRoleName?: string;
};

export function ownerUnrestrictedPermissions(): PasscodePermissions {
  return {
    allowedTabs: [...OWNER_UNRESTRICTED_TABS],
    allowedTableIds: null,
    canFileComplaints: true,
    canApplyDiscount: true,
    maxDiscountPercent: null,
  };
}

export function permissionsFromStaffRole(
  role: Doc<"staffRoles">,
): PasscodePermissions {
  return {
    allowedTabs: [...role.allowedTabs],
    allowedTableIds: role.allowedTableIds ?? null,
    canFileComplaints: role.canFileComplaints,
    canApplyDiscount: role.canApplyDiscount,
    maxDiscountPercent: role.maxDiscountPercent ?? null,
  };
}
