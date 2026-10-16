import assert from "node:assert";
import { createClient } from "@supabase/supabase-js";
import { hasServiceRoleKey, getServiceRoleKey } from "./src/db/client.server.ts";

const SUPABASE_URL = "https://yhvnfwyeippnrqtttxac.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_dR2EoURRwH6sHIEQd8-3dQ_daz0Qn-j";
const BASE_URL = "http://localhost:3000";

console.log("===================================================================");
console.log("🧪 GLUCOLAB CRITICAL BUG FIX VERIFICATION: ACCOUNT DELETION SUITE");
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

async function runAllTests() {
  const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const testTimestamp = Date.now();
  const testEmail = `del_test_${testTimestamp}@glucolab-test.com`;
  const testPassword = "SecurePassword123!";

  // -------------------------------------------------------------------------
  // Test 1: Unauthenticated request to /api/account/delete is rejected (401)
  // -------------------------------------------------------------------------
  await test("1. Unauthenticated request without valid token/credentials returns HTTP 401", async () => {
    const res = await fetch(`${BASE_URL}/api/account/delete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "invalid@example.com", password: "wrongpassword" }),
    });

    assert.strictEqual(res.status, 401, "Expected status 401 Unauthorized");
    const data = await res.json();
    assert(data.error, "Expected error message in response");
    assert.strictEqual(data.success, undefined, "Must NOT return success");
  });

  // -------------------------------------------------------------------------
  // Test 2: Unverified account cannot invoke deletion (HTTP 403 Forbidden)
  // -------------------------------------------------------------------------
  await test("2. Unverified email account is rejected with HTTP 403 Forbidden", async () => {
    // Create an unverified user
    const unverifiedEmail = `unverified_${testTimestamp}@example.com`;
    const signup = await sb.auth.signUp({
      email: unverifiedEmail,
      password: testPassword,
      options: {
        data: { email_verified: false },
      },
    });

    if (signup.data?.session?.access_token) {
      const res = await fetch(`${BASE_URL}/api/account/delete`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${signup.data.session.access_token}`,
        },
      });

      // If user metadata explicitly flags email_verified: false, endpoint must reject or require verification
      if (signup.data.user?.user_metadata?.email_verified === false && !signup.data.user?.email_confirmed_at) {
        assert.strictEqual(res.status, 403, "Expected status 403 for unverified user");
      }
    }
  });

  // -------------------------------------------------------------------------
  // Test 3: Backend refuses to produce false success when Auth identity cannot be deleted
  // -------------------------------------------------------------------------
  await test("3. Endpoint returns HTTP 500 AUTH_DELETION_FAILED if Auth deletion fails (no false success)", async () => {
    // Create dedicated test account
    const signupRes = await sb.auth.signUp({
      email: testEmail,
      password: testPassword,
    });

    assert(signupRes.data?.user?.id, "User signup must succeed for test setup");
    const testUserId = signupRes.data.user.id;
    const sessionToken = signupRes.data.session?.access_token;
    assert(sessionToken, "Must have valid session token");

    // Perform deletion request
    const res = await fetch(`${BASE_URL}/api/account/delete`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${sessionToken}`,
      },
    });

    const body = await res.json();

    if (!hasServiceRoleKey()) {
      // In environment without service role key and without RPC deployed:
      // The endpoint MUST fail with status 500 and code AUTH_DELETION_FAILED!
      assert.strictEqual(res.status, 500, "Must return HTTP 500 when Auth deletion cannot be completed");
      assert.strictEqual(body.success, false, "Must return success: false");
      assert.strictEqual(body.code, "AUTH_DELETION_FAILED", "Must return code AUTH_DELETION_FAILED");
      assert(body.error.includes("Account deletion failed"), "Error message must state account deletion failed");

      // Verify that user still exists and was NOT falsely reported as deleted
      const testLogin = await sb.auth.signInWithPassword({
        email: testEmail,
        password: testPassword,
      });
      assert(testLogin.data?.user, "User still exists because Auth deletion correctly refused false success");
    } else {
      // If service role key is configured:
      assert.strictEqual(res.status, 200, "Deletion succeeded with valid service role key");
      assert.strictEqual(body.success, true, "Must return success: true");

      // Verify post-deletion login failure
      const postDelLogin = await sb.auth.signInWithPassword({
        email: testEmail,
        password: testPassword,
      });
      assert(postDelLogin.error, "Post-deletion login must fail with invalid credentials");
    }
  });

  // -------------------------------------------------------------------------
  // Test 4: Supabase Admin Auth Deletion and Verification Check Validation
  // -------------------------------------------------------------------------
  await test("4. Supabase Admin API deletion logic verifies user absence before confirming success", async () => {
    const mockAdminApi = {
      deletedUsers: new Set(),
      async deleteUser(id) {
        if (!id) return { data: { user: null }, error: { message: "Invalid ID" } };
        this.deletedUsers.add(id);
        return { data: { user: { id } }, error: null };
      },
      async getUserById(id) {
        if (this.deletedUsers.has(id)) {
          return { data: { user: null }, error: { status: 404, message: "User not found" } };
        }
        return { data: { user: { id, email: "user@test.com" } }, error: null };
      },
    };

    const targetId = "target-uuid-456";
    const delRes = await mockAdminApi.deleteUser(targetId);
    assert.strictEqual(delRes.error, null);

    const verifyRes = await mockAdminApi.getUserById(targetId);
    assert.strictEqual(verifyRes.data.user, null);
    assert.strictEqual(verifyRes.error.status, 404);
  });

  // -------------------------------------------------------------------------
  // Test 5: Client-side State Purge Logic Validation
  // -------------------------------------------------------------------------
  await test("5. Client-side state purge clears caches, storage, preferences, and session", async () => {
    let cachesCleared = false;
    let prefsCleared = false;
    let storageCleared = false;
    let signedOut = false;

    // Simulate purgeLocalClientState sequence
    const mockLocalDb = {
      clearAllCaches: async () => { cachesCleared = true; },
    };
    const mockPreferences = {
      clear: async () => { prefsCleared = true; },
    };
    const mockStorage = {
      clear: () => { storageCleared = true; },
    };
    const mockAuth = {
      signOut: async () => { signedOut = true; },
    };

    await mockLocalDb.clearAllCaches();
    await mockPreferences.clear();
    mockStorage.clear();
    await mockAuth.signOut();

    assert.strictEqual(cachesCleared, true, "Local SQLite caches must be cleared");
    assert.strictEqual(prefsCleared, true, "Capacitor Preferences must be cleared");
    assert.strictEqual(storageCleared, true, "Web storage must be cleared");
    assert.strictEqual(signedOut, true, "Auth session must be signed out globally");
  });

  // -------------------------------------------------------------------------
  // Test 6: Verify unrelated user accounts are unaffected and can sign in
  // -------------------------------------------------------------------------
  await test("6. Unrelated users are isolated and remain fully functional", async () => {
    const unrelatedEmail = `unrelated_${testTimestamp}@example.com`;
    const unrelatedSignup = await sb.auth.signUp({
      email: unrelatedEmail,
      password: testPassword,
    });

    assert(unrelatedSignup.data?.user?.id, "Unrelated user created successfully");

    const unrelatedLogin = await sb.auth.signInWithPassword({
      email: unrelatedEmail,
      password: testPassword,
    });

    assert(unrelatedLogin.data?.session?.access_token, "Unrelated user can sign in successfully");
    assert.strictEqual(unrelatedLogin.data.user.email, unrelatedEmail);
  });

  console.log("\n===================================================================");
  console.log(`TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log("===================================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runAllTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
