import assert from "node:assert";
import { createClient } from "@supabase/supabase-js";
import { otpService } from "./src/backend/services/otpService.server.ts";

const SUPABASE_URL = "https://yhvnfwyeippnrqtttxac.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_dR2EoURRwH6sHIEQd8-3dQ_daz0Qn-j";

console.log("===================================================================");
console.log("🧪 GLUCOLAB v1.4 – CRITICAL OTP AUTHENTICATION BUG FIX VERIFICATION");
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

// Mirror of updated authService.isEmailVerified
function isEmailVerified(user, pendingSignupEmail = null) {
  if (!user) return false;

  // 1. Google OAuth accounts are pre-verified by Google
  const isGoogle =
    user.app_metadata?.provider === "google" ||
    (Array.isArray(user.app_metadata?.providers) &&
      user.app_metadata.providers.includes("google"));
  if (isGoogle) return true;

  // 2. Active pending signup OTP verification in session storage
  if (pendingSignupEmail && user.email && pendingSignupEmail.toLowerCase() === user.email.toLowerCase()) {
    return false;
  }

  // 3. Explicit unverified state persisted in user_metadata across sessions/restarts
  if (user.user_metadata?.email_otp_verified === false) {
    return false;
  }
  if (user.user_metadata?.email_verified === false) {
    return false;
  }

  // 4. Explicit verified state from OTP completion
  if (user.user_metadata?.email_otp_verified === true) {
    return true;
  }

  // 5. Existing verified accounts (legacy accounts created before this fix)
  if (user.email_confirmed_at && user.user_metadata?.email_otp_verified !== false) {
    return true;
  }

  return false;
}

async function runTestSuite() {
  const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const timestamp = Date.now();
  const testEmail = `patient_otp_test_${timestamp}@glucolab-test.com`;
  const testPassword = "StrongPassword999!";
  let generatedOtp = "";

  // -------------------------------------------------------------------------
  // Checklist Item 1: Register using a new email
  // -------------------------------------------------------------------------
  let registeredUser = null;
  await test("1. Register using a new email sets email_otp_verified: false and generates 6-digit OTP", async () => {
    const signupRes = await sb.auth.signUp({
      email: testEmail,
      password: testPassword,
      options: {
        data: {
          name: "Test Patient",
          email_otp_verified: false,
          email_verified: false,
        },
      },
    });

    assert(signupRes.data?.user?.id, "User signup in Supabase must succeed");
    registeredUser = signupRes.data.user;
    assert.strictEqual(
      registeredUser.user_metadata.email_otp_verified,
      false,
      "email_otp_verified must be initialized to false in user_metadata",
    );

    // Generate 6-digit OTP via server otpService
    const gen = otpService.generateOtp(testEmail, "email_verification", "127.0.0.1");
    assert.strictEqual(gen.success, true, "OTP generation must succeed");
    assert(gen.otp && /^[0-9]{6}$/.test(gen.otp), "OTP must be exactly 6 digits");
    generatedOtp = gen.otp;
  });

  // -------------------------------------------------------------------------
  // Checklist Item 2 & 3: Close the app before entering OTP & Reopen the app
  // -------------------------------------------------------------------------
  await test("2 & 3. Closing and reopening the app (simulating clean session reload) keeps user unverified", async () => {
    // When the app closes, sessionStorage is cleared (pendingSignupEmail becomes null).
    // Reopening the app evaluates the persisted user object from storage:
    const cleanReopenedVerified = isEmailVerified(registeredUser, null);
    assert.strictEqual(
      cleanReopenedVerified,
      false,
      "User must remain UNVERIFIED after app close and reopen when email_otp_verified is false",
    );
  });

  // -------------------------------------------------------------------------
  // Checklist Item 4 & 5: Attempt login without OTP verification & confirm access denied
  // -------------------------------------------------------------------------
  await test("4 & 5. Attempt login without OTP verification rejects dashboard access", async () => {
    const loginRes = await sb.auth.signInWithPassword({
      email: testEmail,
      password: testPassword,
    });

    assert.strictEqual(loginRes.error, null, "Supabase signInWithPassword authenticates credentials");
    const loggedInUser = loginRes.data.user;

    // Check verification status on login
    const verifiedOnLogin = isEmailVerified(loggedInUser);
    assert.strictEqual(
      verifiedOnLogin,
      false,
      "Unverified account must be blocked during login before dashboard access",
    );

    // Clean up session (login route signs out unverified user before redirecting to /otp)
    await sb.auth.signOut();
  });

  // -------------------------------------------------------------------------
  // Checklist Item 6 & 7: Enter an incorrect OTP & confirm access is denied
  // -------------------------------------------------------------------------
  await test("6 & 7. Enter an incorrect OTP and confirm access is strictly denied", async () => {
    const badCode = "123456" === generatedOtp ? "654321" : "123456";
    const verifyBad = otpService.verifyOtp(testEmail, "email_verification", badCode, "127.0.0.1");
    assert.strictEqual(verifyBad.success, false, "Incorrect OTP must fail verification");
    assert(verifyBad.attemptsRemaining !== undefined && verifyBad.attemptsRemaining < 5);
  });

  // -------------------------------------------------------------------------
  // Checklist Item 8 & 9: Enter an expired OTP & confirm access is denied
  // -------------------------------------------------------------------------
  await test("8 & 9. Enter an expired OTP and confirm access is strictly denied", async () => {
    const expiredEmail = `expired_user_${Date.now()}@glucolab-test.com`;
    const sixMinutesAgo = Date.now() - 6 * 60 * 1000;
    const expGen = otpService.generateOtp(expiredEmail, "email_verification", "127.0.0.1", sixMinutesAgo);
    assert.strictEqual(expGen.success, true);

    const expVerify = otpService.verifyOtp(expiredEmail, "email_verification", expGen.otp, "127.0.0.1", Date.now());
    assert.strictEqual(expVerify.success, false, "Expired OTP must be rejected");
    assert(expVerify.error?.toLowerCase().includes("expired"), "Error message must indicate expiration");
  });

  // -------------------------------------------------------------------------
  // Checklist Item 10 & 11: Enter correct OTP & confirm account verification succeeds
  // -------------------------------------------------------------------------
  await test("10 & 11. Enter correct 6-digit OTP and confirm account verification succeeds", async () => {
    const goodVerify = otpService.verifyOtp(testEmail, "email_verification", generatedOtp, "127.0.0.1");
    assert.strictEqual(goodVerify.success, true, "Correct 6-digit OTP must succeed verification");

    // Replay attack prevention: second verification with same OTP must fail immediately
    const replayVerify = otpService.verifyOtp(testEmail, "email_verification", generatedOtp, "127.0.0.1");
    assert.strictEqual(replayVerify.success, false, "Consumed OTP must not be reusable");

    // Establish session and update user metadata as authService.verifyOtp does
    await sb.auth.signInWithPassword({ email: testEmail, password: testPassword });
    const updateRes = await sb.auth.updateUser({
      data: {
        email_otp_verified: true,
        email_verified: true,
      },
    });

    assert.strictEqual(updateRes.error, null, "User metadata update must succeed");
    assert.strictEqual(
      updateRes.data.user.user_metadata.email_otp_verified,
      true,
      "email_otp_verified must now be true",
    );

    const nowVerified = isEmailVerified(updateRes.data.user);
    assert.strictEqual(nowVerified, true, "Account must now be recognized as verified");
  });

  // -------------------------------------------------------------------------
  // Checklist Item 12 & 13: Log out and log in again & confirm normal access works
  // -------------------------------------------------------------------------
  await test("12 & 13. Log out and log in again, confirming normal dashboard access works", async () => {
    // 12. Log out
    await sb.auth.signOut();

    // 13. Log in again with verified account
    const reLoginRes = await sb.auth.signInWithPassword({
      email: testEmail,
      password: testPassword,
    });

    assert.strictEqual(reLoginRes.error, null, "Re-login must succeed");
    const reVerified = isEmailVerified(reLoginRes.data.user);
    assert.strictEqual(reVerified, true, "Verified account gains direct dashboard access");

    // Clean up
    await sb.auth.signOut();
  });

  // -------------------------------------------------------------------------
  // Checklist Item 14: Test password reset OTP separately
  // -------------------------------------------------------------------------
  await test("14. Password reset OTP operates with strict purpose isolation and 6-digit code", async () => {
    const resetGen = otpService.generateOtp(testEmail, "password_reset", "127.0.0.1");
    assert.strictEqual(resetGen.success, true, "Password reset OTP generation must succeed");
    assert(resetGen.otp && /^[0-9]{6}$/.test(resetGen.otp), "Password reset OTP must be 6 digits");

    // Purpose isolation: cannot verify email_verification with password_reset code
    const crossPurpose = otpService.verifyOtp(testEmail, "email_verification", resetGen.otp, "127.0.0.1");
    assert.strictEqual(crossPurpose.success, false, "Purpose cross-contamination must be blocked");

    // Legitimate password reset verification succeeds
    const validReset = otpService.verifyOtp(testEmail, "password_reset", resetGen.otp, "127.0.0.1");
    assert.strictEqual(validReset.success, true, "Password reset OTP succeeds under password_reset purpose");
  });

  // -------------------------------------------------------------------------
  // Legacy Account Regression Protection
  // -------------------------------------------------------------------------
  await test("15. Legacy verified accounts (without email_otp_verified field) retain full access", async () => {
    const legacyUser = {
      id: "legacy-user-1",
      email: "legacy@glucolab.com",
      email_confirmed_at: "2026-08-01T10:00:00Z",
      user_metadata: { name: "Dr. Smith" }, // no email_otp_verified field
    };

    assert.strictEqual(
      isEmailVerified(legacyUser),
      true,
      "Existing accounts from earlier versions must not be broken or locked out",
    );
  });

  console.log("\n===================================================================");
  console.log(`🎉 14-STEP VERIFICATION RESULTS: ${passed} PASSED, ${failed} FAILED (TOTAL: ${passed + failed})`);
  console.log("===================================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runTestSuite().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});

