/**
 * Server-side validation of Convex storage blobs after client upload.
 */

import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";

const MAX_CLUB_PHOTO_BYTES = 5 * 1024 * 1024;
const MAX_CLUB_DOCUMENT_BYTES = 10 * 1024 * 1024;

const CLUB_PHOTO_CONTENT_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

const CLUB_DOCUMENT_CONTENT_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "application/pdf",
]);

async function assertStorageBlob(
  ctx: MutationCtx,
  storageId: Id<"_storage">,
  allowedTypes: Set<string>,
  maxBytes: number,
  label: string,
): Promise<{ contentType: string; size: number }> {
  const meta = await ctx.storage.getMetadata(storageId);
  if (!meta) {
    throw new Error(`DATA_002: ${label} upload not found — please try again`);
  }
  const contentType = (meta.contentType ?? "").trim().toLowerCase();
  if (!contentType || !allowedTypes.has(contentType)) {
    await ctx.storage.delete(storageId);
    throw new Error(
      `DATA_002: ${label} must be one of: ${[...allowedTypes].join(", ")}`,
    );
  }
  if (meta.size > maxBytes) {
    await ctx.storage.delete(storageId);
    throw new Error(
      `DATA_002: ${label} exceeds maximum size of ${Math.round(maxBytes / (1024 * 1024))}MB`,
    );
  }
  return { contentType, size: meta.size };
}

export async function assertValidClubPhotoStorage(
  ctx: MutationCtx,
  storageId: Id<"_storage">,
): Promise<void> {
  await assertStorageBlob(
    ctx,
    storageId,
    CLUB_PHOTO_CONTENT_TYPES,
    MAX_CLUB_PHOTO_BYTES,
    "Club photo",
  );
}

export async function assertValidClubDocumentStorage(
  ctx: MutationCtx,
  storageId: Id<"_storage">,
): Promise<string> {
  const { contentType } = await assertStorageBlob(
    ctx,
    storageId,
    CLUB_DOCUMENT_CONTENT_TYPES,
    MAX_CLUB_DOCUMENT_BYTES,
    "Club document",
  );
  return contentType;
}
