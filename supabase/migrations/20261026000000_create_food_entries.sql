-- ============================================================================
-- MIGRATION: Create Food Entries Table with Row Level Security (RLS)
-- Description:
-- Stores patient food logs, quick food context, and whole-day meals.
-- Strictly enforces RLS so patients can only access their own food records.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.food_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  food_categories TEXT[] NOT NULL DEFAULT '{}',
  portion_category TEXT CHECK (portion_category IN ('small', 'regular', 'large', 'unspecified')),
  meal_period TEXT CHECK (meal_period IN ('Breakfast', 'Lunch', 'Dinner', 'Morning snack', 'Evening snack', 'Other time', 'BB', 'AB', 'BL', 'AL', 'BD', 'AD', 'BT', 'Fasting', 'recent')),
  date_time TIMESTAMPTZ NOT NULL DEFAULT now(),
  notes TEXT,
  is_uncertain BOOLEAN NOT NULL DEFAULT FALSE,
  glucose_entry_id UUID REFERENCES public.glucose_entries(id) ON DELETE SET NULL,
  sync_status TEXT DEFAULT 'synced',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 1. Enable Row Level Security
ALTER TABLE public.food_entries ENABLE ROW LEVEL SECURITY;

-- 2. Revoke all from anon/public
REVOKE ALL ON public.food_entries FROM anon;

-- 3. Create Indexes for query performance
CREATE INDEX IF NOT EXISTS idx_food_entries_user_date ON public.food_entries(user_id, date_time DESC);
CREATE INDEX IF NOT EXISTS idx_food_entries_glucose_id ON public.food_entries(glucose_entry_id);

-- 4. RLS Policies strictly for authenticated owner
DROP POLICY IF EXISTS "Users view own food" ON public.food_entries;
CREATE POLICY "Users view own food" ON public.food_entries
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users insert own food" ON public.food_entries;
CREATE POLICY "Users insert own food" ON public.food_entries
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users update own food" ON public.food_entries;
CREATE POLICY "Users update own food" ON public.food_entries
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users delete own food" ON public.food_entries;
CREATE POLICY "Users delete own food" ON public.food_entries
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);
