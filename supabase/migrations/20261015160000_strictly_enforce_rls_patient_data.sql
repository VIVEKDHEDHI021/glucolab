-- ============================================================================
-- MIGRATION: Strictly Enforce Row Level Security (RLS) on Patient Health Data
-- Description:
-- Prevents unauthorized/anonymous access to patient records by:
-- 1. Explicitly enabling RLS on all health tables
-- 2. Revoking default permissions for anonymous/public roles
-- 3. Restricting all SELECT, INSERT, UPDATE, DELETE policies strictly to 'authenticated' users
-- ============================================================================

-- 1. Enable Row Level Security on all patient data tables
ALTER TABLE IF EXISTS public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.glucose_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.insulin_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.weight_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.smart_scan_readings ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.patient_reminder_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.reminder_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.push_tokens ENABLE ROW LEVEL SECURITY;

-- 2. Revoke generic anon permissions
REVOKE ALL ON public.profiles FROM anon;
REVOKE ALL ON public.glucose_entries FROM anon;
REVOKE ALL ON public.insulin_entries FROM anon;
REVOKE ALL ON public.weight_entries FROM anon;
REVOKE ALL ON public.smart_scan_readings FROM anon;
REVOKE ALL ON public.patient_reminder_settings FROM anon;
REVOKE ALL ON public.reminders FROM anon;
REVOKE ALL ON public.reminder_history FROM anon;

-- 3. PROFILES POLICIES (Only authenticated owner can access)
DROP POLICY IF EXISTS "Users view own profile" ON public.profiles;
CREATE POLICY "Users view own profile" ON public.profiles
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users insert own profile" ON public.profiles;
CREATE POLICY "Users insert own profile" ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users update own profile" ON public.profiles;
CREATE POLICY "Users update own profile" ON public.profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users delete own profile" ON public.profiles;
CREATE POLICY "Users delete own profile" ON public.profiles
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- 4. GLUCOSE ENTRIES POLICIES (Only authenticated owner can access)
DROP POLICY IF EXISTS "Users select own glucose" ON public.glucose_entries;
CREATE POLICY "Users select own glucose" ON public.glucose_entries
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users insert own glucose" ON public.glucose_entries;
CREATE POLICY "Users insert own glucose" ON public.glucose_entries
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users update own glucose" ON public.glucose_entries;
CREATE POLICY "Users update own glucose" ON public.glucose_entries
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users delete own glucose" ON public.glucose_entries;
CREATE POLICY "Users delete own glucose" ON public.glucose_entries
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- 5. INSULIN ENTRIES POLICIES (Only authenticated owner can access)
DROP POLICY IF EXISTS "Users select own insulin" ON public.insulin_entries;
CREATE POLICY "Users select own insulin" ON public.insulin_entries
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users insert own insulin" ON public.insulin_entries;
CREATE POLICY "Users insert own insulin" ON public.insulin_entries
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users update own insulin" ON public.insulin_entries;
CREATE POLICY "Users update own insulin" ON public.insulin_entries
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users delete own insulin" ON public.insulin_entries;
CREATE POLICY "Users delete own insulin" ON public.insulin_entries
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- 6. WEIGHT ENTRIES POLICIES (Only authenticated owner can access)
DROP POLICY IF EXISTS "Users select own weight" ON public.weight_entries;
CREATE POLICY "Users select own weight" ON public.weight_entries
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users insert own weight" ON public.weight_entries;
CREATE POLICY "Users insert own weight" ON public.weight_entries
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users update own weight" ON public.weight_entries;
CREATE POLICY "Users update own weight" ON public.weight_entries
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users delete own weight" ON public.weight_entries;
CREATE POLICY "Users delete own weight" ON public.weight_entries
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- 7. SMART SCAN READINGS POLICIES (Only authenticated owner can access)
DROP POLICY IF EXISTS "Users manage own smart scan readings" ON public.smart_scan_readings;
CREATE POLICY "Users manage own smart scan readings" ON public.smart_scan_readings
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
