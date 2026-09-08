/**
 * Onboarding SPA references Convex by path only — avoids typechecking the full
 * `packages/convex` backend via generated `api.d.ts` (which imports every module).
 */
import { anyApi } from "convex/server";

export const api = anyApi;
