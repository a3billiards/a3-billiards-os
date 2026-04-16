"use node";

import { getAuthUserId } from "@convex-dev/auth/server";
import { internal } from "./_generated/api";
import { action } from "./_generated/server";

/**
 * Queues a GDPR-style data export for the authenticated owner (JSON email via Resend, async).
 * Rate-limited to once per 24 hours per account (`enqueueOwnerDataExport`).
 */
export const requestOwnerDataExport = action({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("AUTH_001: Not authenticated");

    const row = await ctx.runQuery(internal.users.getOwnerExportContext, {
      userId,
    });
    if (!row) throw new Error("PERM_001: Owner only");
    if (!row.email) {
      throw new Error(
        "DATA_001: Add an email address to your account before requesting a data export",
      );
    }

    await ctx.runMutation(internal.deletion.enqueueOwnerDataExport, { userId });
    return { ok: true as const };
  },
});
