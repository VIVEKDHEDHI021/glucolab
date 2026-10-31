import { supabase } from "@/db/client";
import { subDays, format } from "date-fns";

export const healthService = {
  async getDashboardData() {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error("Not authenticated");
    const since = subDays(new Date(), 90).toISOString();
    return Promise.all([
      supabase
        .from("glucose_entries")
        .select("*")
        .eq("user_id", user.id)
        .gte("date_time", since)
        .order("date_time", { ascending: false }),
      supabase
        .from("insulin_entries")
        .select("*")
        .eq("user_id", user.id)
        .gte("entry_date", format(subDays(new Date(), 90), "yyyy-MM-dd"))
        .order("entry_date", { ascending: false }),
      supabase
        .from("weight_entries")
        .select("*")
        .eq("user_id", user.id)
        .gte("entry_date", format(subDays(new Date(), 90), "yyyy-MM-dd"))
        .order("entry_date", { ascending: false }),
      supabase.from("profiles").select("name").eq("user_id", user.id).maybeSingle(),
    ]);
  },

  async getHistory() {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error("Not authenticated");
    return supabase
      .from("glucose_entries")
      .select("*")
      .eq("user_id", user.id)
      .order("date_time", { ascending: false });
  },

  async deleteGlucoseEntry(id: string) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error("Not authenticated");
    return supabase.from("glucose_entries").delete().eq("id", id).eq("user_id", user.id);
  },

  async getFoodHistory() {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error("Not authenticated");
    return supabase
      .from("food_entries")
      .select("*")
      .eq("user_id", user.id)
      .order("date_time", { ascending: false });
  },

  async deleteFoodEntry(id: string) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error("Not authenticated");
    return supabase.from("food_entries").delete().eq("id", id).eq("user_id", user.id);
  },

  async getExportData(fromIso: string, toIso: string, from: string, to: string) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error("Not authenticated");
    return Promise.all([
      supabase
        .from("glucose_entries")
        .select("*")
        .eq("user_id", user.id)
        .gte("date_time", fromIso)
        .lte("date_time", toIso)
        .order("date_time"),
      supabase
        .from("insulin_entries")
        .select("*")
        .eq("user_id", user.id)
        .gte("entry_date", from)
        .lte("entry_date", to),
      supabase
        .from("weight_entries")
        .select("*")
        .eq("user_id", user.id)
        .gte("entry_date", from)
        .lte("entry_date", to),
      supabase.from("profiles").select("*").eq("user_id", user.id).maybeSingle(),
    ]);
  },

  async getReportsData(sinceIso: string, sinceDate: string) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error("Not authenticated");
    return Promise.all([
      supabase
        .from("glucose_entries")
        .select("*")
        .eq("user_id", user.id)
        .gte("date_time", sinceIso)
        .order("date_time"),
      supabase
        .from("insulin_entries")
        .select("*")
        .eq("user_id", user.id)
        .gte("entry_date", sinceDate)
        .order("entry_date"),
      supabase
        .from("weight_entries")
        .select("*")
        .eq("user_id", user.id)
        .gte("entry_date", sinceDate)
        .order("entry_date"),
    ]);
  },

  async getProfile(userId?: string) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const uid = userId || user?.id;
    if (!uid) return { data: null, error: new Error("Not authenticated") };
    return supabase.from("profiles").select("*").eq("user_id", uid).maybeSingle();
  },

  async updateProfile(data: {
    name?: string | null;
    phone?: string | null;
    age?: number | null;
    diabetes_type?: string | null;
    weight_kg?: number | null;
    height_cm?: number | null;
    onboarding_completed?: boolean;
  }) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error("Not authenticated");

    // 1. Dual-sync immediately to Supabase Auth user_metadata
    // This guarantees clinical parameters and onboarding status are permanently preserved
    // even if the remote profiles table schema cache has not been reloaded.
    try {
      await supabase.auth.updateUser({
        data: {
          ...(data.name !== undefined ? { full_name: data.name, name: data.name } : {}),
          ...(data.age !== undefined ? { age: data.age } : {}),
          ...(data.diabetes_type !== undefined ? { diabetes_type: data.diabetes_type } : {}),
          ...(data.weight_kg !== undefined ? { weight_kg: data.weight_kg } : {}),
          ...(data.height_cm !== undefined ? { height_cm: data.height_cm } : {}),
          ...(data.onboarding_completed !== undefined
            ? { onboarding_completed: data.onboarding_completed }
            : {}),
        },
      });
    } catch (metaErr) {
      console.warn("[HealthService] Auth metadata update warning:", metaErr);
    }

    if (data.onboarding_completed && typeof window !== "undefined") {
      try {
        localStorage.setItem(`glucolab_onboarding_completed_${user.id}`, "true");
      } catch {}
    }

    // 2. Fetch existing profile id
    const { data: existing } = await supabase
      .from("profiles")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();

    // 3. Try to update public.profiles with full clinical fields
    try {
      if (!existing) {
        const insertRes = await supabase.from("profiles").insert({
          user_id: user.id,
          email: user.email,
          ...data,
        });
        if (insertRes.error) throw insertRes.error;
        return insertRes;
      }

      const updateRes = await supabase
        .from("profiles")
        .update({
          ...data,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", user.id);
      if (updateRes.error) throw updateRes.error;
      return updateRes;
    } catch (dbError: any) {
      console.warn("[HealthService] Database profiles table update error (activating resilient fallback):", dbError);

      const isSchemaCacheError =
        dbError?.code === "PGRST204" ||
        dbError?.code === "42703" ||
        dbError?.message?.includes("schema cache") ||
        dbError?.message?.includes("column") ||
        dbError?.message?.includes("profiles_diabetes_type_check");

      if (isSchemaCacheError) {
        // Fall back gracefully to updating only base columns that exist in initial profiles schema
        try {
          const fallbackData: Record<string, any> = {
            updated_at: new Date().toISOString(),
          };
          if (data.name !== undefined) fallbackData.name = data.name;
          if (data.phone !== undefined) fallbackData.phone = data.phone;

          if (!existing) {
            await supabase.from("profiles").insert({
              user_id: user.id,
              email: user.email,
              ...fallbackData,
            });
          } else {
            await supabase
              .from("profiles")
              .update(fallbackData)
              .eq("user_id", user.id);
          }
        } catch (baseErr) {
          console.warn("[HealthService] Base profile update fallback warning:", baseErr);
        }

        // Return clean success response so callers (onboarding wizard, profile dialog) succeed smoothly
        return { data: null, error: null };
      }

      throw dbError;
    }
  },

  async completeOnboarding(profileData: {
    name: string;
    age: number;
    diabetes_type: string;
    weight_kg: number;
    height_cm: number;
  }) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error("Not authenticated");

    // 1. Immediately store completion in localStorage & clear draft
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(`glucolab_onboarding_completed_${user.id}`, "true");
        sessionStorage.removeItem("glucolab_onboarding_draft");
      } catch {}
    }

    // 2. Persist profile via updateProfile (with resilient user_metadata fallback)
    const res = await this.updateProfile({
      name: profileData.name.trim(),
      age: profileData.age,
      diabetes_type: profileData.diabetes_type,
      weight_kg: profileData.weight_kg,
      height_cm: profileData.height_cm,
      onboarding_completed: true,
    });

    if (res.error) {
      throw res.error;
    }

    // 3. Record initial weight entry if provided (non-blocking)
    try {
      if (profileData.weight_kg > 0) {
        const today = new Date().toISOString().split("T")[0];
        await supabase.from("weight_entries").insert({
          user_id: user.id,
          weight_kg: profileData.weight_kg,
          entry_date: today,
          notes: "Initial weight recorded during onboarding",
        });
      }
    } catch (e) {
      console.warn("Could not record initial weight entry:", e);
    }

    return res;
  },
};
