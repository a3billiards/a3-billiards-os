/**
 * Row-level security helpers (TDD §3.8). Safety net — mutations still enforce role/club scope.
 */
import { getAuthUserId } from "@convex-dev/auth/server";
import {
  customCtx,
  customMutation,
  customQuery,
} from "convex-helpers/server/customFunctions";
import {
  wrapDatabaseReader,
  wrapDatabaseWriter,
} from "convex-helpers/server/rowLevelSecurity";
import type { Doc } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";

type RuleCtx = QueryCtx | MutationCtx;

async function rlsRules(ctx: RuleCtx) {
  const userId = await getAuthUserId(ctx);
  const user =
    userId !== null ? ((await ctx.db.get(userId)) as Doc<"users"> | null) : null;

  return {
    users: {
      read: async () => user !== null,
      modify: async (_c: RuleCtx, doc: Doc<"users">) =>
        user?.role === "admin" || doc._id === user?._id,
    },
    sessions: {
      read: async () => user !== null,
      modify: async () => user !== null,
    },
    bookings: {
      read: async () => user !== null,
      modify: async () => user !== null,
    },
    complaints: {
      read: async () => user !== null,
      modify: async (_c: RuleCtx, doc: Doc<"complaints">) =>
        user?.role === "admin" || doc.removedAt === undefined,
    },
  };
}

export const queryWithRLS = customQuery(
  query,
  customCtx(async (ctx) => ({
    db: wrapDatabaseReader(ctx, ctx.db, await rlsRules(ctx)),
  })),
);

export const mutationWithRLS = customMutation(
  mutation,
  customCtx(async (ctx) => ({
    db: wrapDatabaseWriter(ctx, ctx.db, await rlsRules(ctx)),
  })),
);
