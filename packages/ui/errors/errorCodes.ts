/**
 * @a3/ui — Application Error Codes
 * TDD v1.4 §Error Codes. Single source of truth.
 * Format: DOMAIN_NNN
 * Retryable: RATE_001, BOOKING_003, SESSION_002
 */
 
export const ERROR_CODES = {
    AUTH_001: "Invalid credentials",
    AUTH_002: "Account is frozen",
    AUTH_003: "Account pending deletion",
    AUTH_004: "MFA code invalid or expired",
    AUTH_005: "MFA not configured",
    SESSION_001: "Table is already occupied",
    SESSION_002: "Table lock expired — please retry",  // retryable
    SESSION_003: "Table is inactive",
    SESSION_004: "Customer account is frozen",
    SESSION_005: "Customer account pending deletion",
    SESSION_006: "Session already completed or cancelled",
    SESSION_007: "Cannot add snacks after payment",
    BOOKING_001: "Club does not accept online bookings",
    BOOKING_002: "Selected slot is no longer available",
    BOOKING_003: "Concurrent booking conflict — please retry",  // retryable
    BOOKING_004: "Booking outside advance booking window",
    BOOKING_005: "Booking cancelled too late",
    BOOKING_006: "Maximum active bookings reached",
    BOOKING_007: "Approval deadline passed",
    BOOKING_008: "Invalid booking state transition",
    BOOKING_009: "Table type not bookable at this club",
    BOOKING_010: "Slot duration not in slotDurationOptions",
    BOOKING_011: "Booking time outside bookableHours",
    OTP_001: "OTP expired",
    OTP_002: "OTP is incorrect",
    OTP_003: "OTP rate limit exceeded — please wait",
    OTP_004: "WhatsApp API error",
    OTP_005: "Phone number already registered",
    RATE_001: "Rate limit exceeded — please retry later",  // retryable
    PAYMENT_001: "Invalid payment signature",
    PAYMENT_002: "Club not found for payment",
    SUBSCRIPTION_001: "Club subscription is inactive",
    SUBSCRIPTION_002: "Subscription grace period active",
    SUBSCRIPTION_003: "Club account is frozen",
    PERM_001: "Insufficient role for this action",
    PERM_002: "Staff role does not have permission",
    DATA_001: "Required field missing",
    DATA_002: "Invalid data format",
    DATA_003: "Resource not found",
    DELETION_001: "Owner has active sessions — cannot delete",
    DELETION_002: "Owner has unpaid credits — cannot delete",
    DELETION_003: "Owner subscription still active — cannot delete",
    PROMOTE_001: "Customers cannot be promoted. Register via Onboarding Website.",
    PROMOTE_002: "User is already an admin.",
    UNKNOWN: "An unexpected error occurred",
  } as const;
   
  export type ErrorCode = keyof typeof ERROR_CODES;
   
  const RETRYABLE: Set<string> = new Set(["RATE_001", "BOOKING_003", "SESSION_002"]);
   
  export interface AppError {
    code: ErrorCode | "UNKNOWN";
    message: string;
    retryable: boolean;
  }
   
  /** Parses a Convex error "CODE_NNN: message" into a structured AppError */
  export function parseConvexError(error: Error): AppError {
    const match = error.message.match(/^([A-Z_]+_\d{3,}): (.+)/);
    if (!match) return { code: "UNKNOWN", message: error.message, retryable: false };
    const [, code, message] = match;
    return { code: code as ErrorCode, message, retryable: RETRYABLE.has(code) };
  }
   
  export function isRetryable(code: string): boolean {
    return RETRYABLE.has(code);
  }