-- Migration: 20260902140000_create_patient_reminder_settings.sql
-- Description: Create patient_reminder_settings table for lightweight insulin & glucose check reminders

-- 1. Create table
CREATE TABLE IF NOT EXISTS public.patient_reminder_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  insulin_reminder_enabled BOOLEAN NOT NULL DEFAULT false,
  insulin_reminder_time TEXT NOT NULL DEFAULT '20:00',
  glucose_reminder_enabled BOOLEAN NOT NULL DEFAULT false,
  glucose_reminder_days INTEGER NOT NULL DEFAULT 2,
  last_insulin_reminder_at TIMESTAMPTZ,
  last_glucose_reminder_at TIMESTAMPTZ,
  user_timezone TEXT DEFAULT 'UTC',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Performance indexes
CREATE INDEX IF NOT EXISTS idx_reminder_settings_user ON public.patient_reminder_settings(user_id);
CREATE INDEX IF NOT EXISTS idx_reminder_settings_enabled ON public.patient_reminder_settings(insulin_reminder_enabled, glucose_reminder_enabled);

-- 3. Enable Row Level Security (RLS)
ALTER TABLE public.patient_reminder_settings ENABLE ROW LEVEL SECURITY;

-- 4. User Isolation RLS Policies
DROP POLICY IF EXISTS "Users view own reminder settings" ON public.patient_reminder_settings;
CREATE POLICY "Users view own reminder settings" ON public.patient_reminder_settings 
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users insert own reminder settings" ON public.patient_reminder_settings;
CREATE POLICY "Users insert own reminder settings" ON public.patient_reminder_settings 
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users update own reminder settings" ON public.patient_reminder_settings;
CREATE POLICY "Users update own reminder settings" ON public.patient_reminder_settings 
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users delete own reminder settings" ON public.patient_reminder_settings;
CREATE POLICY "Users delete own reminder settings" ON public.patient_reminder_settings 
  FOR DELETE USING (auth.uid() = user_id);

-- 5. Updated_at function & trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_patient_reminder_settings_updated ON public.patient_reminder_settings;
CREATE TRIGGER trg_patient_reminder_settings_updated 
BEFORE UPDATE ON public.patient_reminder_settings 
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
