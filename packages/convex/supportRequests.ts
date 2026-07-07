import { SUPPORT_CATEGORIES, type SupportCategory } from "@a3/utils/supportContact";
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getViewer, requireAdminWithMfa, requireViewer } from "./model/viewer";

const MAX_SUBJECT = 120;
const MAX_MESSAGE = 2000;

function trimSubject(s: string): string {
  const t = s.trim();
  if (t.length < 3 || t.length > MAX_SUBJECT) {
    throw new Error("SUPPORT_001: Subject must be 3–120 characters");
  }
  return t;
}

function trimMessage(s: string): string {
  const t = s.trim();
  if (t.length < 10 || t.length > MAX_MESSAGE) {
    throw new Error("SUPPORT_002: Message must be 10–2000 characters");
  }
  return t;
}

function normalizeCategory(raw: string): SupportCategory {
  const trimmed = raw.trim();
  return (SUPPORT_CATEGORIES as readonly string[]).includes(trimmed)
    ? (trimmed as SupportCategory)
    : "other";
}

function displayNameForSupport(
  user: { name: string; phone?: string; email?: string },
  audience: "customer" | "owner",
): string {
  const name = user.name?.trim();
  if (name) return name;
  if (user.phone) return user.phone;
  if (user.email) return user.email;
  return audience === "owner" ? "Club owner" : "Customer";
}

export const submitSupportRequest = mutation({
  args: {
    audience: v.union(v.literal("customer"), v.literal("owner")),
    category: v.string(),
    subject: v.string(),
    message: v.string(),
  },
  handler: async (ctx, { audience, category, subject, message }) => {
    const viewer = await requireViewer(ctx);
    if (!viewer.userId) throw new Error("AUTH_001: Not authenticated");
    const user = await ctx.db.get(viewer.userId);
    if (!user) throw new Error("DATA_003: User not found");

    if (audience === "customer" && user.role !== "customer") {
      throw new Error("PERM_001: Invalid audience for this account");
    }
    if (audience === "owner" && user.role !== "owner") {
      throw new Error("PERM_001: Invalid audience for this account");
    }

    const now = Date.now();
    return await ctx.db.insert("supportRequests", {
      userId: viewer.userId,
      userRole: user.role,
      audience,
      category: normalizeCategory(category),
      subject: trimSubject(subject),
      message: trimMessage(message),
      status: "open",
      userName: displayNameForSupport(user, audience),
      userEmail: user.email ?? undefined,
      userPhone: user.phone ?? undefined,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const listMySupportRequests = query({
  args: {},
  handler: async (ctx) => {
    const viewer = await getViewer(ctx);
    if (viewer === null) return [];
    const rows = await ctx.db
      .query("supportRequests")
      .withIndex("by_user_createdAt", (q) => q.eq("userId", viewer.userId))
      .order("desc")
      .take(20);
    return rows.map((r) => ({
      _id: r._id,
      category: r.category,
      subject: r.subject,
      status: r.status,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      adminNotes: r.adminNotes ?? null,
    }));
  },
});

export const listSupportRequestsForAdmin = query({
  args: {
    statusFilter: v.optional(
      v.union(
        v.literal("open"),
        v.literal("in_progress"),
        v.literal("resolved"),
        v.literal("closed"),
        v.literal("active"),
      ),
    ),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { statusFilter, limit }) => {
    await requireAdminWithMfa(ctx);
    const cap = Math.min(Math.max(limit ?? 100, 1), 200);

    if (statusFilter === "active" || statusFilter === "open" || statusFilter === "in_progress") {
      const statuses =
        statusFilter === "in_progress"
          ? (["in_progress"] as const)
          : statusFilter === "open"
            ? (["open"] as const)
            : (["open", "in_progress"] as const);
      const batches = await Promise.all(
        statuses.map((status) =>
          ctx.db
            .query("supportRequests")
            .withIndex("by_status_createdAt", (q) => q.eq("status", status))
            .order("desc")
            .take(cap),
        ),
      );
      return batches
        .flat()
        .sort((a, b) => b.createdAt - a.createdAt)
        .slice(0, cap);
    }

    const status =
      statusFilter === "resolved" || statusFilter === "closed"
        ? statusFilter
        : "open";
    return await ctx.db
      .query("supportRequests")
      .withIndex("by_status_createdAt", (q) => q.eq("status", status))
      .order("desc")
      .take(cap);
  },
});

export const adminUpdateSupportRequest = mutation({
  args: {
    requestId: v.id("supportRequests"),
    status: v.union(
      v.literal("open"),
      v.literal("in_progress"),
      v.literal("resolved"),
      v.literal("closed"),
    ),
    adminNotes: v.optional(v.string()),
  },
  handler: async (ctx, { requestId, status, adminNotes }) => {
    const admin = await requireAdminWithMfa(ctx);
    const row = await ctx.db.get(requestId);
    if (!row) throw new Error("DATA_003: Support request not found");

    const now = Date.now();
    const notes =
      adminNotes !== undefined ? adminNotes.trim().slice(0, 2000) : row.adminNotes;

    await ctx.db.patch(requestId, {
      status,
      adminNotes: notes || undefined,
      updatedAt: now,
      resolvedAt:
        status === "resolved" || status === "closed" ? now : undefined,
      resolvedByAdminId:
        status === "resolved" || status === "closed" ? admin.userId : undefined,
    });

    await ctx.db.insert("adminAuditLog", {
      adminId: admin.userId,
      action: "support_request_update",
      targetUserId: row.userId,
      notes: `Support request ${String(requestId)} → ${status}`,
      newValue: notes?.slice(0, 300),
      createdAt: now,
    });

    return { ok: true as const };
  },
});

export const countOpenSupportRequests = query({
  args: {},
  handler: async (ctx) => {
    await requireAdminWithMfa(ctx);
    const [open, inProgress] = await Promise.all([
      ctx.db
        .query("supportRequests")
        .withIndex("by_status_createdAt", (q) => q.eq("status", "open"))
        .collect(),
      ctx.db
        .query("supportRequests")
        .withIndex("by_status_createdAt", (q) => q.eq("status", "in_progress"))
        .collect(),
    ]);
    return open.length + inProgress.length;
  },
});
