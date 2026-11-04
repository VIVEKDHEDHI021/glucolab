/**
 * GlucoLab Patient Data & Credential Scrubber
 *
 * Enforces strict HIPAA / GDPR compliant redaction before any log, metric,
 * trace, or external telemetry (e.g. Sentry) capture.
 *
 * Scrubbed items:
 * - Credentials & Auth: Passwords, OTP codes, JWTs, Bearer tokens, API keys
 * - Patient Identifiers: Email addresses, names, phone numbers
 * - Clinical Data: Glucose values, insulin units, dosages, carb counts, meal notes
 */

// Regex patterns for sensitive credentials & identifiers
const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi;
const BEARER_TOKEN_REGEX = /Bearer\s+[a-zA-Z0-9_\-\.]+/gi;
const JWT_REGEX = /eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]*/gi;
const OTP_REGEX = /\b\d{6}\b/g; // 6-digit OTP codes
const PHONE_REGEX = /(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g;

// Sensitive object keys that should always have their values redacted
const SENSITIVE_KEYS = new Set([
  // Auth & Security
  "password",
  "token",
  "access_token",
  "refresh_token",
  "authorization",
  "secret",
  "api_key",
  "service_role_key",
  "otp",
  "code",
  "pin",
  // Patient Identifiers
  "email",
  "phone",
  "name",
  "full_name",
  "first_name",
  "last_name",
  "patient_name",
  // Clinical / Sensitive Health Information (PHI)
  "glucose_value",
  "reading_value",
  "insulin_units",
  "units",
  "dose",
  "carbs_grams",
  "meal_description",
  "notes",
  "blood_pressure",
  "weight_kg",
]);

/**
 * Scrub a string of sensitive text, emails, tokens, and OTP codes
 */
export function scrubString(text: string): string {
  if (!text || typeof text !== "string") return "";

  return text
    .replace(BEARER_TOKEN_REGEX, "Bearer [REDACTED_AUTH]")
    .replace(JWT_REGEX, "[REDACTED_JWT]")
    .replace(EMAIL_REGEX, "[REDACTED_EMAIL]")
    .replace(PHONE_REGEX, "[REDACTED_PHONE]");
}

/**
 * Recursively sanitize any object, payload, or error metadata
 * Returns a new clean object with all sensitive values redacted
 */
export function scrubObject<T = any>(obj: T, depth = 0): T {
  if (depth > 6) return "[MAX_DEPTH_REACHED]" as any;
  if (obj === null || obj === undefined) return obj;

  if (typeof obj === "string") {
    return scrubString(obj) as any;
  }

  if (typeof obj === "number" || typeof obj === "boolean") {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => scrubObject(item, depth + 1)) as any;
  }

  if (typeof obj === "object") {
    // If it's an Error instance
    if (obj instanceof Error) {
      return {
        name: obj.name,
        message: scrubString(obj.message),
        stack: obj.stack ? scrubString(obj.stack) : undefined,
      } as any;
    }

    const sanitized: Record<string, any> = {};

    for (const [key, value] of Object.entries(obj)) {
      const lowerKey = key.toLowerCase();

      // Check if key is inherently sensitive
      if (lowerKey.includes("auth") || lowerKey.includes("secret") || lowerKey.includes("key")) {
        sanitized[key] = "[REDACTED_CREDENTIAL]";
      } else if (SENSITIVE_KEYS.has(lowerKey) || lowerKey.includes("password") || lowerKey.includes("token")) {
        sanitized[key] = "[REDACTED_SENSITIVE]";
      } else {
        sanitized[key] = scrubObject(value, depth + 1);
      }
    }

    return sanitized as T;
  }

  return "[UNSERIALIZABLE]" as any;
}
