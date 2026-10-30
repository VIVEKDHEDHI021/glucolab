-- ============================================================================
-- MIGRATION: Strictly Enforce Email OTP Verification in Row Level Security (RLS)
-- Description:
-- Prevents unverified newly registered accounts from querying, modifying, or
-- deleting patient health records by verifying that email_otp_verified is not false.
-- Legacy existing accounts (where email_otp_verified is null) remain fully supported.
-- ============================================================================

-- 1. PROFILES POLICIES
DROP POLICY IF EXISTS "Users view own profile" ON public.profiles;
CREATE POLICY "Users view own profile" ON public.profiles
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id AND coalesce(auth.jwt() -> 'user_metadata' ->> 'email_otp_verified', 'true') != 'false');

DROP POLICY IF EXISTS "Users insert own profile" ON public.profiles;
CREATE POLICY "Users insert own profile" ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND coalesce(auth.jwt() -> 'user_metadata' ->> 'email_otp_verified', 'true') != 'false');

DROP POLICY IF EXISTS "Users update own profile" ON public.profiles;
CREATE POLICY "Users update own profile" ON public.profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id AND coalesce(auth.jwt() -> 'user_metadata' ->> 'email_otp_verified', 'true') != 'false');

DROP POLICY IF EXISTS "Users delete own profile" ON public.profiles;
CREATE POLICY "Users delete own profile" ON public.profiles
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id AND coalesce(auth.jwt() -> 'user_metadata' ->> 'email_otp_verified', 'true') != 'false');

-- 2. GLUCOSE ENTRIES POLICIES
DROP POLICY IF EXISTS "Users select own glucose" ON public.glucose_entries;
CREATE POLICY "Users select own glucose" ON public.glucose_entries
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id AND coalesce(auth.jwt() -> 'user_metadata' ->> 'email_otp_verified', 'true') != 'false');

DROP POLICY IF EXISTS "Users insert own glucose" ON public.glucose_entries;
CREATE POLICY "Users insert own glucose" ON public.glucose_entries
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND coalesce(auth.jwt() -> 'user_metadata' ->> 'email_otp_verified', 'true') != 'false');

DROP POLICY IF EXISTS "Users update own glucose" ON public.glucose_entries;
CREATE POLICY "Users update own glucose" ON public.glucose_entries
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id AND coalesce(auth.jwt() -> 'user_metadata' ->> 'email_otp_verified', 'true') != 'false');

DROP POLICY IF EXISTS "Users delete own glucose" ON public.glucose_entries;
CREATE POLICY "Users delete own glucose" ON public.glucose_entries
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id AND coalesce(auth.jwt() -> 'user_metadata' ->> 'email_otp_verified', 'true') != 'false');

-- 3. INSULIN ENTRIES POLICIES
DROP POLICY IF EXISTS "Users select own insulin" ON public.insulin_entries;
CREATE POLICY "Users select own insulin" ON public.insulin_entries
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id AND coalesce(auth.jwt() -> 'user_metadata' ->> 'email_otp_verified', 'true') != 'false');

DROP POLICY IF EXISTS "Users insert own insulin" ON public.insulin_entries;
CREATE POLICY "Users insert own insulin" ON public.insulin_entries
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND coalesce(auth.jwt() -> 'user_metadata' ->> 'email_otp_verified', 'true') != 'false');

DROP POLICY IF EXISTS "Users update own insulin" ON public.insulin_entries;
CREATE POLICY "Users update own insulin" ON public.insulin_entries
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id AND coalesce(auth.jwt() -> 'user_metadata' ->> 'email_otp_verified', 'true') != 'false');

DROP POLICY IF EXISTS "Users delete own insulin" ON public.insulin_entries;
CREATE POLICY "Users delete own insulin" ON public.insulin_entries
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id AND coalesce(auth.jwt() -> 'user_metadata' ->> 'email_otp_verified', 'true') != 'false');

-- 4. WEIGHT ENTRIES POLICIES
DROP POLICY IF EXISTS "Users select own weight" ON public.weight_entries;
CREATE POLICY "Users select own weight" ON public.weight_entries
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id AND coalesce(auth.jwt() -> 'user_metadata' ->> 'email_otp_verified', 'true') != 'false');

DROP POLICY IF EXISTS "Users insert own weight" ON public.weight_entries;
CREATE POLICY "Users insert own weight" ON public.weight_entries
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND coalesce(auth.jwt() -> 'user_metadata' ->> 'email_otp_verified', 'true') != 'false');

DROP POLICY IF EXISTS "Users update own weight" ON public.weight_entries;
CREATE POLICY "Users update own weight" ON public.weight_entries
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id AND coalesce(auth.jwt() -> 'user_metadata' ->> 'email_otp_verified', 'true') != 'false');

DROP POLICY IF EXISTS "Users delete own weight" ON public.weight_entries;
CREATE POLICY "Users delete own weight" ON public.weight_entries
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id AND coalesce(auth.jwt() -> 'user_metadata' ->> 'email_otp_verified', 'true') != 'false');

-- 5. FOOD ENTRIES POLICIES
DROP POLICY IF EXISTS "Users select own food" ON public.food_entries;
CREATE POLICY "Users select own food" ON public.food_entries
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id AND coalesce(auth.jwt() -> 'user_metadata' ->> 'email_otp_verified', 'true') != 'false');

DROP POLICY IF EXISTS "Users insert own food" ON public.food_entries;
CREATE POLICY "Users insert own food" ON public.food_entries
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND coalesce(auth.jwt() -> 'user_metadata' ->> 'email_otp_verified', 'true') != 'false');

DROP POLICY IF EXISTS "Users update own food" ON public.food_entries;
CREATE POLICY "Users update own food" ON public.food_entries
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id AND coalesce(auth.jwt() -> 'user_metadata' ->> 'email_otp_verified', 'true') != 'false');

DROP POLICY IF EXISTS "Users delete own food" ON public.food_entries;
CREATE POLICY "Users delete own food" ON public.food_entries
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id AND coalesce(auth.jwt() -> 'user_metadata' ->> 'email_otp_verified', 'true') != 'false');
