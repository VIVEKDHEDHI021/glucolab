import assert from "node:assert";
import { otpService } from "./src/backend/services/otpService.server.ts";

console.log("===================================================================");
console.log("🧪 GLUCOLAB v1.4 – OTP TIMEOUT & REQUEST TERMINATION TEST SUITE");
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

async function runTests() {
  const timestamp = Date.now();
  const testEmail = `patient_timeout_${timestamp}@glucolab-test.com`;

  // 1. Generate an OTP
  let activeOtp = "";
  await test("1. Generate active 6-digit OTP for email verification", () => {
    const genRes = otpService.generateOtp(testEmail, "email_verification", "127.0.0.1", timestamp);
    assert.strictEqual(genRes.success, true);
    assert(genRes.otp);
    assert.strictEqual(genRes.otp.length, 6);
    activeOtp = genRes.otp;
  });

  // 2. Terminate the request before verification
  await test("2. Terminate active OTP request invalidates record", () => {
    const termRes = otpService.terminateOtp(testEmail, "email_verification");
    assert.strictEqual(termRes, true, "terminateOtp should return true when active OTP was terminated");
  });

  // 3. Verify that the previous OTP code is strictly rejected
  await test("3. Entering OTP after termination is strictly rejected", () => {
    const verifyRes = otpService.verifyOtp(testEmail, "email_verification", activeOtp, "127.0.0.1", timestamp + 5000);
    assert.strictEqual(verifyRes.success, false, "Verification must fail after request is terminated");
    assert.strictEqual(verifyRes.status, 400);
  });

  // 4. Repeated termination is idempotent and safe
  await test("4. Terminating already terminated request is safe and idempotent", () => {
    const termRes = otpService.terminateOtp(testEmail, "email_verification");
    assert.strictEqual(termRes, false, "terminateOtp should return false when no active OTP exists");
  });

  // 5. User can request a fresh code after termination
  let newOtp = "";
  await test("5. User can request a fresh code after termination", () => {
    const newGenRes = otpService.generateOtp(testEmail, "email_verification", "127.0.0.1", timestamp + 65000);
    assert.strictEqual(newGenRes.success, true);
    assert.strictEqual(newGenRes.otp.length, 6);
    newOtp = newGenRes.otp;
  });

  // 6. Fresh code succeeds verification
  await test("6. Fresh OTP verifies successfully", () => {
    const verifyRes = otpService.verifyOtp(testEmail, "email_verification", newOtp, "127.0.0.1", timestamp + 70000);
    assert.strictEqual(verifyRes.success, true);
  });

  // 7. Password reset termination operates with purpose isolation
  await test("7. Password reset termination isolates by purpose", () => {
    const resetTime = timestamp + 100000;
    const resetGen = otpService.generateOtp(testEmail, "password_reset", "127.0.0.1", resetTime);
    assert.strictEqual(resetGen.success, true);

    // Terminating email_verification does NOT terminate password_reset
    otpService.terminateOtp(testEmail, "email_verification");
    const resetVerify = otpService.verifyOtp(testEmail, "password_reset", resetGen.otp, "127.0.0.1", resetTime + 2000);
    assert.strictEqual(resetVerify.success, true, "Password reset OTP remains valid if email_verification was terminated");
  });

  console.log("\n===================================================================");
  console.log(`🎉 TEST RESULTS: ${passed} PASSED, ${failed} FAILED (TOTAL: ${passed + failed})`);
  console.log("===================================================================\n");

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
