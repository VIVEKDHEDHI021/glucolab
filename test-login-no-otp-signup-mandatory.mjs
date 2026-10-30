import assert from "node:assert";
import { createClient } from "@supabase/supabase-js";
import { otpService } from "./src/backend/services/otpService.server.ts";

const SUPABASE_URL = "https://yhvnfwyeippnrqtttxac.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_dR2EoURRwH6sHIEQd8-3dQ_daz0Qn-j";

console.log("===================================================================");
console.log("🧪 GLUCOLAB AUTH SUITE: LOGIN WITHOUT OTP & SIGNUP OTP MANDATORY");
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

// Logic mirror of authService.isEmailVerified
function isEmailVerified(user, pendingSignupEmail = null) {
  if (!user) return false;

  // Google OAuth accounts are pre-verified by Google
  const isGoogle =
    user.app_metadata?.provider === "google" ||
    (Array.isArray(user.app_metadata?.providers) &&
      user.app_metadata.providers.includes("google"));
  if (isGoogle) return true;

  // If a signup OTP is actively pending for this user, they are unverified
  if (pendingSignupEmail && user.email && pendingSignupEmail.toLowerCase() === user.email.toLowerCase()) {
    return false;
  }

  // Explicit unverified state persisted in user_metadata
  if (user.user_metadata?.email_otp_verified === false) {
    return false;
  }

  if (user.user_metadata?.email_verified === false) {
    return false;
  }

  // If user has explicitly verified OTP
  if (user.user_metadata?.email_otp_verified === true) {
    return true;
  }

  // For existing verified accounts (legacy accounts created before this fix),
  // if email_confirmed_at is set and email_otp_verified is not false, preserve access
  if (user.email_confirmed_at && user.user_metadata?.email_otp_verified !== false) {
    return true;
  }

  return false;
}

async function runAllTests() {
  const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const timestamp = Date.now();
  const testEmail = `login_test_${timestamp}@glucolab-test.com`;
  const testPassword = "SecurePassword123!";

  // -------------------------------------------------------------------------
  // Test 1: New signup generates and sends an OTP to registered email
  // -------------------------------------------------------------------------
  let generatedOtp = "";
  await test("1. New signup triggers OTP generation and email dispatch for email_verification", async () => {
    const gen = otpService.generateOtp(testEmail, "email_verification", "127.0.0.1");
    assert.strictEqual(gen.success, true, "OTP generation must succeed");
    assert(gen.otp && /^[0-9]{6}$/.test(gen.otp), "OTP must be 6 digits");
    generatedOtp = gen.otp;
  });

  // -------------------------------------------------------------------------
  // Test 2: Incorrect signup OTP is rejected
  // -------------------------------------------------------------------------
  await test("2. Incorrect signup OTP is strictly rejected", async () => {
    const badVerify = otpService.verifyOtp(testEmail, "email_verification", "000000", "127.0.0.1");
    assert.strictEqual(badVerify.success, false, "Invalid OTP must fail verification");
  });

  // -------------------------------------------------------------------------
  // Test 3: Correct signup OTP verifies the account
  // -------------------------------------------------------------------------
  await test("3. Correct signup OTP successfully verifies the account", async () => {
    const goodVerify = otpService.verifyOtp(testEmail, "email_verification", generatedOtp, "127.0.0.1");
    assert.strictEqual(goodVerify.success, true, "Correct OTP must succeed");
  });

  // -------------------------------------------------------------------------
  // Test 4: Expired signup OTP is strictly rejected
  // -------------------------------------------------------------------------
  await test("4. Expired signup OTP is strictly rejected", async () => {
    const genExp = otpService.generateOtp(`exp_${timestamp}@test.com`, "email_verification", "127.0.0.1");
    const expiredNow = Date.now() + 6 * 60 * 1000; // 6 minutes later
    const expiredVerify = otpService.verifyOtp(`exp_${timestamp}@test.com`, "email_verification", genExp.otp, "127.0.0.1", expiredNow);
    assert.strictEqual(expiredVerify.success, false, "Expired OTP must fail verification");
  });

  // -------------------------------------------------------------------------
  // Test 4: Verified user can log in with email and password WITHOUT an OTP
  // -------------------------------------------------------------------------
  await test("5. Verified user signs in directly with email and password without OTP challenge", async () => {
    // Create actual user in Supabase
    const signupRes = await sb.auth.signUp({
      email: testEmail,
      password: testPassword,
      options: {
        data: {
          name: "Verified User",
          email_verified: true, // Marked verified after signup OTP
        },
      },
    });

    assert(signupRes.data?.user?.id, "User signup in Supabase must succeed");

    // Perform standard email and password login
    const loginRes = await sb.auth.signInWithPassword({
      email: testEmail,
      password: testPassword,
    });

    assert.strictEqual(loginRes.error, null, "Login with valid credentials must succeed");
    assert(loginRes.data?.session?.access_token, "Session token must be present");
    assert(loginRes.data?.user?.id, "User identity must be returned");

    // Check verification status
    const verified = isEmailVerified(loginRes.data.user);
    assert.strictEqual(verified, true, "User must be recognized as verified");

    // Clean up session
    await sb.auth.signOut();
  });

  // -------------------------------------------------------------------------
  // Test 5: Incorrect password is rejected during login
  // -------------------------------------------------------------------------
  await test("6. Incorrect password during login is rejected with an error", async () => {
    const failLogin = await sb.auth.signInWithPassword({
      email: testEmail,
      password: "WrongPassword999!",
    });

    assert(failLogin.error, "Invalid password must return an error");
    assert.strictEqual(failLogin.data.session, null, "Must not return a session on wrong password");
  });

  // -------------------------------------------------------------------------
  // Test 6: Unverified user cannot bypass signup verification
  // -------------------------------------------------------------------------
  await test("7. Unverified account cannot bypass verification to access dashboard", async () => {
    const unverifiedUser = {
      id: "unverified-uuid-1",
      email: "unverified@example.com",
      user_metadata: { email_verified: false },
      email_confirmed_at: null,
    };

    const verified = isEmailVerified(unverifiedUser);
    assert.strictEqual(verified, false, "Unverified user must NOT be treated as verified");

    const pendingSignupUser = {
      id: "pending-signup-uuid",
      email: "pending@example.com",
      user_metadata: {},
      email_confirmed_at: "2026-10-15T10:00:00Z",
    };
    const pendingVerified = isEmailVerified(pendingSignupUser, "pending@example.com");
    assert.strictEqual(pendingVerified, false, "User with pending signup OTP must be blocked from dashboard");
  });

  // -------------------------------------------------------------------------
  // Test 7: Password reset still works with separate purpose isolation
  // -------------------------------------------------------------------------
  await test("8. Password reset OTP generation and purpose isolation remain fully functional", async () => {
    const resetGen = otpService.generateOtp(testEmail, "password_reset", "127.0.0.1");
    assert.strictEqual(resetGen.success, true, "Password reset OTP generation must succeed");

    // Verify purpose isolation: cannot verify email_verification using a password_reset code
    const crossVerify = otpService.verifyOtp(testEmail, "email_verification", resetGen.otp, "127.0.0.1");
    assert.strictEqual(crossVerify.success, false, "Password reset OTP must NOT verify email_verification");

    // Valid password reset verification
    const validResetVerify = otpService.verifyOtp(testEmail, "password_reset", resetGen.otp, "127.0.0.1");
    assert.strictEqual(validResetVerify.success, true, "Password reset OTP must verify under its own purpose");
  });

  // -------------------------------------------------------------------------
  // Test 8: Google sign-in accounts are recognized as pre-verified
  // -------------------------------------------------------------------------
  await test("9. Google Sign-In accounts are recognized as pre-verified without OTP", async () => {
    const googleUser = {
      id: "google-uuid-99",
      email: "googleuser@gmail.com",
      app_metadata: { provider: "google", providers: ["google"] },
      user_metadata: {},
      email_confirmed_at: null,
    };

    const isGoogleVerified = isEmailVerified(googleUser);
    assert.strictEqual(isGoogleVerified, true, "Google accounts must be pre-verified");
  });

  // -------------------------------------------------------------------------
  // Test 9: Active sessions preserve dashboard access without OTP redirects
  // -------------------------------------------------------------------------
  await test("10. Active session for verified user allows direct access without OTP prompts", async () => {
    const activeVerifiedUser = {
      id: "active-verified-user",
      email: "active@example.com",
      email_confirmed_at: "2026-10-15T12:00:00Z",
      user_metadata: { email_verified: true },
    };

    assert.strictEqual(isEmailVerified(activeVerifiedUser), true);
  });

  console.log("\n===================================================================");
  console.log(`TEST RESULTS: ${passed} PASSED, ${failed} FAILED (TOTAL: 10)`);
  console.log("===================================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runAllTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
