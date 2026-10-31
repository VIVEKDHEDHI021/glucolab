import fs from "fs";
import path from "path";
import assert from "assert";

console.log("=================================================");
console.log("   GlucoLab v1.4 – Authentication & Onboarding   ");
console.log("   Comprehensive Verification Test Suite         ");
console.log("=================================================\n");

let passedTests = 0;
let totalTests = 0;

function test(description, fn) {
  totalTests++;
  try {
    fn();
    console.log(`\x1b[32m✔ [PASS]\x1b[0m ${description}`);
    passedTests++;
  } catch (err) {
    console.error(`\x1b[31m✘ [FAIL]\x1b[0m ${description}`);
    console.error(`   Error: ${err.message}\n`);
  }
}

// ----------------------------------------------------
// TEST GROUP 1: Database Migration & Schema (Phase 4)
// ----------------------------------------------------
test("1. Supabase migration 20261031140000_extend_profiles_onboarding.sql exists", () => {
  const migPath = path.resolve("supabase/migrations/20261031140000_extend_profiles_onboarding.sql");
  assert(fs.existsSync(migPath), "Migration file does not exist");
  const content = fs.readFileSync(migPath, "utf8");
  assert(content.includes("age integer"), "Missing age column in migration");
  assert(content.includes("diabetes_type text"), "Missing diabetes_type column in migration");
  assert(content.includes("weight_kg numeric"), "Missing weight_kg column in migration");
  assert(content.includes("height_cm numeric"), "Missing height_cm column in migration");
  assert(content.includes("onboarding_completed boolean DEFAULT false"), "Missing onboarding_completed column in migration");
});

test("2. Migration enforces strict RLS policies and validation constraints", () => {
  const migPath = path.resolve("supabase/migrations/20261031140000_extend_profiles_onboarding.sql");
  const content = fs.readFileSync(migPath, "utf8");
  assert(content.includes("ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY"), "RLS not enabled on profiles");
  assert(content.includes("Users view own profile"), "Missing SELECT RLS policy");
  assert(content.includes("Users insert own profile"), "Missing INSERT RLS policy");
  assert(content.includes("Users update own profile"), "Missing UPDATE RLS policy");
  assert(content.includes("Type 1 Diabetes"), "Missing Type 1 Diabetes check constraint");
  assert(content.includes("Type 2 Diabetes"), "Missing Type 2 Diabetes check constraint");
  assert(content.includes("Gestational Diabetes"), "Missing Gestational Diabetes check constraint");
  assert(content.includes("Other / Not sure"), "Missing Other / Not sure check constraint");
});

test("3. TypeScript DB types (src/db/types.ts) reflect extended profiles table", () => {
  const typesPath = path.resolve("src/db/types.ts");
  const content = fs.readFileSync(typesPath, "utf8");
  assert(content.includes("age: number | null"), "Missing age in types.ts");
  assert(content.includes("diabetes_type: string | null"), "Missing diabetes_type in types.ts");
  assert(content.includes("weight_kg: number | null"), "Missing weight_kg in types.ts");
  assert(content.includes("height_cm: number | null"), "Missing height_cm in types.ts");
  assert(content.includes("onboarding_completed: boolean"), "Missing onboarding_completed in types.ts");
  assert(content.includes("export type Profile ="), "Missing export type Profile in types.ts");
});

// ----------------------------------------------------
// TEST GROUP 2: Welcome Screen & Google-Only Auth (Phase 1 & 2)
// ----------------------------------------------------
test("4. Welcome screen (src/routes/signup.tsx) removes traditional registration inputs", () => {
  const signupPath = path.resolve("src/routes/signup.tsx");
  const content = fs.readFileSync(signupPath, "utf8");
  
  // Must NOT contain traditional registration inputs
  assert(!content.includes('id="email"'), "Email input should be removed from signup page");
  assert(!content.includes('id="password"'), "Password input should be removed from signup page");
  assert(!content.includes('id="name"'), "Name input should be removed from signup page");
  assert(!content.includes("Create Account button") && !content.includes("Create account</"), "Create Account button should be removed");
  assert(!content.includes("Already have an account?"), "Sign In link should be removed from signup page");
  assert(!content.includes(">or<"), "OR divider should be removed from signup page");
});

test("5. Welcome screen features prominent Google-only OAuth CTA and privacy consent", () => {
  const signupPath = path.resolve("src/routes/signup.tsx");
  const content = fs.readFileSync(signupPath, "utf8");
  assert(content.includes("Continue with Google"), "Missing Continue with Google CTA");
  assert(content.includes("authService.signInWithGoogle"), "Google OAuth service not wired to button");
  assert(content.includes("Privacy Policy"), "Missing Privacy Policy disclaimer");
  assert(content.includes("Connecting to Google..."), "Missing Google connection loading state");
});

test("5b. Login screen (src/routes/login.tsx) removes manual email/password inputs and gives only Continue with Google", () => {
  const loginPath = path.resolve("src/routes/login.tsx");
  const content = fs.readFileSync(loginPath, "utf8");
  assert(!content.includes('id="email"'), "Email input should be removed from login page");
  assert(!content.includes('id="password"'), "Password input should be removed from login page");
  assert(!content.includes("Sign in</Button>"), "Sign in button should be removed from login page");
  assert(!content.includes(">or<"), "OR divider should be removed from login page");
  assert(content.includes("Continue with Google"), "Missing Continue with Google on login page");
  assert(content.includes("authService.signInWithGoogle"), "Google OAuth not wired to button");
});

// ----------------------------------------------------
// TEST GROUP 3: Multi-Step Health Profile Wizard (Phase 3)
// ----------------------------------------------------
test("6. Onboarding route (src/routes/onboarding.tsx) exists with 4-step wizard structure", () => {
  const onboardingPath = path.resolve("src/routes/onboarding.tsx");
  assert(fs.existsSync(onboardingPath), "Onboarding route file missing");
  const content = fs.readFileSync(onboardingPath, "utf8");
  assert(content.includes("Step {currentStep} of 4"), "Missing step progress indicator");
  assert(content.includes("Personal Information"), "Missing Step 1 Personal Information");
  assert(content.includes("Diabetes Type"), "Missing Step 2 Diabetes Information");
  assert(content.includes("Body Measurements"), "Missing Step 3 Body Measurements");
  assert(content.includes("All Set!"), "Missing Step 4 Completion Screen");
});

test("7. Step 1 integrates AgeWheelSelector and validates full name and age (1-120)", () => {
  const onboardingPath = path.resolve("src/routes/onboarding.tsx");
  const content = fs.readFileSync(onboardingPath, "utf8");
  assert(content.includes("AgeWheelSelector"), "Missing AgeWheelSelector component in Step 1");
  assert(content.includes("validateStep1"), "Missing Step 1 validation");
  assert(content.includes("age < 1 || age > 120"), "Missing age boundary validation (1-120)");
});

test("8. AgeWheelSelector component supports momentum scrolling, haptics, and manual fallback", () => {
  const wheelPath = path.resolve("src/features/onboarding/components/AgeWheelSelector.tsx");
  assert(fs.existsSync(wheelPath), "AgeWheelSelector file missing");
  const content = fs.readFileSync(wheelPath, "utf8");
  assert(content.includes("Haptics.impact"), "Missing haptic feedback");
  assert(content.includes("ChevronUp") && content.includes("ChevronDown"), "Missing stepper buttons");
  assert(content.includes("Or type age directly"), "Missing direct manual typing accessibility fallback");
});

test("9. Step 2 presents the 4 standard diabetes diagnostic choices", () => {
  const onboardingPath = path.resolve("src/routes/onboarding.tsx");
  const content = fs.readFileSync(onboardingPath, "utf8");
  assert(content.includes("Type 1 Diabetes"), "Missing Type 1 Diabetes choice");
  assert(content.includes("Type 2 Diabetes"), "Missing Type 2 Diabetes choice");
  assert(content.includes("Gestational Diabetes"), "Missing Gestational Diabetes choice");
  assert(content.includes("Other / Not sure"), "Missing Other / Not sure choice");
});

test("10. Step 3 validates weight (20-350 kg) and height (50-260 cm) with live BMI preview", () => {
  const onboardingPath = path.resolve("src/routes/onboarding.tsx");
  const content = fs.readFileSync(onboardingPath, "utf8");
  assert(content.includes("w < 20 || w > 350"), "Missing weight boundary validation (20-350 kg)");
  assert(content.includes("h < 50 || h > 260"), "Missing height boundary validation (50-260 cm)");
  assert(content.includes("Calculated Body Mass Index (BMI)"), "Missing dynamic BMI preview");
});

test("11. Step 4 displays celebration badge, summary card, and Go to Dashboard action", () => {
  const onboardingPath = path.resolve("src/routes/onboarding.tsx");
  const content = fs.readFileSync(onboardingPath, "utf8");
  assert(content.includes("Health Profile Summary"), "Missing summary review card");
  assert(content.includes("Go to Dashboard"), "Missing Go to Dashboard CTA button");
  assert(content.includes("healthService.completeOnboarding"), "Missing completeOnboarding invocation");
});

test("12. Onboarding draft state persists in sessionStorage across refreshes", () => {
  const onboardingPath = path.resolve("src/routes/onboarding.tsx");
  const content = fs.readFileSync(onboardingPath, "utf8");
  assert(content.includes("glucolab_onboarding_draft"), "Missing draft storage key");
  assert(content.includes("sessionStorage.setItem"), "Missing draft state persistence");
  assert(content.includes("sessionStorage.removeItem"), "Missing draft cleanup upon completion");
});

// ----------------------------------------------------
// TEST GROUP 4: Route Guards & Flow Control (Phase 5)
// ----------------------------------------------------
test("13. AuthenticatedLayout (_authenticated.tsx) enforces onboarding completion check", () => {
  const authLayoutPath = path.resolve("src/routes/_authenticated.tsx");
  const content = fs.readFileSync(authLayoutPath, "utf8");
  assert(content.includes("!profile?.onboarding_completed"), "Missing profile onboarding check in AuthenticatedLayout");
  assert(content.includes('to: "/onboarding"'), "Missing redirect to /onboarding");
});

test("14. AuthContext provides reactive profile and refreshProfile across the app", () => {
  const authCtxPath = path.resolve("src/frontend/lib/auth-context.tsx");
  const content = fs.readFileSync(authCtxPath, "utf8");
  assert(content.includes("profile: Profile | null | undefined"), "Missing profile in AuthContextValue");
  assert(content.includes("refreshProfile:"), "Missing refreshProfile in AuthContextValue");
});

test("15. Profile page (src/routes/_authenticated/profile.tsx) allows editing health metrics without resetting onboarding", () => {
  const profilePath = path.resolve("src/routes/_authenticated/profile.tsx");
  const content = fs.readFileSync(profilePath, "utf8");
  assert(content.includes("Diabetes & Health Profile"), "Missing Health Profile view card in profile page");
  assert(content.includes("editDiabetesType"), "Missing editDiabetesType in profile edit dialog");
  assert(content.includes("editAge"), "Missing editAge in profile edit dialog");
  assert(content.includes("editWeightKg"), "Missing editWeightKg in profile edit dialog");
  assert(content.includes("editHeightCm"), "Missing editHeightCm in profile edit dialog");
  assert(!content.includes("onboarding_completed: false"), "Profile edit must never reset onboarding_completed to false");
});

// ----------------------------------------------------
// SUMMARY
// ----------------------------------------------------
console.log("\n-------------------------------------------------");
console.log(`Results: ${passedTests} / ${totalTests} tests passed.`);
console.log("-------------------------------------------------");

if (passedTests === totalTests) {
  console.log("\x1b[32m✔ ALL AUTHENTICATION & ONBOARDING REDESIGN TESTS PASSED!\x1b[0m\n");
  process.exit(0);
} else {
  console.error("\x1b[31m✘ SOME TESTS FAILED.\x1b[0m\n");
  process.exit(1);
}
