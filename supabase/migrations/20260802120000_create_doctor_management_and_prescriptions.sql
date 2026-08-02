-- Migration: Doctor Access Management & Digital Prescription System

-- 1. Add role column to profiles table
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'patient';

-- 2. Doctor Profiles Table
CREATE TABLE IF NOT EXISTS public.doctor_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  doctor_id TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  profile_picture TEXT,
  phone TEXT,
  email TEXT,
  registration_number TEXT NOT NULL,
  specialization TEXT NOT NULL,
  hospital_clinic_name TEXT NOT NULL,
  clinic_address TEXT,
  experience_years INTEGER DEFAULT 0,
  verification_status TEXT DEFAULT 'verified',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for doctor_id lookup
CREATE INDEX IF NOT EXISTS idx_doctor_profiles_doctor_id ON public.doctor_profiles(doctor_id);

-- 3. Patient Doctor Access Table
CREATE TABLE IF NOT EXISTS public.patient_doctor_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  doctor_id UUID NOT NULL REFERENCES public.doctor_profiles(id) ON DELETE CASCADE,
  access_level TEXT NOT NULL DEFAULT 'read_only', -- 'read_only', 'full', 'temporary'
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'accepted', 'rejected', 'revoked'
  expires_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(patient_id, doctor_id)
);

CREATE INDEX IF NOT EXISTS idx_patient_doctor_access_patient ON public.patient_doctor_access(patient_id);
CREATE INDEX IF NOT EXISTS idx_patient_doctor_access_doctor ON public.patient_doctor_access(doctor_id);
CREATE INDEX IF NOT EXISTS idx_patient_doctor_access_status ON public.patient_doctor_access(status);

-- 4. Prescriptions Table
CREATE TABLE IF NOT EXISTS public.prescriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  doctor_id UUID NOT NULL REFERENCES public.doctor_profiles(id) ON DELETE CASCADE,
  version INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'active', -- 'active', 'deactivated', 'replaced'
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_prescriptions_patient ON public.prescriptions(patient_id);
CREATE INDEX IF NOT EXISTS idx_prescriptions_doctor ON public.prescriptions(doctor_id);
CREATE INDEX IF NOT EXISTS idx_prescriptions_status ON public.prescriptions(status);

-- 5. Prescription Items Table
CREATE TABLE IF NOT EXISTS public.prescription_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prescription_id UUID NOT NULL REFERENCES public.prescriptions(id) ON DELETE CASCADE,
  time_slot TEXT NOT NULL, -- 'morning', 'lunch', 'afternoon', 'evening', 'night'
  insulin_name TEXT NOT NULL,
  dose_units REAL NOT NULL,
  instructions TEXT,
  remarks TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_prescription_items_prescription ON public.prescription_items(prescription_id);

-- 6. Patient Dose Logs Table
CREATE TABLE IF NOT EXISTS public.patient_dose_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  prescription_item_id UUID NOT NULL REFERENCES public.prescription_items(id) ON DELETE CASCADE,
  slot TEXT NOT NULL,
  taken_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_patient_dose_logs_patient ON public.patient_dose_logs(patient_id);

-- 7. Doctor Notes Table
CREATE TABLE IF NOT EXISTS public.doctor_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  doctor_id UUID NOT NULL REFERENCES public.doctor_profiles(id) ON DELETE CASCADE,
  note TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_doctor_notes_patient ON public.doctor_notes(patient_id);

-- 8. Notifications Table for Doctor/Patient Communications
CREATE TABLE IF NOT EXISTS public.doctor_patient_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL, -- 'request_sent', 'request_accepted', 'request_rejected', 'prescription_updated', 'note_added', 'access_removed', 'critical_alert'
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dp_notifications_recipient ON public.doctor_patient_notifications(recipient_id);

-- Enable RLS on new tables
ALTER TABLE public.doctor_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patient_doctor_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prescriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prescription_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patient_dose_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.doctor_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.doctor_patient_notifications ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- doctor_profiles policies
CREATE POLICY "Public doctor profile view" ON public.doctor_profiles
  FOR SELECT USING (true);

CREATE POLICY "Doctors can manage own profile" ON public.doctor_profiles
  FOR ALL USING (auth.uid() = id);

-- patient_doctor_access policies
CREATE POLICY "Patients can view their access records" ON public.patient_doctor_access
  FOR SELECT USING (auth.uid() = patient_id OR auth.uid() = doctor_id);

CREATE POLICY "Patients can insert access requests" ON public.patient_doctor_access
  FOR INSERT WITH CHECK (auth.uid() = patient_id);

CREATE POLICY "Patients and Doctors can update access records" ON public.patient_doctor_access
  FOR UPDATE USING (auth.uid() = patient_id OR auth.uid() = doctor_id);

CREATE POLICY "Patients can delete/revoke access" ON public.patient_doctor_access
  FOR DELETE USING (auth.uid() = patient_id);

-- prescriptions policies
CREATE POLICY "Patients can view prescriptions assigned to them" ON public.prescriptions
  FOR SELECT USING (
    auth.uid() = patient_id OR 
    EXISTS (
      SELECT 1 FROM public.patient_doctor_access 
      WHERE patient_id = prescriptions.patient_id 
        AND doctor_id = auth.uid() 
        AND status = 'accepted' 
        AND (expires_at IS NULL OR expires_at > NOW())
    )
  );

CREATE POLICY "Doctors with access can create prescriptions" ON public.prescriptions
  FOR INSERT WITH CHECK (
    auth.uid() = doctor_id AND
    EXISTS (
      SELECT 1 FROM public.patient_doctor_access 
      WHERE patient_id = prescriptions.patient_id 
        AND doctor_id = auth.uid() 
        AND status = 'accepted' 
        AND access_level = 'full'
        AND (expires_at IS NULL OR expires_at > NOW())
    )
  );

CREATE POLICY "Doctors with access can update prescriptions" ON public.prescriptions
  FOR UPDATE USING (
    auth.uid() = doctor_id AND
    EXISTS (
      SELECT 1 FROM public.patient_doctor_access 
      WHERE patient_id = prescriptions.patient_id 
        AND doctor_id = auth.uid() 
        AND status = 'accepted'
        AND access_level = 'full'
        AND (expires_at IS NULL OR expires_at > NOW())
    )
  );

-- prescription_items policies
CREATE POLICY "View prescription items" ON public.prescription_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.prescriptions p
      WHERE p.id = prescription_items.prescription_id
        AND (
          p.patient_id = auth.uid() OR
          EXISTS (
            SELECT 1 FROM public.patient_doctor_access pda
            WHERE pda.patient_id = p.patient_id
              AND pda.doctor_id = auth.uid()
              AND pda.status = 'accepted'
              AND (pda.expires_at IS NULL OR pda.expires_at > NOW())
          )
        )
    )
  );

CREATE POLICY "Doctors insert prescription items" ON public.prescription_items
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.prescriptions p
      WHERE p.id = prescription_items.prescription_id
        AND p.doctor_id = auth.uid()
    )
  );

-- patient_dose_logs policies
CREATE POLICY "Patients manage dose logs" ON public.patient_dose_logs
  FOR ALL USING (auth.uid() = patient_id);

CREATE POLICY "Doctors view dose logs" ON public.patient_dose_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.patient_doctor_access pda
      WHERE pda.patient_id = patient_dose_logs.patient_id
        AND pda.doctor_id = auth.uid()
        AND pda.status = 'accepted'
        AND (pda.expires_at IS NULL OR pda.expires_at > NOW())
    )
  );

-- doctor_notes policies
CREATE POLICY "View doctor notes" ON public.doctor_notes
  FOR SELECT USING (
    auth.uid() = patient_id OR
    (
      auth.uid() = doctor_id AND
      EXISTS (
        SELECT 1 FROM public.patient_doctor_access pda
        WHERE pda.patient_id = doctor_notes.patient_id
          AND pda.doctor_id = auth.uid()
          AND pda.status = 'accepted'
          AND (pda.expires_at IS NULL OR pda.expires_at > NOW())
      )
    )
  );

CREATE POLICY "Doctors write notes" ON public.doctor_notes
  FOR INSERT WITH CHECK (
    auth.uid() = doctor_id AND
    EXISTS (
      SELECT 1 FROM public.patient_doctor_access pda
      WHERE pda.patient_id = doctor_notes.patient_id
        AND pda.doctor_id = auth.uid()
        AND pda.status = 'accepted'
        AND pda.access_level = 'full'
        AND (pda.expires_at IS NULL OR pda.expires_at > NOW())
    )
  );

-- doctor_patient_notifications policies
CREATE POLICY "User notifications view and update" ON public.doctor_patient_notifications
  FOR ALL USING (auth.uid() = recipient_id OR auth.uid() = sender_id);
