-- Migration: 20261106120000_create_insulin_slots_parent_child.sql
-- Description: Parent-child architecture for individual insulin slot management connected to daily schedules

-- 1. Create Child Table: public.insulin_slots
CREATE TABLE IF NOT EXISTS public.insulin_slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id UUID NOT NULL REFERENCES public.insulin_entries(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  slot_type TEXT NOT NULL CHECK (slot_type IN ('morning', 'lunch', 'afternoon', 'evening', 'night')),
  units INTEGER NOT NULL CHECK (units >= 0 AND units <= 200),
  notes TEXT,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_insulin_slots_schedule_slot UNIQUE (schedule_id, slot_type)
);

-- 2. Indexes for fast slot querying
CREATE INDEX IF NOT EXISTS idx_insulin_slots_schedule ON public.insulin_slots(schedule_id);
CREATE INDEX IF NOT EXISTS idx_insulin_slots_user_schedule ON public.insulin_slots(user_id, schedule_id);
CREATE INDEX IF NOT EXISTS idx_insulin_slots_user_date ON public.insulin_slots(user_id, recorded_at DESC);

-- 3. Row Level Security
ALTER TABLE public.insulin_slots ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'insulin_slots' AND policyname = 'Users select own insulin slots') THEN
    CREATE POLICY "Users select own insulin slots" ON public.insulin_slots FOR SELECT USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'insulin_slots' AND policyname = 'Users insert own insulin slots') THEN
    CREATE POLICY "Users insert own insulin slots" ON public.insulin_slots FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'insulin_slots' AND policyname = 'Users update own insulin slots') THEN
    CREATE POLICY "Users update own insulin slots" ON public.insulin_slots FOR UPDATE USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'insulin_slots' AND policyname = 'Users delete own insulin slots') THEN
    CREATE POLICY "Users delete own insulin slots" ON public.insulin_slots FOR DELETE USING (auth.uid() = user_id);
  END IF;
END $$;

-- 4. Trigger to automatically keep updated_at current
CREATE OR REPLACE FUNCTION public.update_insulin_slots_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_insulin_slots_updated ON public.insulin_slots;
CREATE TRIGGER trg_insulin_slots_updated
  BEFORE UPDATE ON public.insulin_slots
  FOR EACH ROW
  EXECUTE FUNCTION public.update_insulin_slots_updated_at();

-- 5. Safe historical backfill from insulin_entries into insulin_slots
-- (Only inserts positive units, never overwrites existing records)
INSERT INTO public.insulin_slots (schedule_id, user_id, slot_type, units, recorded_at, created_at, updated_at)
SELECT id, user_id, 'morning', ROUND(morning)::integer, created_at, created_at, updated_at
FROM public.insulin_entries WHERE morning IS NOT NULL AND morning > 0
ON CONFLICT (schedule_id, slot_type) DO NOTHING;

INSERT INTO public.insulin_slots (schedule_id, user_id, slot_type, units, recorded_at, created_at, updated_at)
SELECT id, user_id, 'lunch', ROUND(lunch)::integer, created_at, created_at, updated_at
FROM public.insulin_entries WHERE lunch IS NOT NULL AND lunch > 0
ON CONFLICT (schedule_id, slot_type) DO NOTHING;

INSERT INTO public.insulin_slots (schedule_id, user_id, slot_type, units, recorded_at, created_at, updated_at)
SELECT id, user_id, 'afternoon', ROUND(afternoon)::integer, created_at, created_at, updated_at
FROM public.insulin_entries WHERE afternoon IS NOT NULL AND afternoon > 0
ON CONFLICT (schedule_id, slot_type) DO NOTHING;

INSERT INTO public.insulin_slots (schedule_id, user_id, slot_type, units, recorded_at, created_at, updated_at)
SELECT id, user_id, 'evening', ROUND(evening)::integer, created_at, created_at, updated_at
FROM public.insulin_entries WHERE evening IS NOT NULL AND evening > 0
ON CONFLICT (schedule_id, slot_type) DO NOTHING;

INSERT INTO public.insulin_slots (schedule_id, user_id, slot_type, units, recorded_at, created_at, updated_at)
SELECT id, user_id, 'night', ROUND(night)::integer, created_at, created_at, updated_at
FROM public.insulin_entries WHERE night IS NOT NULL AND night > 0
ON CONFLICT (schedule_id, slot_type) DO NOTHING;
