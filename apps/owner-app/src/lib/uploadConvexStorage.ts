import { Platform } from "react-native";
import * as FileSystem from "expo-file-system/legacy";
import type { Id } from "@a3/convex/_generated/dataModel";

function contentTypeFromAsset(uri: string, mimeType?: string | null): string {
  if (mimeType === "application/pdf") {
    return "application/pdf";
  }
  if (mimeType && mimeType.startsWith("image/")) {
    return mimeType;
  }
  const ext = uri.split(".").pop()?.split("?")[0]?.toLowerCase();
  switch (ext) {
    case "pdf":
      return "application/pdf";
    case "png":
      return "image/png";
    case "webp":
      return "image/webp";
    case "heic":
    case "heif":
      return "image/heic";
    default:
      return "image/jpeg";
  }
}

function parseStorageIdFromUploadBody(body: string): Id<"_storage"> {
  const trimmed = body.trim();
  if (!trimmed) {
    throw new Error("Upload succeeded but no storage ID was returned");
  }
  if (trimmed.startsWith("{")) {
    const parsed = JSON.parse(trimmed) as { storageId?: string };
    if (!parsed.storageId) {
      throw new Error("Upload response missing storageId");
    }
    return parsed.storageId as Id<"_storage">;
  }
  return trimmed as Id<"_storage">;
}

/**
 * Upload a local file URI to Convex storage via a generated upload URL.
 * React Native cannot fetch(file://...) reliably — use FileSystem.uploadAsync on native.
 */
export async function uploadLocalFileToConvexStorage(
  uploadUrl: string,
  uri: string,
  mimeType?: string | null,
): Promise<Id<"_storage">> {
  const contentType = contentTypeFromAsset(uri, mimeType);

  if (Platform.OS === "web") {
    const fileResp = await fetch(uri);
    if (!fileResp.ok) {
      throw new Error("Could not read the selected file");
    }
    const blob = await fileResp.blob();
    const upload = await fetch(uploadUrl, {
      method: "POST",
      headers: { "Content-Type": contentType },
      body: blob,
    });
    if (!upload.ok) {
      throw new Error(`Upload failed (${upload.status})`);
    }
    return parseStorageIdFromUploadBody(await upload.text());
  }

  const response = await FileSystem.uploadAsync(uploadUrl, uri, {
    httpMethod: "POST",
    uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
    headers: { "Content-Type": contentType },
  });

  if (response.status < 200 || response.status >= 300) {
    throw new Error(`Upload failed (${response.status})`);
  }

  return parseStorageIdFromUploadBody(response.body);
}
