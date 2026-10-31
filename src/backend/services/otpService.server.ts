import { randomInt, createHmac, timingSafeEqual } from "node:crypto";

export type OtpPurpose = "email_verification" | "login_verification" | "password_reset";

interface OtpRecord {
  id: string;
  email: string;
  purpose: OtpPurpose;
  hash: string;
  createdAt: number;
  expiresAt: number;
  attempts: number;
  maxAttempts: number;
  consumed: boolean;
  ipAddress?: string;
}

interface RateLimitRecord {
  requests: number[];
  verifications: number[];
}

// In-memory store for OTP records and rate limiting (thread-safe in single-process node server)
const otpStore = new Map<string, OtpRecord>(); // key: `${email.toLowerCase()}:${purpose}`
const rateLimitStore = new Map<string, RateLimitRecord>(); // key: IP or email
const cooldownStore = new Map<string, number>(); // key: `${email.toLowerCase()}:${purpose}`, value: timestamp

const OTP_VALIDITY_MS = 5 * 60 * 1000; // 5 minutes
const COOLDOWN_MS = 60 * 1000; // 60 seconds
const MAX_ATTEMPTS = 5;
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const MAX_REQUESTS_PER_WINDOW = 5;
const MAX_VERIFICATIONS_PER_WINDOW = 15;

const OTP_SECRET =
  process.env.OTP_SECRET ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  "glucolab-v2-secure-otp-secret-key-salt";

function hashOtp(email: string, purpose: OtpPurpose, otp: string): string {
  return createHmac("sha256", OTP_SECRET)
    .update(`${email.toLowerCase()}:${purpose}:${otp.trim()}`)
    .digest("hex");
}

function cleanExpiredRecords() {
  const now = Date.now();
  for (const [key, record] of otpStore.entries()) {
    if (now > record.expiresAt + 60000 || record.consumed) {
      otpStore.delete(key);
    }
  }
  for (const [key, rl] of rateLimitStore.entries()) {
    rl.requests = rl.requests.filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
    rl.verifications = rl.verifications.filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
    if (rl.requests.length === 0 && rl.verifications.length === 0) {
      rateLimitStore.delete(key);
    }
  }
}

export const otpService = {
  /**
   * Generates a cryptographically secure 6-digit OTP, stores its hash with expiration,
   * enforces 60-second resend cooldown, invalidates older OTPs for the same purpose,
   * and enforces IP and email rate limiting.
   */
  generateOtp(
    email: string,
    purpose: OtpPurpose,
    ipAddress?: string,
    now: number = Date.now(),
  ): {
    success: boolean;
    otp?: string;
    cooldownRemaining?: number;
    error?: string;
    status?: number;
  } {
    cleanExpiredRecords();
    const cleanEmail = email.trim().toLowerCase();
    const storeKey = `${cleanEmail}:${purpose}`;

    // 1. Rate limiting by IP and by Email
    const identifiers = [cleanEmail];
    if (ipAddress) identifiers.push(ipAddress);

    for (const id of identifiers) {
      let rl = rateLimitStore.get(id);
      if (!rl) {
        rl = { requests: [], verifications: [] };
        rateLimitStore.set(id, rl);
      }
      rl.requests = rl.requests.filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
      if (rl.requests.length >= MAX_REQUESTS_PER_WINDOW) {
        return {
          success: false,
          error: "Too many OTP requests. Please wait before trying again.",
          status: 429,
        };
      }
    }

    // 2. 60-second resend cooldown enforcement
    const lastIssued = cooldownStore.get(storeKey);
    if (lastIssued && now - lastIssued < COOLDOWN_MS) {
      const remainingSeconds = Math.ceil((COOLDOWN_MS - (now - lastIssued)) / 1000);
      return {
        success: false,
        cooldownRemaining: remainingSeconds,
        error: `Please wait ${remainingSeconds} seconds before requesting a new code.`,
        status: 429,
      };
    }

    // 3. Cryptographically secure 6-digit OTP generation (100000 - 999999)
    const otpNumber = randomInt(100000, 1000000);
    const otp = otpNumber.toString();

    // 4. Secure hashing
    const hash = hashOtp(cleanEmail, purpose, otp);

    // 5. Invalidate / supersede previous OTP for this email & purpose
    otpStore.delete(storeKey);

    // 6. Save new OTP record
    otpStore.set(storeKey, {
      id: crypto.randomUUID(),
      email: cleanEmail,
      purpose,
      hash,
      createdAt: now,
      expiresAt: now + OTP_VALIDITY_MS,
      attempts: 0,
      maxAttempts: MAX_ATTEMPTS,
      consumed: false,
      ipAddress,
    });

    // 7. Update cooldown and rate limits
    cooldownStore.set(storeKey, now);
    for (const id of identifiers) {
      rateLimitStore.get(id)?.requests.push(now);
    }

    return {
      success: true,
      otp,
    };
  },

  /**
   * Verifies an OTP for a specific email and purpose.
   * Enforces purpose isolation, expiration (5 min), max attempts (5),
   * rate limits, and invalidates on success (replay attack prevention).
   */
  verifyOtp(
    email: string,
    purpose: OtpPurpose,
    candidateOtp: string,
    ipAddress?: string,
    now: number = Date.now(),
  ): {
    success: boolean;
    error?: string;
    status?: number;
    attemptsRemaining?: number;
  } {
    cleanExpiredRecords();
    const cleanEmail = email.trim().toLowerCase();
    const storeKey = `${cleanEmail}:${purpose}`;

    // 1. Rate limiting on verification attempts
    const identifiers = [cleanEmail];
    if (ipAddress) identifiers.push(ipAddress);

    for (const id of identifiers) {
      let rl = rateLimitStore.get(id);
      if (!rl) {
        rl = { requests: [], verifications: [] };
        rateLimitStore.set(id, rl);
      }
      rl.verifications = rl.verifications.filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
      if (rl.verifications.length >= MAX_VERIFICATIONS_PER_WINDOW) {
        return {
          success: false,
          error: "Too many verification attempts. Please wait before trying again.",
          status: 429,
        };
      }
      rl.verifications.push(now);
    }

    // 2. Fetch record
    const record = otpStore.get(storeKey);
    if (!record) {
      return {
        success: false,
        error: "Verification code is invalid or has expired. Please request a new code.",
        status: 400,
      };
    }

    // 3. Prevent reuse / already consumed
    if (record.consumed) {
      return {
        success: false,
        error: "This verification code has already been used. Please request a new code.",
        status: 400,
      };
    }

    // 4. Strict Purpose enforcement
    if (record.purpose !== purpose) {
      return {
        success: false,
        error: "Invalid verification purpose.",
        status: 400,
      };
    }

    // 5. Expiration check (5 minutes)
    if (now > record.expiresAt) {
      otpStore.delete(storeKey);
      return {
        success: false,
        error: "This verification code has expired. Please request a new code.",
        status: 400,
      };
    }

    // 6. Max attempts check (5 attempts)
    if (record.attempts >= record.maxAttempts) {
      otpStore.delete(storeKey);
      return {
        success: false,
        error: "Maximum verification attempts exceeded. Please request a new code.",
        status: 429,
      };
    }

    // 7. Increment attempt count
    record.attempts += 1;

    // 8. Timing-safe candidate comparison
    const candidateHash = hashOtp(cleanEmail, purpose, candidateOtp);
    const recordHashBuffer = Buffer.from(record.hash, "hex");
    const candidateHashBuffer = Buffer.from(candidateHash, "hex");

    const isMatch =
      recordHashBuffer.length === candidateHashBuffer.length &&
      timingSafeEqual(recordHashBuffer, candidateHashBuffer);

    if (!isMatch) {
      const remaining = record.maxAttempts - record.attempts;
      if (remaining <= 0) {
        otpStore.delete(storeKey);
        return {
          success: false,
          error: "Maximum verification attempts exceeded. Please request a new code.",
          status: 429,
          attemptsRemaining: 0,
        };
      }
      return {
        success: false,
        error: `Invalid verification code. ${remaining} attempt${remaining === 1 ? "" : "s"} remaining.`,
        status: 400,
        attemptsRemaining: remaining,
      };
    }

    // 9. Invalidate immediately on success to prevent replay attacks
    record.consumed = true;
    otpStore.delete(storeKey);

    return {
      success: true,
    };
  },

  /**
   * Check cooldown status for an email and purpose.
   */
  getCooldownRemaining(email: string, purpose: OtpPurpose): number {
    const cleanEmail = email.trim().toLowerCase();
    const storeKey = `${cleanEmail}:${purpose}`;
    const lastIssued = cooldownStore.get(storeKey);
    if (!lastIssued) return 0;
    const elapsed = Date.now() - lastIssued;
    return elapsed < COOLDOWN_MS ? Math.ceil((COOLDOWN_MS - elapsed) / 1000) : 0;
  },

  /**
   * Terminates / invalidates an active OTP verification request for an email and purpose.
   * Useful when a user cannot provide an OTP in time or voluntarily cancels the request.
   */
  terminateOtp(email: string, purpose: OtpPurpose): boolean {
    cleanExpiredRecords();
    const cleanEmail = email.trim().toLowerCase();
    const storeKey = `${cleanEmail}:${purpose}`;
    const record = otpStore.get(storeKey);
    if (record) {
      record.consumed = true;
      otpStore.delete(storeKey);
      return true;
    }
    return false;
  },

  /**
   * Reset store (useful for automated testing)
   */
  _clearForTesting() {
    otpStore.clear();
    rateLimitStore.clear();
    cooldownStore.clear();
  },
};
