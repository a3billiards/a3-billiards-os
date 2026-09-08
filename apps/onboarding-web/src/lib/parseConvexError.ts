import { captureException } from "../instrumentation";

/** Minimal Convex error parser (matches @a3/ui pattern). */
export function parseConvexError(error: Error): { code: string; message: string } {
  const match = error.message.match(/([A-Z_]+_\d{3,}):\s*([^\n]+)/);
  if (!match) {
    captureException(error, { source: "parseConvexError", kind: "unstructured_message" });
    return { code: "UNKNOWN", message: error.message };
  }
  return { code: match[1]!, message: match[2]!.trim() };
}
