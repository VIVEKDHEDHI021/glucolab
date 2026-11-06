-- Migration: 20261106130000_create_idempotency_keys.sql
-- Description: Server-side durable idempotency store for create mutations

CREATE TABLE IF NOT EXISTS public.idempotency_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  entity TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('in_flight', 'completed', 'failed')),
  response_data JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '24 hours')
);

ALTER TABLE public.idempotency_keys ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_idempotency_key_lookup ON public.idempotency_keys(key);
CREATE INDEX IF NOT EXISTS idx_idempotency_user_expires ON public.idempotency_keys(user_id, expires_at);

-- RLS policies
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'idempotency_keys' AND policyname = 'Users select own idempotency keys') THEN
    CREATE POLICY "Users select own idempotency keys" ON public.idempotency_keys FOR SELECT USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'idempotency_keys' AND policyname = 'Users insert own idempotency keys') THEN
    CREATE POLICY "Users insert own idempotency keys" ON public.idempotency_keys FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'idempotency_keys' AND policyname = 'Users update own idempotency keys') THEN
    CREATE POLICY "Users update own idempotency keys" ON public.idempotency_keys FOR UPDATE USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'idempotency_keys' AND policyname = 'Users delete own idempotency keys') THEN
    CREATE POLICY "Users delete own idempotency keys" ON public.idempotency_keys FOR DELETE USING (auth.uid() = user_id);
  END IF;
END $$;
