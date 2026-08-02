import { supabase } from "@/db/client";
import type { Database } from "@/db/types";

export type Prescription = Database["public"]["Tables"]["prescriptions"]["Row"];
export type PrescriptionItem = Database["public"]["Tables"]["prescription_items"]["Row"];
export type PatientDoseLog = Database["public"]["Tables"]["patient_dose_logs"]["Row"];

export interface PrescriptionSlotInput {
  time_slot: "morning" | "lunch" | "afternoon" | "evening" | "night";
  insulin_name: string;
  dose_units: number;
  instructions?: string;
  remarks?: string;
}

export interface FullPrescription extends Prescription {
  doctor_name?: string;
  specialization?: string;
  hospital_clinic_name?: string;
  items: PrescriptionItem[];
}

export const prescriptionService = {
  // Create or Replace a Prescription for a Patient
  async createOrReplacePrescription(params: {
    patientId: string;
    doctorId: string;
    notes?: string;
    items: PrescriptionSlotInput[];
  }): Promise<FullPrescription> {
    // 1. Fetch current active prescription for versioning
    const { data: existingActive } = await supabase
      .from("prescriptions")
      .select("*")
      .eq("patient_id", params.patientId)
      .eq("status", "active")
      .order("version", { ascending: false });

    const newVersion = existingActive && existingActive.length > 0 ? existingActive[0].version + 1 : 1;

    // 2. Mark existing active prescriptions as 'replaced'
    if (existingActive && existingActive.length > 0) {
      for (const p of existingActive) {
        await supabase
          .from("prescriptions")
          .update({ status: "replaced", updated_at: new Date().toISOString() })
          .eq("id", p.id);
      }
    }

    // 3. Create new prescription
    const { data: newPrescription, error: presError } = await supabase
      .from("prescriptions")
      .insert({
        patient_id: params.patientId,
        doctor_id: params.doctorId,
        version: newVersion,
        status: "active",
        notes: params.notes || null,
      })
      .select()
      .single();

    if (presError) throw presError;

    // 4. Insert items for non-empty time slots
    const validItems = params.items.filter(
      (item) => item.insulin_name && item.insulin_name.trim() !== "" && item.dose_units > 0
    );

    const insertedItems: PrescriptionItem[] = [];
    if (validItems.length > 0) {
      const itemsToInsert = validItems.map((i) => ({
        prescription_id: newPrescription.id,
        time_slot: i.time_slot,
        insulin_name: i.insulin_name.trim(),
        dose_units: i.dose_units,
        instructions: i.instructions?.trim() || null,
        remarks: i.remarks?.trim() || null,
      }));

      const { data: items, error: itemsError } = await supabase
        .from("prescription_items")
        .insert(itemsToInsert)
        .select();

      if (itemsError) throw itemsError;
      if (items) insertedItems.push(...items);
    }

    // 5. Send notification to Patient
    await supabase.from("doctor_patient_notifications").insert({
      recipient_id: params.patientId,
      sender_id: params.doctorId,
      type: "prescription_updated",
      title: "New Digital Prescription",
      message: `Your doctor has updated your insulin prescription (Version ${newVersion}).`,
    });

    return {
      ...newPrescription,
      items: insertedItems,
    };
  },

  // Deactivate current active prescription
  async deactivatePrescription(prescriptionId: string, doctorId: string) {
    const { data: pres } = await supabase
      .from("prescriptions")
      .select("*")
      .eq("id", prescriptionId)
      .single();

    const { data, error } = await supabase
      .from("prescriptions")
      .update({ status: "deactivated", updated_at: new Date().toISOString() })
      .eq("id", prescriptionId)
      .select()
      .single();

    if (error) throw error;

    if (pres) {
      await supabase.from("doctor_patient_notifications").insert({
        recipient_id: pres.patient_id,
        sender_id: doctorId,
        type: "prescription_updated",
        title: "Prescription Deactivated",
        message: "Your doctor deactivated your current insulin prescription.",
      });
    }

    return data;
  },

  // Fetch current active prescription for a patient
  async getActivePrescription(patientId: string): Promise<FullPrescription | null> {
    const { data: pres, error } = await supabase
      .from("prescriptions")
      .select("*, doctor_profiles(full_name, specialization, hospital_clinic_name)")
      .eq("patient_id", patientId)
      .eq("status", "active")
      .order("version", { ascending: false })
      .maybeSingle();

    if (error && error.code !== "PGRST116") throw error;
    if (!pres) return null;

    const { data: items } = await supabase
      .from("prescription_items")
      .select("*")
      .eq("prescription_id", pres.id);

    const docProfile = (pres as any).doctor_profiles;

    return {
      ...pres,
      doctor_name: docProfile?.full_name || "Doctor",
      specialization: docProfile?.specialization || "",
      hospital_clinic_name: docProfile?.hospital_clinic_name || "",
      items: items || [],
    };
  },

  // Fetch all historical prescription revisions for a patient
  async getPrescriptionHistory(patientId: string): Promise<FullPrescription[]> {
    const { data: presList, error } = await supabase
      .from("prescriptions")
      .select("*, doctor_profiles(full_name, specialization, hospital_clinic_name)")
      .eq("patient_id", patientId)
      .order("version", { ascending: false });

    if (error) throw error;
    if (!presList || presList.length === 0) return [];

    const presIds = presList.map((p) => p.id);
    const { data: allItems } = await supabase
      .from("prescription_items")
      .select("*")
      .in("prescription_id", presIds);

    const itemsMap = new Map<string, PrescriptionItem[]>();
    (allItems || []).forEach((item) => {
      if (!itemsMap.has(item.prescription_id)) {
        itemsMap.set(item.prescription_id, []);
      }
      itemsMap.get(item.prescription_id)!.push(item);
    });

    return presList.map((pres) => {
      const docProfile = (pres as any).doctor_profiles;
      return {
        ...pres,
        doctor_name: docProfile?.full_name || "Doctor",
        specialization: docProfile?.specialization || "",
        hospital_clinic_name: docProfile?.hospital_clinic_name || "",
        items: itemsMap.get(pres.id) || [],
      };
    });
  },

  // Patient logs dose as taken
  async logDoseTaken(params: {
    patientId: string;
    prescriptionItemId: string;
    slot: string;
  }): Promise<PatientDoseLog> {
    const { data, error } = await supabase
      .from("patient_dose_logs")
      .insert({
        patient_id: params.patientId,
        prescription_item_id: params.prescriptionItemId,
        slot: params.slot,
        taken_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // Fetch dose logs for today
  async getTodayDoseLogs(patientId: string): Promise<PatientDoseLog[]> {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const { data, error } = await supabase
      .from("patient_dose_logs")
      .select("*")
      .eq("patient_id", patientId)
      .gte("taken_at", todayStart.toISOString());

    if (error) throw error;
    return data || [];
  },
};
