-- Migration: 20260926000000_remove_notification_system.sql
-- Description: Completely removes push notification, device token, reminder, and alert tables

DROP TABLE IF EXISTS public.user_devices CASCADE;
DROP TABLE IF EXISTS public.push_tokens CASCADE;
DROP TABLE IF EXISTS public.reminder_history CASCADE;
DROP TABLE IF EXISTS public.reminders CASCADE;
DROP TABLE IF EXISTS public.patient_reminder_settings CASCADE;
