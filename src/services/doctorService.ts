import { supabase } from "@/db/client";
import type { Database } from "@/db/types";

export type DoctorProfile = Database["public"]["Tables"]["doctor_profiles"]["Row"];
export type PatientDoctorAccess = Database["public"]["Tables"]["patient_doctor_access"]["Row"];
export type DoctorNote = Database["public"]["Tables"]["doctor_notes"]["Row"];

export interface DoctorPatientSummary {
  access_id: string;
  patient_id: string;
  patient_name: string;
  email: string | null;
  phone: string | null;
  access_level: string;
  expires_at: string | null;
  status: string;
  latest_glucose: number | null;
  latest_reading_time: string | null;
  reading_status: "critical" | "stable" | "no_recent";
  last_updated_at: string;
}

export const doctorService = {
  // Generate unique Doctor ID (e.g., DOC-89A4B2)
  generateDoctorId(): string {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let code = "DOC-";
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  },

  // Create doctor profile upon signup
  async createDoctorProfile(data: {
    id: string;
    full_name: string;
    phone?: string;
    email?: string;
    registration_number: string;
    specialization: string;
    hospital_clinic_name: string;
    clinic_address?: string;
    experience_years?: number;
  }): Promise<DoctorProfile | null> {
    const doctor_id = this.generateDoctorId();
    
    // 1. Update main user profile role
    await supabase.from("profiles").upsert({
      user_id: data.id,
      name: data.full_name,
      phone: data.phone || null,
      email: data.email || null,
      role: "doctor",
    });

    // 2. Insert into doctor_profiles
    const { data: doc, error } = await supabase
      .from("doctor_profiles")
      .insert({
        id: data.id,
        doctor_id,
        full_name: data.full_name,
        phone: data.phone || null,
        email: data.email || null,
        registration_number: data.registration_number,
        specialization: data.specialization,
        hospital_clinic_name: data.hospital_clinic_name,
        clinic_address: data.clinic_address || null,
        experience_years: data.experience_years || 0,
        verification_status: "verified",
      })
      .select()
      .single();

    if (error) {
      console.warn("Could not insert doctor profile into Supabase DB:", error.message);
      return null;
    }
    return doc;
  },

  // Fetch Doctor Profile by auth User ID
  async getDoctorProfile(userId: string): Promise<DoctorProfile | null> {
    try {
      const { data, error } = await supabase
        .from("doctor_profiles")
        .select("*")
        .eq("id", userId)
        .maybeSingle();

      if (error) {
        console.warn("getDoctorProfile notice:", error.message);
        return null;
      }
      return data;
    } catch {
      return null;
    }
  },

  // Fetch Doctor Profile by Doctor ID code (e.g., DOC-89A4B2)
  async getDoctorByDoctorIdCode(doctorIdCode: string): Promise<DoctorProfile | null> {
    try {
      const cleanCode = doctorIdCode.trim().toUpperCase();
      const { data, error } = await supabase
        .from("doctor_profiles")
        .select("*")
        .eq("doctor_id", cleanCode)
        .maybeSingle();

      if (error) {
        console.warn("getDoctorByDoctorIdCode notice:", error.message);
        return null;
      }
      return data;
    } catch {
      return null;
    }
  },

  // Patient sends access request to doctor
  async requestDoctorAccess(params: {
    patientId: string;
    doctorIdCode: string;
    accessLevel?: "read_only" | "full" | "temporary";
    expiresAt?: string | null;
  }) {
    const doctor = await this.getDoctorByDoctorIdCode(params.doctorIdCode);
    if (!doctor) {
      throw new Error(`Doctor with ID "${params.doctorIdCode}" was not found.`);
    }

    const { data, error } = await supabase
      .from("patient_doctor_access")
      .upsert({
        patient_id: params.patientId,
        doctor_id: doctor.id,
        access_level: params.accessLevel || "read_only",
        status: "pending",
        expires_at: params.expiresAt || null,
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw error;

    // Send Notification to Doctor
    try {
      await supabase.from("doctor_patient_notifications").insert({
        recipient_id: doctor.id,
        sender_id: params.patientId,
        type: "request_sent",
        title: "New Access Request",
        message: "A patient has requested to share medical access with you.",
      });
    } catch (e) {
      console.warn("Notification error ignored:", e);
    }

    return { access: data, doctor };
  },

  // Patient views connected doctors
  async getConnectedDoctors(patientId: string) {
    try {
      const { data, error } = await supabase
        .from("patient_doctor_access")
        .select("*, doctor_profiles(*)")
        .eq("patient_id", patientId);

      if (error) {
        console.warn("getConnectedDoctors notice:", error.message);
        return [];
      }
      return data || [];
    } catch {
      return [];
    }
  },

  // Doctor views pending access requests
  async getPendingRequests(doctorId: string) {
    try {
      const { data: accessRows, error } = await supabase
        .from("patient_doctor_access")
        .select("*")
        .eq("doctor_id", doctorId)
        .eq("status", "pending");

      if (error || !accessRows || accessRows.length === 0) return [];

      // Fetch patient names from profiles
      const patientIds = accessRows.map((a) => a.patient_id);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("*")
        .in("user_id", patientIds);

      const profileMap = new Map((profiles || []).map((p) => [p.user_id, p]));

      return accessRows.map((a) => ({
        ...a,
        patient_name: profileMap.get(a.patient_id)?.name || "Patient",
        email: profileMap.get(a.patient_id)?.email || null,
        phone: profileMap.get(a.patient_id)?.phone || null,
      }));
    } catch {
      return [];
    }
  },

  // Doctor responds to access request ('accepted' or 'rejected')
  async respondToAccessRequest(accessId: string, status: "accepted" | "rejected") {
    const { data, error } = await supabase
      .from("patient_doctor_access")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", accessId)
      .select()
      .single();

    if (error) throw error;

    // Notify Patient
    if (data) {
      try {
        await supabase.from("doctor_patient_notifications").insert({
          recipient_id: data.patient_id,
          sender_id: data.doctor_id,
          type: status === "accepted" ? "request_accepted" : "request_rejected",
          title: status === "accepted" ? "Doctor Accepted Access Request" : "Access Request Declined",
          message: status === "accepted" 
            ? "Your doctor accepted your connection request." 
            : "Your doctor declined your connection request.",
        });
      } catch (e) {
        console.warn("Notification error ignored:", e);
      }
    }

    return data;
  },

  // Patient revokes / deletes access for a doctor
  async revokeDoctorAccess(accessId: string) {
    const { data: accessRow } = await supabase
      .from("patient_doctor_access")
      .select("*")
      .eq("id", accessId)
      .maybeSingle();

    const { error } = await supabase
      .from("patient_doctor_access")
      .delete()
      .eq("id", accessId);

    if (error) throw error;

    if (accessRow) {
      try {
        await supabase.from("doctor_patient_notifications").insert({
          recipient_id: accessRow.doctor_id,
          sender_id: accessRow.patient_id,
          type: "access_removed",
          title: "Access Revoked",
          message: "A patient has removed access to their medical records.",
        });
      } catch (e) {
        console.warn("Notification error ignored:", e);
      }
    }
  },

  // Fetch connected patients for a doctor with filter support
  async getDoctorPatients(
    doctorId: string,
    filter: "all" | "critical" | "stable" | "recently_updated" | "no_recent_reading" = "all"
  ): Promise<DoctorPatientSummary[]> {
    try {
      // 1. Get accepted access records
      const { data: accessRows, error } = await supabase
        .from("patient_doctor_access")
        .select("*")
        .eq("doctor_id", doctorId)
        .eq("status", "accepted");

      if (error || !accessRows || accessRows.length === 0) return [];

      // Filter out expired temporary access
      const now = new Date().toISOString();
      const validAccess = accessRows.filter(
        (a) => !a.expires_at || a.expires_at > now
      );

      if (validAccess.length === 0) return [];

      const patientIds = validAccess.map((a) => a.patient_id);

      // 2. Fetch profiles
      const { data: profiles } = await supabase
        .from("profiles")
        .select("*")
        .in("user_id", patientIds);
      const profileMap = new Map((profiles || []).map((p) => [p.user_id, p]));

      // 3. Fetch latest glucose readings per patient
      const { data: readings } = await supabase
        .from("glucose_entries")
        .select("*")
        .in("user_id", patientIds)
        .order("date_time", { ascending: false });

      const latestGlucoseMap = new Map<string, { glucose: number; date_time: string }>();
      (readings || []).forEach((r) => {
        if (!latestGlucoseMap.has(r.user_id)) {
          latestGlucoseMap.set(r.user_id, { glucose: r.glucose, date_time: r.date_time });
        }
      });

      const summaries: DoctorPatientSummary[] = validAccess.map((acc) => {
        const p = profileMap.get(acc.patient_id);
        const latest = latestGlucoseMap.get(acc.patient_id);
        const glucoseVal = latest?.glucose ?? null;
        let status: "critical" | "stable" | "no_recent" = "no_recent";

        if (glucoseVal !== null) {
          if (glucoseVal < 70 || glucoseVal > 180) {
            status = "critical";
          } else {
            status = "stable";
          }
        }

        return {
          access_id: acc.id,
          patient_id: acc.patient_id,
          patient_name: p?.name || "Patient",
          email: p?.email || null,
          phone: p?.phone || null,
          access_level: acc.access_level,
          expires_at: acc.expires_at,
          status: acc.status,
          latest_glucose: glucoseVal,
          latest_reading_time: latest?.date_time || null,
          reading_status: status,
          last_updated_at: acc.updated_at,
        };
      });

      // Filter logic
      if (filter === "critical") {
        return summaries.filter((s) => s.reading_status === "critical");
      } else if (filter === "stable") {
        return summaries.filter((s) => s.reading_status === "stable");
      } else if (filter === "no_recent_reading") {
        return summaries.filter((s) => s.reading_status === "no_recent");
      } else if (filter === "recently_updated") {
        return summaries.sort(
          (a, b) => new Date(b.last_updated_at).getTime() - new Date(a.last_updated_at).getTime()
        );
      }

      return summaries;
    } catch {
      return [];
    }
  },

  // Doctor Notes CRUD
  async createDoctorNote(doctorId: string, patientId: string, note: string) {
    const { data, error } = await supabase
      .from("doctor_notes")
      .insert({
        doctor_id: doctorId,
        patient_id: patientId,
        note,
      })
      .select()
      .single();

    if (error) throw error;

    // Send notification to patient
    try {
      await supabase.from("doctor_patient_notifications").insert({
        recipient_id: patientId,
        sender_id: doctorId,
        type: "note_added",
        title: "New Doctor Note",
        message: "Your doctor has added a clinical note to your profile.",
      });
    } catch (e) {
      console.warn("Notification error ignored:", e);
    }

    return data;
  },

  async getDoctorNotes(patientId: string) {
    try {
      const { data, error } = await supabase
        .from("doctor_notes")
        .select("*, doctor_profiles(full_name, specialization)")
        .eq("patient_id", patientId)
        .order("created_at", { ascending: false });

      if (error) return [];
      return data || [];
    } catch {
      return [];
    }
  },
};
