/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as googleAuth from "../googleAuth.js";
import type * as googleAuthActions from "../googleAuthActions.js";
import type * as mfa from "../mfa.js";
import type * as mfaActions from "../mfaActions.js";
import type * as model_index from "../model/index.js";
import type * as model_passcodePermissions from "../model/passcodePermissions.js";
import type * as model_phoneRegistration from "../model/phoneRegistration.js";
import type * as model_rateLimiter from "../model/rateLimiter.js";
import type * as model_sessionRate from "../model/sessionRate.js";
import type * as model_sessionSnackRules from "../model/sessionSnackRules.js";
import type * as model_viewer from "../model/viewer.js";
import type * as otp from "../otp.js";
import type * as otpActions from "../otpActions.js";
import type * as ownerSessions from "../ownerSessions.js";
import type * as passcode from "../passcode.js";
import type * as passcodeActions from "../passcodeActions.js";
import type * as passwordReset from "../passwordReset.js";
import type * as passwordResetActions from "../passwordResetActions.js";
import type * as slotManagement from "../slotManagement.js";
import type * as users from "../users.js";
import type * as usersActions from "../usersActions.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  googleAuth: typeof googleAuth;
  googleAuthActions: typeof googleAuthActions;
  mfa: typeof mfa;
  mfaActions: typeof mfaActions;
  "model/index": typeof model_index;
  "model/passcodePermissions": typeof model_passcodePermissions;
  "model/phoneRegistration": typeof model_phoneRegistration;
  "model/rateLimiter": typeof model_rateLimiter;
  "model/sessionRate": typeof model_sessionRate;
  "model/sessionSnackRules": typeof model_sessionSnackRules;
  "model/viewer": typeof model_viewer;
  otp: typeof otp;
  otpActions: typeof otpActions;
  ownerSessions: typeof ownerSessions;
  passcode: typeof passcode;
  passcodeActions: typeof passcodeActions;
  passwordReset: typeof passwordReset;
  passwordResetActions: typeof passwordResetActions;
  slotManagement: typeof slotManagement;
  users: typeof users;
  usersActions: typeof usersActions;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
