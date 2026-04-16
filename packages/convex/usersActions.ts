"use node";

import { getAuthUserId } from "@convex-dev/auth/server";
import { internal } from "./_generated/api";
import { action } from "./_generated/server";

export const requestCustomerDataExport = action({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new Error("AUTH_001: Not authenticated");
    }

    const row = await ctx.runQuery(internal.deletion.getCustomerForExportEnqueue, {
      userId,
    });
    if (!row) {
      throw new Error("PERM_001: Customer only");
    }
    if (!row.email) {
      throw new Error(
        "Add an email address to your profile to request a data export.",
      );
    }

    await ctx.runMutation(internal.deletion.enqueueCustomerDataExport, {
      userId,
    });

    return { queued: true as const };
  },
});
