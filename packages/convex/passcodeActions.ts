"use node";

import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import bcrypt from "bcryptjs";
import { internal } from "./_generated/api";
import { action } from "./_generated/server";
import type { VerifyPasscodeResult } from "./model/passcodePermissions";
import {
  ownerUnrestrictedPermissions,
  permissionsFromStaffRole,
} from "./model/passcodePermissions";

const BCRYPT_ROUNDS = 10;

function assertSixDigitPin(passcode: string): string {
  const trimmed = passcode.trim();
  if (!/^\d{6}$/.test(trimmed)) {
    throw new Error("DATA_002: Passcode must be exactly 6 digits");
  }
  return trimmed;
}

/**
 * bcrypt(10) settings passcode; stores hash and sets settingsPasscodeSet (owner only, first setup only).
 */
export const setupPasscode = action({
  args: { passcode: v.string() },
  handler: async (ctx, { passcode }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("AUTH_001: Not authenticated");

    const digits = assertSixDigitPin(passcode);
    const passcodeHash = await bcrypt.hash(digits, BCRYPT_ROUNDS);

    await ctx.runMutation(internal.passcode.applySetupPasscode, {
      userId,
      passcodeHash,
    });

    return { success: true as const };
  },
});

/**
 * Verifies settings passcode; returns permission set for unrestricted owner or selected staff role.
 */
export const verifyPasscode = action({
  args: {
    passcode: v.string(),
    staffRoleId: v.optional(v.id("staffRoles")),
  },
  handler: async (ctx, { passcode, staffRoleId }): Promise<VerifyPasscodeResult> => {
    const ctxRow = await ctx.runQuery(internal.passcode.getOwnerVerifyContext, {});
    if (ctxRow === null) {
      throw new Error("PERM_001: Owner only");
    }

    if (!ctxRow.settingsPasscodeSet || !ctxRow.settingsPasscodeHash) {
      throw new Error("PASSCODE_002: Passcode not configured");
    }

    const digits = assertSixDigitPin(passcode);
    const attemptKey = `passcode:${ctxRow.userId}`;
    await ctx.runQuery(internal.authAttemptLimit.assertNotLocked, {
      key: attemptKey,
    });

    const ok = await bcrypt.compare(digits, ctxRow.settingsPasscodeHash);
    if (!ok) {
      await ctx.runMutation(internal.authAttemptLimit.recordFailed, {
        key: attemptKey,
      });
      throw new Error("PASSCODE_001: Invalid passcode");
    }

    await ctx.runMutation(internal.authAttemptLimit.clear, { key: attemptKey });

    if (staffRoleId === undefined) {
      return {
        verified: true as const,
        permissions: ownerUnrestrictedPermissions(),
      };
    }

    const role = await ctx.runQuery(internal.passcode.getStaffRoleForClub, {
      staffRoleId,
      clubId: ctxRow.clubId,
    });
    if (role === null) {
      throw new Error("DATA_003: Staff role not found");
    }

    const out: VerifyPasscodeResult = {
      verified: true,
      permissions: permissionsFromStaffRole(role),
      staffRoleId: role._id,
      staffRoleName: role.name,
    };
    return out;
  },
});

/**
 * Change settings passcode while signed in (verify current PIN, then set new PIN).
 */
export const changePasscode = action({
  args: {
    currentPasscode: v.string(),
    newPasscode: v.string(),
  },
  handler: async (ctx, { currentPasscode, newPasscode }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("AUTH_001: Not authenticated");

    const ctxRow = await ctx.runQuery(internal.passcode.getOwnerVerifyContext, {});
    if (ctxRow === null) {
      throw new Error("PERM_001: Owner only");
    }
    if (!ctxRow.settingsPasscodeSet || !ctxRow.settingsPasscodeHash) {
      throw new Error("PASSCODE_002: Passcode not configured");
    }

    const currentDigits = assertSixDigitPin(currentPasscode);
    const newDigits = assertSixDigitPin(newPasscode);
    if (currentDigits === newDigits) {
      throw new Error("DATA_001: New passcode must be different");
    }

    const attemptKey = `passcode:${userId}`;
    await ctx.runQuery(internal.authAttemptLimit.assertNotLocked, {
      key: attemptKey,
    });

    const ok = await bcrypt.compare(currentDigits, ctxRow.settingsPasscodeHash);
    if (!ok) {
      await ctx.runMutation(internal.authAttemptLimit.recordFailed, {
        key: attemptKey,
      });
      throw new Error("PASSCODE_001: Invalid passcode");
    }

    await ctx.runMutation(internal.authAttemptLimit.clear, { key: attemptKey });

    const passcodeHash = await bcrypt.hash(newDigits, BCRYPT_ROUNDS);
    await ctx.runMutation(internal.passcode.applyChangePasscode, {
      userId,
      passcodeHash,
    });

    return { success: true as const };
  },
});

/**
 * Clears passcode flags for the authenticated owner and emails a PasscodeReset notice via Resend.
 */
export const resetPasscodeViaEmail = action({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("AUTH_001: Not authenticated");

    const ctxRow = await ctx.runQuery(internal.passcode.getOwnerVerifyContext, {});
    if (ctxRow === null) {
      throw new Error("PERM_001: Owner only");
    }

    const user = await ctx.runQuery(internal.passcode.getUserEmailForPasscode, {
      userId,
    });
    if (!user?.email) {
      throw new Error("DATA_001: Owner email required for passcode reset");
    }

    await ctx.runMutation(internal.passcode.clearPasscodeStateForOwner, {
      userId,
    });

    const resetLink =
      process.env.PASSCODE_RESET_URL ??
      "https://links.a3billiards.com/owner/settings";
    await ctx.runAction(internal.notificationsFcm.sendPasscodeResetEmail, {
      email: user.email,
      resetLink,
    });

    return { success: true as const };
  },
});
