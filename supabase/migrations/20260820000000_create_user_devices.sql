-- Migration: 20260820000000_create_user_devices.sql
-- Description: Create user_devices table for multi-device push notification tracking

CREATE TABLE IF NOT EXISTS public.user_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  device_token TEXT NOT NULL UNIQUE,
  device_type TEXT NOT NULL DEFAULT 'web',
  device_name TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_used_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Proper Indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_devices_user_active ON public.user_devices(user_id, is_active);
CREATE INDEX IF NOT EXISTS idx_user_devices_token ON public.user_devices(device_token);
CREATE INDEX IF NOT EXISTS idx_user_devices_last_used ON public.user_devices(last_used_at DESC);

-- Enable Row Level Security (RLS)
ALTER TABLE public.user_devices ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users view own devices" ON public.user_devices 
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users insert own devices" ON public.user_devices 
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own devices" ON public.user_devices 
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users delete own devices" ON public.user_devices 
  FOR DELETE USING (auth.uid() = user_id);

-- Trigger for automatic updated_at timestamp
CREATE TRIGGER trg_user_devices_updated 
BEFORE UPDATE ON public.user_devices 
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Migrate existing records from legacy push_tokens table if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'push_tokens'
  ) THEN
    INSERT INTO public.user_devices (
      user_id,
      device_token,
      device_type,
      device_name,
      is_active,
      last_used_at,
      created_at,
      updated_at
    )
    SELECT 
      user_id,
      token AS device_token,
      COALESCE(platform, 'web') AS device_type,
      device_name,
      true AS is_active,
      updated_at AS last_used_at,
      created_at,
      updated_at
    FROM public.push_tokens
    ON CONFLICT (device_token) 
    DO UPDATE SET 
      is_active = true,
      updated_at = now();
  END IF;
END $$;
