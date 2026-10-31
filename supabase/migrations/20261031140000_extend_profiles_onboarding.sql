-- Migration: 20261031140000_extend_profiles_onboarding.sql
-- Description: Extend profiles table with health onboarding fields and strict RLS policies

-- 1. Extend profiles table with new onboarding and diabetes profile attributes
ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS age integer CHECK (age IS NULL OR (age >= 1 AND age <= 120)),
  ADD COLUMN IF NOT EXISTS diabetes_type text,
  ADD COLUMN IF NOT EXISTS weight_kg numeric(5,2) CHECK (weight_kg IS NULL OR (weight_kg >= 20 AND weight_kg <= 350)),
  ADD COLUMN IF NOT EXISTS height_cm numeric(5,2) CHECK (height_cm IS NULL OR (height_cm >= 50 AND height_cm <= 260)),
  ADD COLUMN IF NOT EXISTS onboarding_completed boolean DEFAULT false NOT NULL;

-- 2. Add constraint for valid diabetes types
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profiles_diabetes_type_check'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_diabetes_type_check
      CHECK (
        diabetes_type IS NULL OR 
        diabetes_type IN (
          'Type 1 Diabetes',
          'Type 2 Diabetes',
          'Gestational Diabetes',
          'Other / Not sure'
        )
      );
  END IF;
END $$;

-- 3. Ensure Row-Level Security (RLS) is strictly enabled
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 4. Create or replace RLS policies ensuring isolation
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'Users view own profile'
  ) THEN
    CREATE POLICY "Users view own profile" 
      ON public.profiles FOR SELECT 
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'Users insert own profile'
  ) THEN
    CREATE POLICY "Users insert own profile" 
      ON public.profiles FOR INSERT 
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'Users update own profile'
  ) THEN
    CREATE POLICY "Users update own profile" 
      ON public.profiles FOR UPDATE 
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'Users delete own profile'
  ) THEN
    CREATE POLICY "Users delete own profile" 
      ON public.profiles FOR DELETE 
      USING (auth.uid() = user_id);
  END IF;
END $$;

-- 5. Create index for fast user lookup
CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON public.profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_onboarding ON public.profiles(user_id, onboarding_completed);


-- 6. Immediately reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
