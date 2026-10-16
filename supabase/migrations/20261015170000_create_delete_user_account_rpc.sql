-- ============================================================================
-- Function: delete_user_account()
-- Description:
-- Securely and permanently deletes the authenticated user's own account from auth.users
-- and cascades cleanup to all associated patient records (glucose, insulin, weight,
-- devices, reminders, scans, and profile).
--
-- Security:
-- - Uses SECURITY DEFINER to allow deletion from auth.users
-- - Strictly derives identity from auth.uid() — cannot delete other users
-- - REVOKED from public and anon; GRANTED only to authenticated users
-- ============================================================================

CREATE OR REPLACE FUNCTION public.delete_user_account()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  target_user_id UUID;
BEGIN
  -- Derive user ID strictly from the verified JWT claim
  target_user_id := auth.uid();
  IF target_user_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: Calling identity is not authenticated.';
  END IF;

  -- 1. Explicitly clean up all health and reminder tables (defense-in-depth against orphans)
  DELETE FROM public.glucose_entries WHERE user_id = target_user_id;
  DELETE FROM public.insulin_entries WHERE user_id = target_user_id;
  DELETE FROM public.weight_entries WHERE user_id = target_user_id;
  DELETE FROM public.smart_scan_readings WHERE user_id = target_user_id;
  DELETE FROM public.patient_reminder_settings WHERE user_id = target_user_id;
  DELETE FROM public.reminders WHERE user_id = target_user_id;
  DELETE FROM public.reminder_history WHERE user_id = target_user_id;
  DELETE FROM public.push_tokens WHERE user_id = target_user_id;
  DELETE FROM public.user_devices WHERE user_id = target_user_id;
  DELETE FROM public.profiles WHERE user_id = target_user_id;

  -- 2. Permanently remove the authentication identity from auth.users
  DELETE FROM auth.users WHERE id = target_user_id;

  RETURN true;
END;
$$;

-- Restrict permissions
REVOKE ALL ON FUNCTION public.delete_user_account() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.delete_user_account() TO authenticated;
