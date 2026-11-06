-- ====================================================================
-- GLUCOLAB V1.6: DATA INTEGRITY, INSULIN UNIQUENESS & IDEMPOTENCY MIGRATION
-- ====================================================================

-- 1. Ensure user_id + entry_date uniqueness on insulin_entries
DO $$
BEGIN
  -- Check if unique constraint already exists
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.table_constraints 
    WHERE table_name = 'insulin_entries' 
      AND constraint_type = 'UNIQUE'
      AND constraint_name = 'insulin_entries_user_id_entry_date_key'
  ) AND NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.insulin_entries'::regclass
      AND contype = 'u'
      AND array_to_string(conkey, ',') = (
        SELECT array_to_string(array_agg(attnum ORDER BY attnum), ',')
        FROM pg_attribute
        WHERE attrelid = 'public.insulin_entries'::regclass
          AND attname IN ('user_id', 'entry_date')
      )
  ) THEN
    -- If duplicate rows exist, safely consolidate by keeping newest updated_at
    DELETE FROM public.insulin_entries a
    USING public.insulin_entries b
    WHERE a.user_id = b.user_id 
      AND a.entry_date = b.entry_date 
      AND (a.updated_at < b.updated_at OR (a.updated_at = b.updated_at AND a.id < b.id));

    ALTER TABLE public.insulin_entries 
    ADD CONSTRAINT insulin_entries_user_id_entry_date_key UNIQUE (user_id, entry_date);
  END IF;
END $$;

-- 2. Fast lookup index on insulin_entries(user_id, entry_date DESC)
CREATE INDEX IF NOT EXISTS idx_insulin_user_entry_date_desc 
ON public.insulin_entries(user_id, entry_date DESC);

-- 3. Fast lookup index on glucose_entries(user_id, date_time DESC)
CREATE INDEX IF NOT EXISTS idx_glucose_user_datetime_desc 
ON public.glucose_entries(user_id, date_time DESC);

