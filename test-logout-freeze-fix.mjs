import assert from "node:assert";
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
