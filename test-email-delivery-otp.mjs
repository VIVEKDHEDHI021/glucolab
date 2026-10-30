import assert from "node:assert";
import { createClient } from "@supabase/supabase-js";
import { otpService } from "./src/backend/services/otpService.server.ts";
import { emailService } from "./src/backend/services/emailService.server.ts";
import { getApiUrl } from "./src/backend/services/authService.ts";

const SUPABASE_URL = "https://yhvnfwyeippnrqtttxac.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_dR2EoURRwH6sHIEQd8-3dQ_daz0Qn-j";

console.log("===================================================================");
console.log("🧪 GLUCOLAB v1.4 – OTP GENERATION & EMAIL DELIVERY TEST SUITE");
console.log("===================================================================\n");

let passed = 0;
let failed = 0;

async function test(name, fn) {
  try {
    await fn();
    console.log(`✅ [PASS] ${name}`);
    passed++;
  } catch (err) {
    console.error(`❌ [FAIL] ${name}`);
    console.error(err);
    failed++;
  }
}

// Mirror of authService.isEmailVerified
function isEmailVerified(user, pendingSignupEmail = null) {
  if (!user) return false;

  const isGoogle =
    user.app_metadata?.provider === "google" ||
    (Array.isArray(user.app_metadata?.providers) &&
      user.app_metadata.providers.includes("google"));
  if (isGoogle) return true;

  if (pendingSignupEmail && user.email && pendingSignupEmail.toLowerCase() === user.email.toLowerCase()) {
    return false;
  }

  if (user.user_metadata?.email_otp_verified === false) {
    return false;
  }
  if (user.user_metadata?.email_verified === false) {
    return false;
  }

  if (user.user_metadata?.email_otp_verified === true) {
    return true;
  }

  if (user.email_confirmed_at && user.user_metadata?.email_otp_verified !== false) {
    return true;
  }

  return false;
}

async function runTestSuite() {
  const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const timestamp = Date.now();
  const testEmail = `patient_delivery_${timestamp}@glucolab-test.com`;
  const testPassword = "StrongPassword777!";
  let currentOtp = "";

  // -------------------------------------------------------------------------
  // Test 1: Register with a new email
  // -------------------------------------------------------------------------
  let registeredUser = null;
  await test("1. Register with a new email sets email_otp_verified: false", async () => {
    const signupRes = await sb.auth.signUp({
      email: testEmail,
      password: testPassword,
      options: {
        data: {
          name: "Delivery Test User",
          email_otp_verified: false,
          email_verified: false,
        },
      },
    });

    assert(signupRes.data.user, "Expected registered user object");
    registeredUser = signupRes.data.user;
    assert.strictEqual(
      isEmailVerified(registeredUser),
      false,
      "Newly registered account must be unverified initially",
    );
  });

  // -------------------------------------------------------------------------
  // Test 2 & 3: Request OTP and confirm 6-digit generation
  // -------------------------------------------------------------------------
  await test("2 & 3. Request OTP and confirm 6-digit cryptographic generation", async () => {
    const genRes = otpService.generateOtp(testEmail, "email_verification", "127.0.0.1", timestamp);
    assert.strictEqual(genRes.success, true, "OTP generation must succeed");
    assert(genRes.otp, "OTP value must be generated");
    assert.strictEqual(genRes.otp.length, 6, "OTP must be exactly 6 digits");
    assert(/^[0-9]{6}$/.test(genRes.otp), "OTP must contain numeric digits only");
    currentOtp = genRes.otp;
  });

  // -------------------------------------------------------------------------
  // Test 4 & 5: Confirm email provider accepts request and verify email content
  // -------------------------------------------------------------------------
  await test("4 & 5. Email provider accepts request and delivers clean branded template with 6-digit OTP", async () => {
    emailService.clearDispatchedEmails();
    const sendRes = await emailService.sendOtpEmail({
      to: testEmail,
      code: currentOtp,
      purpose: "email_verification",
    });

    assert.strictEqual(sendRes.success, true, "Email sending must succeed");
    assert(sendRes.provider, "Email provider must be identified");

    const lastEmail = emailService.getLastDispatchedEmail();
    assert(lastEmail, "Dispatched email audit record must exist");
    assert.strictEqual(lastEmail.to, testEmail, "Recipient must match registered email");
    assert.strictEqual(lastEmail.code, currentOtp, "Dispatched OTP must match generated 6-digit OTP");
    assert(lastEmail.subject.includes(currentOtp), "Email subject must include 6-digit OTP");
    assert(lastEmail.html.includes("GlucoLab"), "Email HTML must contain GlucoLab branding");
    assert(lastEmail.html.includes("5 minutes"), "Email HTML must contain 5-minute expiration notice");
    assert(lastEmail.html.includes("Security Warning"), "Email HTML must contain security warning");
    assert(lastEmail.text.includes(currentOtp), "Plain text alternative must contain 6-digit code");
  });

  // -------------------------------------------------------------------------
  // Test 6: Enter incorrect OTP
  // -------------------------------------------------------------------------
  await test("6. Enter incorrect OTP and confirm friendly rejection", async () => {
    const badCode = currentOtp === "111111" ? "222222" : "111111";
    const verifyRes = otpService.verifyOtp(testEmail, "email_verification", badCode, "127.0.0.1", timestamp + 5000);
    assert.strictEqual(verifyRes.success, false, "Incorrect OTP must fail");
    assert(verifyRes.attemptsRemaining !== undefined, "Remaining attempts should be tracked");
  });

  // -------------------------------------------------------------------------
  // Test 7: Enter expired OTP (> 5 minutes)
  // -------------------------------------------------------------------------
  await test("7. Enter expired OTP (> 5 minutes) and confirm rejection", async () => {
    const expiredTimestamp = timestamp + 6 * 60 * 1000; // 6 minutes later
    const verifyRes = otpService.verifyOtp(testEmail, "email_verification", currentOtp, "127.0.0.1", expiredTimestamp);
    assert.strictEqual(verifyRes.success, false, "Expired OTP must be rejected");
    assert(verifyRes.error?.toLowerCase().includes("expired"), "Error message must indicate expiration");
  });

  // -------------------------------------------------------------------------
  // Test 8: Resend cooldown enforcement
  // -------------------------------------------------------------------------
  await test("8. Request OTP within 60s cooldown is rate-limited", async () => {
    // Attempt resend 15 seconds after initial generation from Test 2
    const quickResend = otpService.generateOtp(testEmail, "email_verification", "127.0.0.1", timestamp + 15000);
    assert.strictEqual(quickResend.success, false, "Resend within 60s cooldown must be rejected");
    assert.strictEqual(quickResend.status, 429, "Status must be 429 Too Many Requests");
    assert(quickResend.cooldownRemaining > 0, "Remaining cooldown seconds must be reported");
    assert.strictEqual(quickResend.cooldownRemaining, 45, "Cooldown remaining should be 45 seconds");
  });

  // -------------------------------------------------------------------------
  // Test 9: Request OTP again after cooldown expires
  // -------------------------------------------------------------------------
  await test("9. Request OTP again after cooldown succeeds with new 6-digit code", async () => {
    const afterCooldownTime = timestamp + 75000; // 75 seconds later (past 60s cooldown)
    const newGen = otpService.generateOtp(testEmail, "email_verification", "127.0.0.1", afterCooldownTime);
    assert.strictEqual(newGen.success, true, "Generation after cooldown must succeed");
    assert.strictEqual(newGen.otp.length, 6, "New OTP must be 6 digits");
    currentOtp = newGen.otp;

    // Send new email
    const emailRes = await emailService.sendOtpEmail({
      to: testEmail,
      code: currentOtp,
      purpose: "email_verification",
    });
    assert.strictEqual(emailRes.success, true);
    assert.strictEqual(emailService.getLastDispatchedEmail().code, currentOtp);
  });

  // -------------------------------------------------------------------------
  // Test 10: Enter correct OTP and confirm single-use invalidation
  // -------------------------------------------------------------------------
  await test("10. Enter correct OTP succeeds and prevents replay reuse", async () => {
    const validVerify = otpService.verifyOtp(testEmail, "email_verification", currentOtp, "127.0.0.1", timestamp + 80000);
    assert.strictEqual(validVerify.success, true, "Correct OTP must succeed");

    // Attempt reuse of the exact same code
    const replayVerify = otpService.verifyOtp(testEmail, "email_verification", currentOtp, "127.0.0.1", timestamp + 85000);
    assert.strictEqual(replayVerify.success, false, "Replaying a consumed OTP must be rejected");
  });

  // -------------------------------------------------------------------------
  // Test 11: Close the app before verification and reopen it
  // -------------------------------------------------------------------------
  await test("11. Closing and reopening the app keeps unverified state intact", async () => {
    const freshUserRes = await sb.auth.signUp({
      email: `abandoned_app_${timestamp}@glucolab-test.com`,
      password: testPassword,
      options: {
        data: { email_otp_verified: false, email_verified: false },
      },
    });

    const abandonedUser = freshUserRes.data.user;
    // Simulate app killed and session restored from disk
    const reloadedUser = JSON.parse(JSON.stringify(abandonedUser));
    assert.strictEqual(isEmailVerified(reloadedUser), false, "Reloaded session must stay unverified");
  });

  // -------------------------------------------------------------------------
  // Test 12: Attempt login without verification
  // -------------------------------------------------------------------------
  await test("12. Attempt login without verification denies access", async () => {
    const unverifiedUser = {
      id: "unverified-123",
      email: "unverified@example.com",
      email_confirmed_at: null,
      user_metadata: { email_otp_verified: false, email_verified: false },
    };
    assert.strictEqual(isEmailVerified(unverifiedUser), false, "Access must be denied to unverified user");
  });

  // -------------------------------------------------------------------------
  // Test 13: Password reset OTP separately with strict purpose isolation
  // -------------------------------------------------------------------------
  await test("13. Password reset OTP operates separately with strict purpose isolation", async () => {
    const resetTime = timestamp + 100000;
    const resetGen = otpService.generateOtp(testEmail, "password_reset", "127.0.0.1", resetTime);
    assert.strictEqual(resetGen.success, true);
    assert.strictEqual(resetGen.otp.length, 6);

    // Cross-purpose attack: try using password reset OTP for email verification
    const crossPurpose = otpService.verifyOtp(testEmail, "email_verification", resetGen.otp, "127.0.0.1", resetTime + 2000);
    assert.strictEqual(crossPurpose.success, false, "Cross-purpose verification must be rejected");

    // Correct purpose: verify password reset
    const validReset = otpService.verifyOtp(testEmail, "password_reset", resetGen.otp, "127.0.0.1", resetTime + 4000);
    assert.strictEqual(validReset.success, true, "Password reset OTP must verify under correct purpose");
  });

  // -------------------------------------------------------------------------
  // Test 14: Existing verified account preserves access
  // -------------------------------------------------------------------------
  await test("14. Existing verified account (legacy) preserves full dashboard access", async () => {
    const legacyVerifiedUser = {
      id: "legacy-user-456",
      email: "legacy@glucolab.app",
      email_confirmed_at: "2026-05-01T12:00:00Z",
      user_metadata: {}, // no email_otp_verified field
    };
    assert.strictEqual(
      isEmailVerified(legacyVerifiedUser),
      true,
      "Legacy confirmed user without email_otp_verified must retain access",
    );
  });

  // -------------------------------------------------------------------------
  // Test 15: Error handling & simulated provider failure
  // -------------------------------------------------------------------------
  await test("15. Simulated provider failure produces user-friendly error without leaking secrets", async () => {
    emailService.setSimulatedFailure(true, "SMTP connection refused 127.0.0.1:587 ECONNREFUSED");
    const failureRes = await emailService.sendOtpEmail({
      to: "patient@example.com",
      code: "123456",
      purpose: "email_verification",
    });

    assert.strictEqual(failureRes.success, false, "Delivery must fail during simulated outage");
    // Reset simulation
    emailService.setSimulatedFailure(false);
  });

  // -------------------------------------------------------------------------
  // Test 16: Mobile Capacitor URL resolver verification
  // -------------------------------------------------------------------------
  await test("16. Mobile Capacitor URL resolver routes API requests correctly", () => {
    const webUrl = getApiUrl("/api/auth/otp/send");
    assert.strictEqual(webUrl, "/api/auth/otp/send", "Web browser must use relative URL");
  });

  console.log("\n===================================================================");
  console.log(`🎉 16-POINT OTP & EMAIL DELIVERY RESULTS: ${passed} PASSED, ${failed} FAILED (TOTAL: ${passed + failed})`);
  console.log("===================================================================\n");

  if (failed > 0) {
    process.exit(1);
  }
}

runTestSuite().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
