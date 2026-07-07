/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as admin from "../admin.js";
import type * as adminAuth from "../adminAuth.js";
import type * as auth from "../auth.js";
import type * as bookingPayments from "../bookingPayments.js";
import type * as bookings from "../bookings.js";
import type * as clubDiscovery from "../clubDiscovery.js";
import type * as clubDocuments from "../clubDocuments.js";
import type * as clubProfile from "../clubProfile.js";
import type * as complaints from "../complaints.js";
import type * as crons from "../crons.js";
import type * as customerAuth from "../customerAuth.js";
import type * as customerAuthActions from "../customerAuthActions.js";
import type * as dataExportActions from "../dataExportActions.js";
import type * as dataExportMutations from "../dataExportMutations.js";
import type * as dataExports from "../dataExports.js";
import type * as deletion from "../deletion.js";
import type * as deletionActions from "../deletionActions.js";
import type * as financials from "../financials.js";
import type * as googleAuth from "../googleAuth.js";
import type * as googleAuthActions from "../googleAuthActions.js";
import type * as googleAuthOps from "../googleAuthOps.js";
import type * as googleCredentialsProvider from "../googleCredentialsProvider.js";
import type * as gstReport from "../gstReport.js";
import type * as http from "../http.js";
import type * as kitchenOrders from "../kitchenOrders.js";
import type * as livestream from "../livestream.js";
import type * as livestreamActions from "../livestreamActions.js";
import type * as livestreamWebhook from "../livestreamWebhook.js";
import type * as mfa from "../mfa.js";
import type * as mfaActions from "../mfaActions.js";
import type * as model_bookingDuration from "../model/bookingDuration.js";
import type * as model_clubSubscription from "../model/clubSubscription.js";
import type * as model_convexSiteOrigin from "../model/convexSiteOrigin.js";
import type * as model_dataExportCsv from "../model/dataExportCsv.js";
import type * as model_geocode from "../model/geocode.js";
import type * as model_index from "../model/index.js";
import type * as model_livestreamIvs from "../model/livestreamIvs.js";
import type * as model_otp from "../model/otp.js";
import type * as model_passcodePermissions from "../model/passcodePermissions.js";
import type * as model_passwordPolicy from "../model/passwordPolicy.js";
import type * as model_phoneRegistration from "../model/phoneRegistration.js";
import type * as model_platformGst from "../model/platformGst.js";
import type * as model_rateLimiter from "../model/rateLimiter.js";
import type * as model_sessionRate from "../model/sessionRate.js";
import type * as model_sessionSnackRules from "../model/sessionSnackRules.js";
import type * as model_staffTabAccess from "../model/staffTabAccess.js";
import type * as model_transactionalEmailHtml from "../model/transactionalEmailHtml.js";
import type * as model_viewer from "../model/viewer.js";
import type * as notifications from "../notifications.js";
import type * as notificationsActions from "../notificationsActions.js";
import type * as notificationsFcm from "../notificationsFcm.js";
import type * as onboardingPlanPricing from "../onboardingPlanPricing.js";
import type * as onboardingWeb from "../onboardingWeb.js";
import type * as onboardingWebActions from "../onboardingWebActions.js";
import type * as otp from "../otp.js";
import type * as ownerAccountActions from "../ownerAccountActions.js";
import type * as ownerCustomerLookup from "../ownerCustomerLookup.js";
import type * as ownerDeskCustomerMutations from "../ownerDeskCustomerMutations.js";
import type * as ownerDeskCustomerRegistration from "../ownerDeskCustomerRegistration.js";
import type * as ownerEmailVerification from "../ownerEmailVerification.js";
import type * as ownerEmailVerificationActions from "../ownerEmailVerificationActions.js";
import type * as ownerSessionActions from "../ownerSessionActions.js";
import type * as ownerSessions from "../ownerSessions.js";
import type * as passcode from "../passcode.js";
import type * as passcodeActions from "../passcodeActions.js";
import type * as passwordProviderA3 from "../passwordProviderA3.js";
import type * as passwordReset from "../passwordReset.js";
import type * as passwordResetActions from "../passwordResetActions.js";
import type * as paymentReceipts from "../paymentReceipts.js";
import type * as phoneOtp from "../phoneOtp.js";
import type * as phoneOtpProvider from "../phoneOtpProvider.js";
import type * as rls from "../rls.js";
import type * as seed from "../seed.js";
import type * as sessions from "../sessions.js";
import type * as slotManagement from "../slotManagement.js";
import type * as slots from "../slots.js";
import type * as snacks from "../snacks.js";
import type * as staffRoles from "../staffRoles.js";
import type * as subscriptions from "../subscriptions.js";
import type * as supportRequests from "../supportRequests.js";
import type * as users from "../users.js";
import type * as usersActions from "../usersActions.js";
import type * as usersAdminActions from "../usersAdminActions.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  admin: typeof admin;
  adminAuth: typeof adminAuth;
  auth: typeof auth;
  bookingPayments: typeof bookingPayments;
  bookings: typeof bookings;
  clubDiscovery: typeof clubDiscovery;
  clubDocuments: typeof clubDocuments;
  clubProfile: typeof clubProfile;
  complaints: typeof complaints;
  crons: typeof crons;
  customerAuth: typeof customerAuth;
  customerAuthActions: typeof customerAuthActions;
  dataExportActions: typeof dataExportActions;
  dataExportMutations: typeof dataExportMutations;
  dataExports: typeof dataExports;
  deletion: typeof deletion;
  deletionActions: typeof deletionActions;
  financials: typeof financials;
  googleAuth: typeof googleAuth;
  googleAuthActions: typeof googleAuthActions;
  googleAuthOps: typeof googleAuthOps;
  googleCredentialsProvider: typeof googleCredentialsProvider;
  gstReport: typeof gstReport;
  http: typeof http;
  kitchenOrders: typeof kitchenOrders;
  livestream: typeof livestream;
  livestreamActions: typeof livestreamActions;
  livestreamWebhook: typeof livestreamWebhook;
  mfa: typeof mfa;
  mfaActions: typeof mfaActions;
  "model/bookingDuration": typeof model_bookingDuration;
  "model/clubSubscription": typeof model_clubSubscription;
  "model/convexSiteOrigin": typeof model_convexSiteOrigin;
  "model/dataExportCsv": typeof model_dataExportCsv;
  "model/geocode": typeof model_geocode;
  "model/index": typeof model_index;
  "model/livestreamIvs": typeof model_livestreamIvs;
  "model/otp": typeof model_otp;
  "model/passcodePermissions": typeof model_passcodePermissions;
  "model/passwordPolicy": typeof model_passwordPolicy;
  "model/phoneRegistration": typeof model_phoneRegistration;
  "model/platformGst": typeof model_platformGst;
  "model/rateLimiter": typeof model_rateLimiter;
  "model/sessionRate": typeof model_sessionRate;
  "model/sessionSnackRules": typeof model_sessionSnackRules;
  "model/staffTabAccess": typeof model_staffTabAccess;
  "model/transactionalEmailHtml": typeof model_transactionalEmailHtml;
  "model/viewer": typeof model_viewer;
  notifications: typeof notifications;
  notificationsActions: typeof notificationsActions;
  notificationsFcm: typeof notificationsFcm;
  onboardingPlanPricing: typeof onboardingPlanPricing;
  onboardingWeb: typeof onboardingWeb;
  onboardingWebActions: typeof onboardingWebActions;
  otp: typeof otp;
  ownerAccountActions: typeof ownerAccountActions;
  ownerCustomerLookup: typeof ownerCustomerLookup;
  ownerDeskCustomerMutations: typeof ownerDeskCustomerMutations;
  ownerDeskCustomerRegistration: typeof ownerDeskCustomerRegistration;
  ownerEmailVerification: typeof ownerEmailVerification;
  ownerEmailVerificationActions: typeof ownerEmailVerificationActions;
  ownerSessionActions: typeof ownerSessionActions;
  ownerSessions: typeof ownerSessions;
  passcode: typeof passcode;
  passcodeActions: typeof passcodeActions;
  passwordProviderA3: typeof passwordProviderA3;
  passwordReset: typeof passwordReset;
  passwordResetActions: typeof passwordResetActions;
  paymentReceipts: typeof paymentReceipts;
  phoneOtp: typeof phoneOtp;
  phoneOtpProvider: typeof phoneOtpProvider;
  rls: typeof rls;
  seed: typeof seed;
  sessions: typeof sessions;
  slotManagement: typeof slotManagement;
  slots: typeof slots;
  snacks: typeof snacks;
  staffRoles: typeof staffRoles;
  subscriptions: typeof subscriptions;
  supportRequests: typeof supportRequests;
  users: typeof users;
  usersActions: typeof usersActions;
  usersAdminActions: typeof usersAdminActions;
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
