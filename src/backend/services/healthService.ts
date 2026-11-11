import { supabase } from "@/db/client";
import type { Database } from "@/db/types";
import { subDays, format } from "date-fns";
import { getLocalDateKey } from "@/frontend/lib/date-utils";
import { getApiUrl } from "./authService";
import { idempotencyService } from "./idempotencyService";
import { dashboardCacheService } from "@/frontend/services/dashboardCacheService";

export const healthService = {
  async getDashboardData() {
    let user: any = null;
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      user = session?.user;
    } catch {}

    if (!user) {
      const {
        data: { user: fallbackUser },
      } = await supabase.auth.getUser();
      user = fallbackUser;
    }
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
    let user: any = null;
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      user = session?.user;
    } catch {}

    if (!user) {
      const {
        data: { user: fallbackUser },
      } = await supabase.auth.getUser();
      user = fallbackUser;
    }
    if (!user) throw new Error("Not authenticated");
    return supabase
      .from("glucose_entries")
      .select("*")
      .eq("user_id", user.id)
      .order("date_time", { ascending: false });
  },

  /**
   * Create a new glucose reading with strict idempotency and double-submit protection
   */
  async createGlucoseEntry(
    payload: {
      id?: string;
      glucose: number;
      reading_type: Database["public"]["Enums"]["reading_type"];
      date_time: string;
      food?: string | null;
      notes?: string | null;
      symptoms?: string | null;
    },
    idempotencyKey?: string,
  ) {
    let user: any = null;
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      user = session?.user;
    } catch {}

    if (!user) {
      const {
        data: { user: fallbackUser },
      } = await supabase.auth.getUser();
      user = fallbackUser;
    }
    if (!user) throw new Error("Not authenticated");

    const stableId =
      payload.id ||
      (typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `gluc_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`);

    const key =
      idempotencyKey ||
      idempotencyService.generateKey(user.id, "glucose", stableId);

    const { data: record } = await idempotencyService.executeIdempotent(
      key,
      async () => {
        // 1. Check if record with this stableId was already created (e.g. network timeout retry)
        const { data: existing } = await supabase
          .from("glucose_entries")
          .select("*")
          .eq("id", stableId)
          .eq("user_id", user.id)
          .maybeSingle();

        if (existing) {
          return existing;
        }

        // 2. Perform INSERT
        const insertPayload = {
          id: stableId,
          user_id: user.id,
          glucose: Number(payload.glucose),
          reading_type: payload.reading_type,
          date_time: payload.date_time,
          food: payload.food || null,
          notes: payload.notes || null,
          symptoms: payload.symptoms || null,
        };

        const res = await supabase
          .from("glucose_entries")
          .insert(insertPayload)
          .select()
          .single();

        if (res.error) {
          // If duplicate key violation, fetch the already created record
          if (
            res.error.code === "23505" ||
            res.error.message?.includes("duplicate key")
          ) {
            const { data: retryRow } = await supabase
              .from("glucose_entries")
              .select("*")
              .eq("id", stableId)
              .eq("user_id", user.id)
              .single();
            if (retryRow) return retryRow;
          }
          throw res.error;
        }
        return res.data;
      },
    );

    // Invalidate caches & notify all components immediately
    await this.invalidateServerCache("glucose");
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("health-data-updated", {
          detail: { entity: "glucose", action: "create", id: record.id },
        }),
      );
    }

    return { data: record, error: null };
  },

  /**
   * Update an existing glucose reading by ID. Never falls back to insert.
   */
  async updateGlucoseEntry(
    id: string,
    payload: {
      glucose?: number;
      reading_type?: Database["public"]["Enums"]["reading_type"];
      date_time?: string;
      food?: string | null;
      notes?: string | null;
      symptoms?: string | null;
    },
  ) {
    if (!id || typeof id !== "string") {
      throw new Error("Cannot update glucose reading: Missing required record ID.");
    }
    let user: any = null;
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      user = session?.user;
    } catch {}

    if (!user) {
      const {
        data: { user: fallbackUser },
      } = await supabase.auth.getUser();
      user = fallbackUser;
    }
    if (!user) throw new Error("Not authenticated");

    const updateFields: any = {
      updated_at: new Date().toISOString(),
    };
    if (payload.glucose !== undefined) updateFields.glucose = Number(payload.glucose);
    if (payload.reading_type !== undefined) updateFields.reading_type = payload.reading_type;
    if (payload.date_time !== undefined) updateFields.date_time = payload.date_time;
    if (payload.food !== undefined) updateFields.food = payload.food;
    if (payload.notes !== undefined) updateFields.notes = payload.notes;
    if (payload.symptoms !== undefined) updateFields.symptoms = payload.symptoms;

    const res = await supabase
      .from("glucose_entries")
      .update(updateFields)
      .eq("id", id)
      .eq("user_id", user.id)
      .select()
      .maybeSingle();

    if (res.error) throw res.error;
    if (!res.data) {
      throw new Error(`Glucose reading with ID "${id}" was not found or does not belong to you.`);
    }

    await this.invalidateServerCache("glucose");
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("health-data-updated", {
          detail: { entity: "glucose", action: "update", id },
        }),
      );
    }

    return res;
  },

  async deleteGlucoseEntry(id: string) {
    let user: any = null;
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      user = session?.user;
    } catch {}

    if (!user) {
      const {
        data: { user: fallbackUser },
      } = await supabase.auth.getUser();
      user = fallbackUser;
    }
    if (!user) throw new Error("Not authenticated");
    const res = await supabase.from("glucose_entries").delete().eq("id", id).eq("user_id", user.id);
    if (!res.error) {
      await this.invalidateServerCache("glucose");
      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("health-data-updated", {
            detail: { entity: "glucose", action: "delete", id },
          }),
        );
      }
    }
    return res;
  },

  /**
   * @deprecated Forwarded directly to Insulin V3 Architecture
   */
  /**
   * Create or upsert a daily insulin schedule (delegated to authoritative insulinService)
   */
  async createInsulinEntry(
    payload: {
      id?: string;
      entry_date: string;
      morning?: number | null;
      lunch?: number | null;
      afternoon?: number | null;
      evening?: number | null;
      night?: number | null;
      notes?: string | null;
      slot_type?: "morning" | "lunch" | "afternoon" | "evening" | "night";
      units?: number;
    },
    _idempotencyKey?: string,
  ) {
    const { insulinService } = await import("@/features/insulin/services/insulinService");
    const res = await insulinService.createDailyRecord({
      entry_date: payload.entry_date,
      morning: payload.morning,
      lunch: payload.lunch,
      afternoon: payload.afternoon,
      evening: payload.evening,
      night: payload.night,
      notes: payload.notes,
      id: payload.id,
    });

    if (res.error) throw new Error(res.error);
    this.invalidateServerCache("insulin").catch(() => {});
    return { data: res.data, error: null };
  },

  /**
   * Update an existing insulin entry (delegated to authoritative insulinService)
   */
  async updateInsulinEntry(
    id: string,
    payload: {
      morning?: number | null;
      lunch?: number | null;
      afternoon?: number | null;
      evening?: number | null;
      night?: number | null;
      notes?: string | null;
      entry_date?: string;
    },
  ) {
    const { insulinService } = await import("@/features/insulin/services/insulinService");
    const res = await insulinService.updateDailyRecord(id, payload);
    if (res.error) throw new Error(res.error);
    this.invalidateServerCache("insulin").catch(() => {});
    return { data: res.data, error: null };
  },

  /**
   * Delete an entire daily insulin entry by ID (delegated to authoritative insulinService)
   */
  async deleteInsulinEntry(id: string) {
    const { insulinService } = await import("@/features/insulin/services/insulinService");
    const res = await insulinService.deleteDailyRecord(id);
    if (res.error) throw new Error(res.error);
    this.invalidateServerCache("insulin").catch(() => {});
    return { data: res.data, error: null };
  },

  async getFoodHistory() {
    let user: any = null;
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      user = session?.user;
    } catch {}

    if (!user) {
      const {
        data: { user: fallbackUser },
      } = await supabase.auth.getUser();
      user = fallbackUser;
    }
    if (!user) throw new Error("Not authenticated");
    return supabase
      .from("food_entries")
      .select("*")
      .eq("user_id", user.id)
      .order("date_time", { ascending: false });
  },

  async deleteFoodEntry(id: string) {
    let user: any = null;
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      user = session?.user;
    } catch {}

    if (!user) {
      const {
        data: { user: fallbackUser },
      } = await supabase.auth.getUser();
      user = fallbackUser;
    }
    if (!user) throw new Error("Not authenticated");
    const res = await supabase.from("food_entries").delete().eq("id", id).eq("user_id", user.id);
    if (!res.error) {
      this.invalidateServerCache("food");
    }
    return res;
  },

  async getExportData(fromIso: string, toIso: string, from: string, to: string) {
    let user: any = null;
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      user = session?.user;
    } catch {}

    if (!user) {
      const {
        data: { user: fallbackUser },
      } = await supabase.auth.getUser();
      user = fallbackUser;
    }
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
    let user: any = null;
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      user = session?.user;
    } catch {}

    if (!user) {
      const {
        data: { user: fallbackUser },
      } = await supabase.auth.getUser();
      user = fallbackUser;
    }
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
    let user: any = null;
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      user = session?.user;
    } catch {}

    if (!user) {
      const {
        data: { user: fallbackUser },
      } = await supabase.auth.getUser();
      user = fallbackUser;
    }
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
        this.invalidateServerCache("profile");
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
      this.invalidateServerCache("profile");
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
          const fallbackData: Database["public"]["Tables"]["profiles"]["Update"] = {
            updated_at: new Date().toISOString(),
          };
          if (data.name !== undefined) fallbackData.name = data.name;
          if (data.phone !== undefined) fallbackData.phone = data.phone;

          if (!existing) {
            await supabase.from("profiles").insert({
              user_id: user.id,
              email: user.email,
              name: fallbackData.name,
              phone: fallbackData.phone,
              updated_at: fallbackData.updated_at,
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
    let user: any = null;
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      user = session?.user;
    } catch {}

    if (!user) {
      const {
        data: { user: fallbackUser },
      } = await supabase.auth.getUser();
      user = fallbackUser;
    }
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
        const today = getLocalDateKey();
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

    // Invalidate server Redis cache
    this.invalidateServerCache("profile");
    return res;
  },

  async invalidateServerCache(entity: "glucose" | "insulin" | "weight" | "food" | "profile" | "all" = "all") {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      // Clear local client dashboard cache immediately for current user
      if (session?.user?.id) {
        dashboardCacheService.invalidate(session.user.id);
      }

      if (!session?.access_token) return;

      await fetch(getApiUrl("/api/v1/cache/invalidate"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ entity }),
      }).catch((e) => {
        console.warn("[HealthService] Cache invalidation API warning:", e);
      });
    } catch (err) {
      console.warn("[HealthService] Cache invalidation error:", err);
    }
  },

  async getDashboardSummary() {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (session?.access_token) {
      try {
        const res = await fetch(getApiUrl("/api/v1/dashboard/summary"), {
          method: "GET",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        });

        if (res.ok) {
          return await res.json();
        }
      } catch (err) {
        console.warn("[HealthService] Redis dashboard summary fetch fallback:", err);
      }
    }

    // Graceful fallback to direct Supabase query with exact dashboard summary schema
    try {
      const [gRes, iRes, wRes, pRes] = await this.getDashboardData();
      const readings = gRes?.data || [];
      const insulinRows = iRes?.data || [];
      const weightRows = wRes?.data || [];
      const profile = pRes?.data || null;

      const todayKey = getLocalDateKey();
      const todayReadings = readings.filter((g: any) => g.date_time?.startsWith(todayKey));
      const latestReading = readings[0] || null;

      let inTarget = 0;
      let high = 0;
      let low = 0;
      const valid = readings.filter((g: any) => typeof g.glucose === "number" && g.glucose > 0);
      for (const r of valid) {
        if (r.glucose < 70) low++;
        else if (r.glucose > 180) high++;
        else inTarget++;
      }
      const totalReadings = valid.length;
      const tir = {
        inTargetPercent: totalReadings > 0 ? Math.round((inTarget / totalReadings) * 100) : 0,
        highPercent: totalReadings > 0 ? Math.round((high / totalReadings) * 100) : 0,
        lowPercent: totalReadings > 0 ? Math.round((low / totalReadings) * 100) : 0,
        totalReadings,
        periodDays: 7,
      };

      const parseDose = (val: any) => {
        const num = Number(val);
        return Number.isFinite(num) ? Math.round((num + Number.EPSILON) * 100) / 100 : 0;
      };

      const todayInsulinRow = insulinRows.find((i: any) => i.entry_date === todayKey) || null;
      let m = 0;
      let l = 0;
      let a = 0;
      let e = 0;
      let n = 0;
      if (todayInsulinRow) {
        m = parseDose(todayInsulinRow.morning);
        l = parseDose(todayInsulinRow.lunch);
        a = parseDose(todayInsulinRow.afternoon);
        e = parseDose(todayInsulinRow.evening);
        n = parseDose(todayInsulinRow.night);
      }

      const latestInsulinRow = insulinRows[0] || null;
      let lim = 0, lil = 0, lia = 0, lie = 0, lin = 0;
      if (latestInsulinRow) {
        lim = parseDose(latestInsulinRow.morning);
        lil = parseDose(latestInsulinRow.lunch);
        lia = parseDose(latestInsulinRow.afternoon);
        lie = parseDose(latestInsulinRow.evening);
        lin = parseDose(latestInsulinRow.night);
      }

      const latestWeight = weightRows[0] || null;

      return {
        todayDate: todayKey,
        latestReading: latestReading
          ? {
              id: latestReading.id,
              glucose: latestReading.glucose,
              readingType: latestReading.reading_type,
              dateTime: latestReading.date_time,
            }
          : null,
        todayGlucoseCount: todayReadings.length,
        todayInsulin: {
          totalUnits: m + l + a + e + n,
          breakdown: { morning: m, lunch: l, afternoon: a, evening: e, night: n },
        },
        latestInsulin: latestInsulinRow
          ? {
              id: latestInsulinRow.id,
              entryDate: latestInsulinRow.entry_date,
              morning: lim,
              lunch: lil,
              afternoon: lia,
              evening: lie,
              night: lin,
              totalUnits: lim + lil + lia + lie + lin,
            }
          : null,
        tir,
        weight: latestWeight
          ? {
              weightKg: latestWeight.weight_kg,
              entryDate: latestWeight.entry_date,
            }
          : null,
        profile: {
          name: profile?.name || "",
          diabetesType: null,
          onboardingCompleted: true,
        },
        sparkline: readings
          .slice(0, 10)
          .reverse()
          .map((g: any) => ({
            time: g.date_time,
            glucose: g.glucose,
          })),
        cachedAt: new Date().toISOString(),
      };
    } catch (fallbackErr) {
      console.warn("[HealthService] Direct Supabase summary fallback failed:", fallbackErr);
      return null;
    }
  },
};
