import assert from "node:assert";
import fs from "node:fs";

console.log("=======================================================");
console.log("🎬 TESTING GLUCOLAB STARTUP SPLASH ANIMATION TIMINGS");
console.log("=======================================================\n");

// 1. Verify CSS Animation Durations and Schedule
console.log("Test 1: Inspecting CSS and generate-index.mjs animation schedules...");
const cssContent = fs.readFileSync("src/frontend/components/startup-splash.css", "utf-8");
const generateIndexContent = fs.readFileSync("generate-index.mjs", "utf-8");

// Exit animation must start at 3.50s and last 0.40s, ending at 3.90s
assert.ok(
  cssContent.includes("animation: splashExit 0.40s ease-in-out 3.50s forwards;"),
  "CSS must have splashExit ending at 3.90s"
);
assert.ok(
  generateIndexContent.includes("animation: splashExit 0.40s ease-in-out 3.50s forwards;"),
  "generate-index.mjs must have splashExit ending at 3.90s"
);

// All brand letters must be sequenced
assert.ok(cssContent.includes(".gluco span:nth-child(5) { animation-delay: 0.86s; }"));
assert.ok(cssContent.includes(".red-plus {"));
assert.ok(cssContent.includes(".lab span:nth-child(3) { animation-delay: 2.02s; }"));
assert.ok(cssContent.includes("logoSettle 0.60s cubic-bezier(0.22, 1, 0.36, 1) 2.50s"));
console.log("✅ [PASS] 1. Complete letter, plus, settle, and exit sequence verified (~3.90s total).\n");

// 2. Verify StartupSplashAnimation.tsx defaults
console.log("Test 2: Verifying StartupSplashAnimation minDurationMs default is 3900ms...");
const componentContent = fs.readFileSync("src/frontend/components/StartupSplashAnimation.tsx", "utf-8");

assert.ok(
  componentContent.includes("minDurationMs = 3900"),
  "Default minDurationMs must be 3900ms (not 1200ms)"
);
assert.ok(
  !componentContent.includes("minDurationMs = 1200"),
  "Obsolete 1200ms cutoff must be completely removed"
);
console.log("✅ [PASS] 2. StartupSplashAnimation component default duration set to 3900ms.\n");

// 3. Verify __root.tsx splash configuration and pointer-events protection
console.log("Test 3: Verifying Root layout splash isolation...");
const rootContent = fs.readFileSync("src/routes/__root.tsx", "utf-8");

assert.ok(
  rootContent.includes("minDurationMs={3900}"),
  "Root route must explicitly pass 3900ms to StartupSplashAnimation"
);
assert.ok(
  rootContent.includes('splashActive && "select-none pointer-events-none"'),
  "Root layout must isolate interaction while splash is active"
);
assert.ok(
  rootContent.includes("{!splashActive && <Toaster richColors position=\"top-center\" />}"),
  "Toasts must be deferred until splash animation completes"
);
console.log("✅ [PASS] 3. Root layout cleanly isolates splash and defers dashboard interaction & toasts.\n");

console.log("=======================================================");
console.log("🎉 ALL STARTUP SPLASH ANIMATION TESTS PASSED!");
console.log("=======================================================");
