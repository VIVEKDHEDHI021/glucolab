-- Create reminders table
CREATE TABLE public.reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category TEXT NOT NULL, -- 'insulin', 'medication', 'glucose', 'meal', 'water', 'exercise', 'sleep', 'appointment', 'lab_test', 'supply'
  title TEXT NOT NULL,
  description TEXT,
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  schedule_type TEXT NOT NULL, -- 'daily', 'weekly', 'monthly', 'custom_days', 'interval', 'one_time'
  schedule_data JSONB NOT NULL, -- e.g. { times: ["08:00", "20:00"], days: [1,3,5], intervalMinutes: 60 }
  reminder_data JSONB NOT NULL, -- Holds category-specific details: { dosage: "10", unit: "units", notes: "Before lunch", medicine_name: "Metformin" }
  sound TEXT NOT NULL DEFAULT 'default',
  vibrate BOOLEAN NOT NULL DEFAULT true,
  sync_status TEXT NOT NULL DEFAULT 'synced',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create reminder_history table
CREATE TABLE public.reminder_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reminder_id UUID REFERENCES public.reminders(id) ON DELETE SET NULL,
  category TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  scheduled_time TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL, -- 'triggered' | 'completed' | 'skipped' | 'snoozed' | 'missed'
  action_taken TEXT, -- 'taken' | 'skip' | 'snooze' | 'scan' | 'manual_entry' | 'later'
  action_time TIMESTAMPTZ,
  notes TEXT,
  sync_status TEXT NOT NULL DEFAULT 'synced',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reminder_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users access own reminders" ON public.reminders FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users access own history" ON public.reminder_history FOR ALL USING (auth.uid() = user_id);

-- Performance Indexes
CREATE INDEX idx_reminders_user_cat ON public.reminders(user_id, category);
CREATE INDEX idx_reminder_history_user_time ON public.reminder_history(user_id, scheduled_time DESC);

-- Trigger for updated_at
CREATE TRIGGER trg_reminders_updated BEFORE UPDATE ON public.reminders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_reminder_history_updated BEFORE UPDATE ON public.reminder_history FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
