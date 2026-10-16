-- Migration: 20261016183000_create_patient_notification_settings.sql
-- Description: Creates patient_notification_settings table for multi-category notifications with RLS

CREATE TABLE IF NOT EXISTS public.patient_notification_settings (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.patient_notification_settings ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'patient_notification_settings' 
      AND policyname = 'Users can manage own notification settings'
  ) THEN
    CREATE POLICY "Users can manage own notification settings"
      ON public.patient_notification_settings
      FOR ALL
      TO authenticated
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;
