import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import {
  assertMutationClubScope,
  requireOwner,
  requireOwnerWithClub,
  requireViewer,
} from "./model/viewer";
import { assertClubSubscriptionWritable } from "./model/clubSubscription";
import { assertStaffTabAllowed } from "./model/staffTabAccess";
import { assertValidClubDocumentStorage } from "./model/storageUploadValidation";

const MAX_LABEL_LEN = 80;
const MAX_NOTES_LEN = 500;
const ALLOWED_CONTENT_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "application/pdf",
]);

function normalizeContentType(contentType: string | undefined): string {
  const ct = (contentType ?? "image/jpeg").trim().toLowerCase();
  if (!ALLOWED_CONTENT_TYPES.has(ct)) {
    throw new Error("DATA_002: File must be a JPEG, PNG, WebP, HEIC, or PDF");
  }
  return ct;
}

function isPdfContentType(contentType: string | undefined): boolean {
  return contentType === "application/pdf";
}

async function requireOwnerClubWritable(
  ctx: MutationCtx,
  clubId: Id<"clubs">,
): Promise<{ userId: Id<"users">; clubId: Id<"clubs"> }> {
  const viewer = await requireViewer(ctx);
  const owner = requireOwnerWithClub(viewer);
  if (owner.clubId !== clubId) {
    throw new Error("PERM_001: Cannot access another club's data");
  }
  const club = await ctx.db.get(clubId);
  if (!club) throw new Error("DATA_003: Club not found");
  assertClubSubscriptionWritable(club);
  return { userId: owner.userId, clubId: owner.clubId };
}

function normalizeLabel(label: string): string {
  return label.trim().replace(/\s+/g, " ");
}

function normalizeNotes(notes: string | undefined): string | undefined {
  if (notes === undefined) return undefined;
  const trimmed = notes.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export const generateClubDocumentUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    const owner = requireOwnerWithClub(await requireViewer(ctx));
    const club = await ctx.db.get(owner.clubId);
    if (!club) throw new Error("DATA_003: Club not found");
    assertClubSubscriptionWritable(club);
    return await ctx.storage.generateUploadUrl();
  },
});

export const listClubDocuments = query({
  args: {
    clubId: v.id("clubs"),
    roleId: v.optional(v.id("staffRoles")),
  },
  handler: async (ctx, { clubId, roleId }) => {
    const viewer = await requireViewer(ctx);
    const owner = requireOwner(viewer);
    if (owner.clubId !== clubId) {
      throw new Error("PERM_001: Cannot access another club's data");
    }
    await assertStaffTabAllowed(ctx, clubId, "documents", roleId);

    const rows = await ctx.db
      .query("clubDocuments")
      .withIndex("by_club", (q) => q.eq("clubId", clubId))
      .collect();

    const sorted = rows.sort((a, b) => b.createdAt - a.createdAt);
    return Promise.all(
      sorted.map(async (doc) => {
        const contentType = doc.contentType ?? "image/jpeg";
        const fileUrl = await ctx.storage.getUrl(doc.imageFileId);
        return {
          documentId: doc._id,
          clubId: doc.clubId,
          label: doc.label,
          notes: doc.notes ?? null,
          uploadedBy: doc.uploadedBy,
          createdAt: doc.createdAt,
          imageFileId: doc.imageFileId,
          contentType,
          isPdf: isPdfContentType(contentType),
          fileUrl,
          imageUrl: fileUrl,
        };
      }),
    );
  },
});

export const createClubDocument = mutation({
  args: {
    clubId: v.id("clubs"),
    label: v.string(),
    imageFileId: v.id("_storage"),
    contentType: v.optional(v.string()),
    notes: v.optional(v.string()),
    roleId: v.optional(v.id("staffRoles")),
  },
  handler: async (ctx, args) => {
    const { userId, clubId } = await requireOwnerClubWritable(ctx, args.clubId);
    await assertStaffTabAllowed(ctx, clubId, "documents", args.roleId);

    const label = normalizeLabel(args.label);
    if (label.length === 0) {
      throw new Error("DATA_002: Document label is required");
    }
    if (label.length > MAX_LABEL_LEN) {
      throw new Error(`DATA_002: Label must be ${MAX_LABEL_LEN} characters or less`);
    }

    const notes = normalizeNotes(args.notes);
    if (notes !== undefined && notes.length > MAX_NOTES_LEN) {
      throw new Error(`DATA_002: Notes must be ${MAX_NOTES_LEN} characters or less`);
    }

    const verifiedContentType = await assertValidClubDocumentStorage(
      ctx,
      args.imageFileId,
    );
    const contentType = normalizeContentType(verifiedContentType);

    const documentId = await ctx.db.insert("clubDocuments", {
      clubId,
      label,
      imageFileId: args.imageFileId,
      contentType,
      notes,
      uploadedBy: userId,
      createdAt: Date.now(),
    });

    return { documentId };
  },
});

export const deleteClubDocument = mutation({
  args: {
    documentId: v.id("clubDocuments"),
    roleId: v.optional(v.id("staffRoles")),
  },
  handler: async (ctx, { documentId, roleId }) => {
    const viewer = await requireViewer(ctx);
    const owner = requireOwner(viewer);
    if (owner.clubId === null) {
      throw new Error("AUTH_008: No club found for owner account");
    }

    const doc = await ctx.db.get(documentId);
    if (!doc || doc.clubId !== owner.clubId) {
      throw new Error("DATA_003: Document not found");
    }

    const club = await ctx.db.get(owner.clubId);
    if (!club) throw new Error("DATA_003: Club not found");
    assertClubSubscriptionWritable(club);
    assertMutationClubScope(viewer, owner.clubId);
    await assertStaffTabAllowed(ctx, owner.clubId, "documents", roleId);

    await ctx.storage.delete(doc.imageFileId);
    await ctx.db.delete(documentId);
    return { deleted: true as const };
  },
});
