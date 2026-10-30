/**
 * GlucoLab Patient-Facing Messaging & Diagnostic System
 *
 * Translates technical API, database, network, and validation errors into
 * warm, empathetic, relatable health companion language while preserving
 * structured diagnostic logs for developer troubleshooting.
 */

export type MessageContext =
  | "auth"
  | "glucose"
  | "insulin"
  | "food"
  | "weight"
  | "export"
  | "report"
  | "profile"
  | "notifications"
  | "settings"
  | "sync"
  | "scanner"
  | "general";

/**
 * Sanitizes technical objects to remove passwords, OTPs, or tokens before logging.
 */
function sanitizeMeta(meta?: Record<string, any>): Record<string, any> | undefined {
  if (!meta) return undefined;
  const clean: Record<string, any> = {};
  for (const [key, val] of Object.entries(meta)) {
    const lowerKey = key.toLowerCase();
    if (
      lowerKey.includes("password") ||
      lowerKey.includes("token") ||
      lowerKey.includes("otp") ||
      lowerKey.includes("secret") ||
      lowerKey.includes("key")
    ) {
      clean[key] = "[REDACTED]";
    } else {
      clean[key] = val;
    }
  }
  return clean;
}

/**
 * Logs structured diagnostic information for production debugging without
 * exposing technical details or sensitive credentials to the user.
 */
export function logDiagnostic(context: string, error: unknown, meta?: Record<string, any>) {
  try {
    const errObj = error as { message?: string; code?: string; status?: number; stack?: string };
    const diagnostic = {
      timestamp: new Date().toISOString(),
      context,
      code: errObj?.code,
      status: errObj?.status,
      rawMessage: errObj?.message || (typeof error === "string" ? error : undefined),
      meta: sanitizeMeta(meta),
    };
    console.error(`[GlucoLab Diagnostic:${context}]`, diagnostic);
  } catch {
    console.error(`[GlucoLab Diagnostic:${context}]`, error);
  }
}

/**
 * Converts any raw error (Error instance, Supabase error, HTTP response, or string)
 * into a patient-friendly message tailored to the context.
 */
export function getUserFriendlyError(error: unknown, context: MessageContext = "general"): string {
  if (!error) {
    return getContextDefaultError(context);
  }

  // Extract raw text and code safely
  let rawMsg = "";
  let errorCode = "";
  let status: number | undefined;

  if (typeof error === "string") {
    rawMsg = error;
  } else if (typeof error === "object" && error !== null) {
    const e = error as { message?: string; error_description?: string; code?: string; status?: number };
    rawMsg = e.message || e.error_description || "";
    errorCode = (e.code || "").toString();
    status = e.status;
  }

  const lower = rawMsg.toLowerCase();
  const lowerCode = errorCode.toLowerCase();

  // 1. Connectivity & Network Failures
  if (
    lower.includes("failed to fetch") ||
    lower.includes("networkerror") ||
    lower.includes("network request failed") ||
    lower.includes("connection refused") ||
    lower.includes("network connection error") ||
    lower.includes("offline") ||
    lower.includes("unknownhost") ||
    lower.includes("socketexception")
  ) {
    return "We couldn't connect. Check your internet connection and try again.";
  }

  if (lower.includes("timeout") || lower.includes("timed out") || lower.includes("abort_err")) {
    return "This is taking longer than expected. Please check your connection and try again.";
  }

  // 2. HTTP Server Outages & Gateway Errors
  if (
    status === 500 ||
    status === 502 ||
    status === 503 ||
    status === 504 ||
    lower.includes("internal server error") ||
    lower.includes("server unavailable") ||
    lower.includes("bad gateway")
  ) {
    return "GlucoLab is temporarily unavailable. Please try again in a few moments.";
  }

  // 3. Rate Limiting & Cooldowns
  if (
    status === 429 ||
    lowerCode === "over_email_send_rate_limit" ||
    lower.includes("rate limit") ||
    lower.includes("too many requests") ||
    lower.includes("maximum verification attempts")
  ) {
    return "You've tried several times. Please wait a little before trying again.";
  }

  // 4. Authentication & Session Errors
  if (
    lower.includes("invalid login credentials") ||
    lower.includes("invalid credentials") ||
    lower.includes("email or password") ||
    lowerCode === "invalid_credentials"
  ) {
    return "Email or password doesn't match. Please try again.";
  }

  if (
    lower.includes("user already registered") ||
    lower.includes("user already exists") ||
    lower.includes("already registered") ||
    lowerCode === "user_already_exists"
  ) {
    return "An account with this email already exists. Try signing in instead.";
  }

  if (
    lower.includes("email not confirmed") ||
    lowerCode === "email_not_confirmed"
  ) {
    return "Please verify your email address to complete registration.";
  }

  if (
    lower.includes("jwt expired") ||
    lower.includes("session expired") ||
    lower.includes("token has expired") ||
    lower.includes("not authenticated") ||
    lower.includes("session may have expired") ||
    status === 401
  ) {
    return "Your session may have expired. Please sign in again.";
  }

  if (
    lower.includes("password should be at least") ||
    lower.includes("weak password") ||
    lower.includes("password must be at least")
  ) {
    return "Please choose a password with at least 6 characters.";
  }

  // 5. Verification Codes & OTP
  if (
    lower.includes("otp expired") ||
    lower.includes("code has expired") ||
    lower.includes("token has expired") ||
    lower.includes("verification code has expired")
  ) {
    return "This code has expired. Request a new verification code.";
  }

  if (
    lower.includes("already been used") ||
    lower.includes("already consumed")
  ) {
    return "This code has expired. Request a new verification code.";
  }

  if (
    lower.includes("invalid verification code") ||
    lower.includes("invalid code") ||
    lower.includes("token is invalid") ||
    lower.includes("invalid token") ||
    lower.includes("invalid otp") ||
    lower.includes("doesn't look right")
  ) {
    return "That code doesn't look right. Please check and try again.";
  }

  // 6. Security, Permissions & Database Leaks
  if (
    lower.includes("row-level security") ||
    lower.includes("permission denied") ||
    lower.includes("not authorized") ||
    lowerCode === "42501" ||
    status === 403
  ) {
    return "You don't have permission to perform this action.";
  }

  if (lower.includes("storage permission") || lower.includes("publicstorage")) {
    return "Storage permission is needed to save your report. Please allow access in device settings.";
  }

  if (
    lowerCode === "23505" ||
    lower.includes("duplicate key") ||
    lower.includes("unique constraint") ||
    lower.includes("already been recorded")
  ) {
    if (context === "insulin") return "This insulin dose has already been recorded.";
    if (context === "glucose") return "A reading for this exact time has already been recorded.";
    return "This record has already been saved.";
  }

  // 7. Context-specific technical suppression
  // Avoid leaking PostgREST, SQL, or internal column names to the patient
  if (
    lower.includes("pgrst") ||
    lower.includes("syntax error") ||
    lower.includes("relation") ||
    lower.includes("column") ||
    lower.includes("violates") ||
    lower.includes("null value in column")
  ) {
    return getContextDefaultError(context);
  }

  // 8. If message is already a short, clean, punctuation-safe sentence without technical jargon:
  if (rawMsg && !rawMsg.includes("{") && !rawMsg.includes("}") && !rawMsg.includes("http") && rawMsg.length < 90) {
    // If it mentions generic developer jargon, sanitize it
    if (lower.includes("something went wrong") || lower.includes("unexpected error")) {
      return "We couldn't complete that action right now. Please try again.";
    }
    if (lower.includes("failed to save") || lower.includes("request failed")) {
      return getContextDefaultError(context);
    }
    return rawMsg;
  }

  return getContextDefaultError(context);
}

/**
 * Provides a context-sensitive, empathetic default error message.
 */
function getContextDefaultError(context: MessageContext): string {
  switch (context) {
    case "glucose":
      return "We couldn't save your glucose reading. Please try again.";
    case "insulin":
      return "We couldn't save your insulin record. Please try again.";
    case "food":
      return "We couldn't save your food record. Please try again.";
    case "weight":
      return "We couldn't save your weight record. Please try again.";
    case "export":
    case "report":
      return "We couldn't create your report. Please try again.";
    case "profile":
      return "We couldn't save your profile changes. Please try again.";
    case "notifications":
      return "We couldn't update your reminder preferences. Please try again.";
    case "auth":
      return "We couldn't complete sign in. Please check your details and try again.";
    case "scanner":
      return "We couldn't scan your device screen. Please verify the numbers manually.";
    case "sync":
      return "Your data hasn't synced yet. We'll try again automatically when possible.";
    default:
      return "We couldn't complete that action. Please try again.";
  }
}

/**
 * Returns a warm, confirming success message for a completed patient action.
 */
export function getSuccessMessage(action: string, context?: Record<string, any>): string {
  switch (action) {
    // Glucose
    case "glucose_created":
      return "Your glucose reading has been saved.";
    case "glucose_updated":
      return "Your glucose reading has been updated.";
    case "glucose_deleted":
      return "Your glucose reading has been deleted.";

    // Insulin
    case "insulin_created":
    case "insulin_saved":
      return "Your insulin record has been saved.";
    case "insulin_updated":
      return "Your insulin record has been updated.";
    case "insulin_deleted":
      return "Your insulin record has been deleted.";
    case "insulin_all_done":
      return "All scheduled insulin doses are up to date.";

    // Food
    case "food_created":
      return "Your meal has been recorded.";
    case "food_updated":
      return "Your food record has been updated.";
    case "food_deleted":
      return "Your food record has been deleted.";

    // Weight
    case "weight_created":
      return "Your weight has been saved.";
    case "weight_updated":
      return "Your weight record has been updated.";
    case "weight_deleted":
      return "Your weight record has been deleted.";

    // Profile & Account
    case "profile_updated":
      return "Your profile has been updated.";
    case "password_updated":
      return "Your password has been updated. You can now sign in.";
    case "account_deleted":
      return "Your account and health records have been permanently deleted.";
    case "deletion_requested":
      return "Your account deletion request has been submitted.";

    // Reports
    case "pdf_downloaded":
      return "Your PDF report is ready.";
    case "xlsx_downloaded":
      return "Your spreadsheet has been downloaded.";
    case "report_saved_mobile":
      return context?.filename
        ? `Report saved! Open Documents -> GlucoLab to view: ${context.filename}`
        : "Your report has been saved to your device.";

    // Reminders & Notifications
    case "notifications_saved":
      return "Your reminder preferences have been saved.";
    case "notifications_enabled":
      return "Reminders are now enabled.";
    case "test_notification_sent":
      return "Test reminder sent. Look for it in your notification drawer.";

    // Settings
    case "backup_completed":
      return "Your health records have been backed up securely.";
    case "restore_completed":
      return "Your health records have been restored.";
    case "widget_presets_saved":
      return "Quick Insulin widget presets updated.";

    default:
      return "Changes saved successfully.";
  }
}

/**
 * Returns clean, human validation guidance for form fields.
 */
export function getValidationMessage(field: string, error?: string): string {
  switch (field) {
    case "glucose":
      return "Please enter a valid glucose reading.";
    case "insulin_units":
      return "Please enter a valid insulin dose using whole units.";
    case "email":
      return "Please enter a valid email address.";
    case "password":
      return "Please enter a password with at least 6 characters.";
    case "password_confirm":
      return "Passwords don't match. Please check and re-enter.";
    case "name":
      return "Please enter your full name.";
    case "otp_code":
      return "Please enter the complete 6-digit verification code.";
    case "date_time":
      return "Please select a valid date and time.";
    case "food_selection":
      return "Please select at least one food category or add a note.";
    case "weight":
      return "Please enter a valid weight in kilograms.";
    default:
      return error || "Please fill in this field to continue.";
  }
}

/**
 * Specialized network/connectivity failure messaging.
 */
export function getNetworkMessage(error?: unknown): string {
  return getUserFriendlyError(error, "sync");
}

/**
 * Helpful empty state messages for dashboard, history, and reports.
 */
export function getEmptyStateMessage(context: MessageContext, isFiltered = false): {
  title: string;
  description: string;
} {
  if (isFiltered) {
    return {
      title: "No matching entries",
      description: "No records match your search or date filters. Try adjusting your filters.",
    };
  }

  switch (context) {
    case "glucose":
      return {
        title: "No glucose readings yet",
        description: "Your readings will appear here once you start recording them.",
      };
    case "insulin":
      return {
        title: "No insulin records yet",
        description: "Your recorded insulin doses will appear here.",
      };
    case "food":
      return {
        title: "No food entries yet",
        description: "Meals and snacks you log will appear here to help identify patterns.",
      };
    case "weight":
      return {
        title: "No weight measurements yet",
        description: "Your recorded weight entries will appear here over time.",
      };
    case "report":
      return {
        title: "No reports yet",
        description: "There's not enough recorded data to create a summary report for this period.",
      };
    default:
      return {
        title: "Nothing to show here yet",
        description: "New information will appear here as you use GlucoLab.",
      };
  }
}

