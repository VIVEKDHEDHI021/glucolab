-- Migration: 20260918000000_add_insulin_schedules_and_logs.sql
-- Description: Add insulin_schedules JSONB column to patient_reminder_settings for multi-dose daily insulin reminders

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'patient_reminder_settings' 
      AND column_name = 'insulin_schedules'
  ) THEN
    ALTER TABLE public.patient_reminder_settings
    ADD COLUMN insulin_schedules JSONB DEFAULT '[
      {"id":"morning","label":"Morning","time":"08:00","enabled":false,"last_sent_at":null,"completed_at":null,"dismissed_at":null},
      {"id":"afternoon","label":"Afternoon","time":"13:00","enabled":false,"last_sent_at":null,"completed_at":null,"dismissed_at":null},
      {"id":"evening","label":"Evening","time":"19:00","enabled":false,"last_sent_at":null,"completed_at":null,"dismissed_at":null},
      {"id":"night","label":"Night","time":"22:00","enabled":false,"last_sent_at":null,"completed_at":null,"dismissed_at":null}
    ]'::jsonb;
  END IF;
END $$;

-- Populate insulin_schedules for any existing rows that have NULL insulin_schedules
UPDATE public.patient_reminder_settings
SET insulin_schedules = jsonb_build_array(
  jsonb_build_object(
    'id', 'morning',
    'label', 'Morning',
    'time', '08:00',
    'enabled', false,
    'last_sent_at', null,
    'completed_at', null,
    'dismissed_at', null
  ),
  jsonb_build_object(
    'id', 'afternoon',
    'label', 'Afternoon',
    'time', '13:00',
    'enabled', false,
    'last_sent_at', null,
    'completed_at', null,
    'dismissed_at', null
  ),
  jsonb_build_object(
    'id', 'evening',
    'label', 'Evening',
    'time', COALESCE(insulin_reminder_time, '19:00'),
    'enabled', COALESCE(insulin_reminder_enabled, false),
    'last_sent_at', last_insulin_reminder_at,
    'completed_at', null,
    'dismissed_at', null
  ),
  jsonb_build_object(
    'id', 'night',
    'label', 'Night',
    'time', '22:00',
    'enabled', false,
    'last_sent_at', null,
    'completed_at', null,
    'dismissed_at', null
  )
)
WHERE insulin_schedules IS NULL;
