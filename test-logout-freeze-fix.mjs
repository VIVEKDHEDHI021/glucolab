import assert from "node:assert";
import fs from "node:fs";
import { authService } from "./src/backend/services/authService.ts";

console.log("===================================================================");
console.log("🧪 GLUCOLAB v1.4 – LOGOUT FREEZE & TIMEOUT FIX VERIFICATION");
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

async function runTestSuite() {
  // 1. Verify authService.signOut finishes rapidly without blocking indefinitely
  await test("1. authService.signOut() completes within timeout and returns without hanging", async () => {
    const startTime = Date.now();
    const result = await authService.signOut();
    const duration = Date.now() - startTime;
    assert(result, "signOut should return an object");
    assert(duration < 3000, `signOut took too long: ${duration}ms (must be < 3000ms)`);
  });

  // 2. Verify repeated calls to signOut are safe and idempotent
  await test("2. Repeated calls to signOut are idempotent and do not throw", async () => {
    await authService.signOut();
    await authService.signOut();
  });

  // 3. Verify simulated document body locks are cleanly removed
  await test("3. signOut cleans up document body pointer-events and scroll locks", async () => {
    // Simulate DOM environment if running in node/bun
    if (typeof globalThis.document === "undefined") {
      globalThis.window = globalThis;
      globalThis.document = {
        body: {
          style: { pointerEvents: "none", overflow: "hidden" },
          removeAttribute: (attr) => {
            delete globalThis.document.body[attr];
          },
        },
      };
      globalThis.sessionStorage = {
        clear: () => {},
        removeItem: () => {},
      };
    } else if (typeof globalThis.window === "undefined") {
      globalThis.window = globalThis;
    }

    globalThis.document.body.style.pointerEvents = "none";
    globalThis.document.body.style.overflow = "hidden";

    await authService.signOut();

    assert.strictEqual(
      globalThis.document.body.style.pointerEvents,
      "",
      "pointerEvents must be cleared after signOut",
    );
    assert.strictEqual(
      globalThis.document.body.style.overflow,
      "",
      "overflow lock must be cleared after signOut",
    );
  });

  // 4. Verify confirmation dialog and flicker-prevention overlay in app-shell.tsx
  await test("4. AppShell asks for confirmation before signing out and shows smooth transition overlay", async () => {
    const appShellContent = fs.readFileSync("src/frontend/components/app-shell.tsx", "utf8");
    assert(appShellContent.includes("confirmSignOutOpen"), "Missing confirmSignOutOpen state");
    assert(appShellContent.includes("Sign out of GlucoLab?"), "Missing sign out confirmation dialog title");
    assert(appShellContent.includes("Are you sure you want to sign out?"), "Missing confirmation prompt description");
    assert(appShellContent.includes("Signing out safely..."), "Missing smooth fullscreen transition overlay");
  });

  // 5. Verify Profile page logout confirmation and redirect to /login
  await test("5. Profile page asks for confirmation and redirects to /login", async () => {
    const profileContent = fs.readFileSync("src/routes/_authenticated/profile.tsx", "utf8");
    assert(profileContent.includes("logoutOpen"), "Missing logoutOpen state in profile.tsx");
    assert(profileContent.includes("navigate({ to: \"/login\", replace: true })"), "Profile page must navigate to /login on logout");
    assert(profileContent.includes("Signing out safely..."), "Missing smooth transition overlay in profile.tsx");
  });

  console.log("\n===================================================================");
  console.log(`🎉 TEST RESULTS: ${passed} PASSED, ${failed} FAILED (TOTAL: ${passed + failed})`);
  console.log("===================================================================\n");

  if (failed > 0) {
    process.exit(1);
  }
}

runTestSuite().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
