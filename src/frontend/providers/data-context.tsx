import { createContext, useContext, useEffect, useState, useRef, type ReactNode } from "react";
import { useAuth } from "@/frontend/lib/auth-context";
import { authService } from "@/backend/services/authService";
import { supabase, getLocalDbService } from "@/db/client";
import type { GlucoseEntry, InsulinEntry, WeightEntry, FoodEntry } from "@/frontend/lib/types";
import { Capacitor } from "@capacitor/core";
import { Activity } from "lucide-react";

interface HealthDataContextValue {
  glucose: GlucoseEntry[];
  insulin: InsulinEntry[];
  weight: WeightEntry[];
  food: FoodEntry[];
  profileName: string;
  loading: boolean;
  syncing: boolean;
  initialized: boolean;
  refreshData: (force?: boolean) => Promise<void>;
  setGlucose: React.Dispatch<React.SetStateAction<GlucoseEntry[]>>;
  setInsulin: React.Dispatch<React.SetStateAction<InsulinEntry[]>>;
  setWeight: React.Dispatch<React.SetStateAction<WeightEntry[]>>;
  setFood: React.Dispatch<React.SetStateAction<FoodEntry[]>>;
  setProfileName: React.Dispatch<React.SetStateAction<string>>;
  optimisticAddGlucose: (entry: GlucoseEntry) => void;
  optimisticUpdateGlucose: (entry: GlucoseEntry) => void;
  optimisticDeleteGlucose: (id: string) => void;
  optimisticAddOrUpdateInsulin: (entry: InsulinEntry) => void;
  optimisticDeleteInsulin: (id: string) => void;
}

interface LocalHealthCache {
  glucose: GlucoseEntry[];
  insulin: InsulinEntry[];
  weight: WeightEntry[];
  food: FoodEntry[];
  profileName: string;
  cachedAt: string;
}

function getLocalHealthCache(uid: string): LocalHealthCache | null {
  if (typeof window === "undefined" || !uid) return null;
  try {
    const raw = localStorage.getItem(`glucolab_health_cache_${uid}`);
    if (raw) return JSON.parse(raw);
  } catch {}
  return null;
}

function setLocalHealthCache(uid: string, data: LocalHealthCache): void {
  if (typeof window === "undefined" || !uid) return;
  try {
    localStorage.setItem(`glucolab_health_cache_${uid}`, JSON.stringify(data));
  } catch {}
}

const HealthDataContext = createContext<HealthDataContextValue | undefined>(undefined);

export function HealthDataProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [glucose, setGlucose] = useState<GlucoseEntry[]>([]);
  const [insulin, setInsulin] = useState<InsulinEntry[]>([]);
  const [weight, setWeight] = useState<WeightEntry[]>([]);
  const [food, setFood] = useState<FoodEntry[]>([]);
  const [profileName, setProfileName] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [initialized, setInitialized] = useState(false);

  const lastSyncUserIdRef = useRef<string | null>(null);
  const activeSyncSeqRef = useRef<number>(0);
  const inFlightRefreshRef = useRef<Promise<void> | null>(null);

  const refreshData = async (force = false) => {
    if (!user?.id) return;

    // Deduplicate in-flight sync if not forced
    if (inFlightRefreshRef.current && !force) {
      return inFlightRefreshRef.current;
    }

    const currentUserId = user.id;
    const isMobile = Capacitor.isNativePlatform();

    // Reset user state if switched to ensure strict user data isolation
    if (lastSyncUserIdRef.current && lastSyncUserIdRef.current !== currentUserId) {
      setGlucose([]);
      setInsulin([]);
      setWeight([]);
      setFood([]);
      setProfileName("");
      setInitialized(false);
    }
    lastSyncUserIdRef.current = currentUserId;

    // Fast Path 1: Load from local SQLite (native) or LocalStorage (web/SPA) immediately on initial load
    let hadLocalData = false;
    if (!initialized) {
      if (isMobile) {
        try {
          const localDb = await getLocalDbService();
          const [localG, localI, localW, localF, localP] = await Promise.all([
            localDb.getGlucose(currentUserId),
            localDb.getInsulin(currentUserId),
            localDb.getWeight(currentUserId),
            localDb.getFood(currentUserId),
            localDb.getProfile(currentUserId),
          ]);

          if (user?.id === currentUserId) {
            if (localG && localG.length > 0) {
              setGlucose(localG as GlucoseEntry[]);
              hadLocalData = true;
            }
            if (localI && localI.length > 0) {
              setInsulin(localI as InsulinEntry[]);
              hadLocalData = true;
            }
            if (localW && localW.length > 0) {
              setWeight(localW as WeightEntry[]);
              hadLocalData = true;
            }
            if (localF && localF.length > 0) setFood(localF as FoodEntry[]);
            if (localP?.name) setProfileName(localP.name);
            if (hadLocalData) {
              setInitialized(true);
            }
          }
        } catch (err) {
          console.warn("[HEALTH_DATA_CONTEXT] Local DB pre-load failed:", err);
        }
      } else {
        const cached = getLocalHealthCache(currentUserId);
        if (cached && user?.id === currentUserId) {
          if (cached.glucose?.length) {
            setGlucose(cached.glucose);
            hadLocalData = true;
          }
          if (cached.insulin?.length) {
            setInsulin(cached.insulin);
            hadLocalData = true;
          }
          if (cached.weight?.length) {
            setWeight(cached.weight);
            hadLocalData = true;
          }
          if (cached.food?.length) setFood(cached.food);
          if (cached.profileName) setProfileName(cached.profileName);
          if (hadLocalData) {
            setInitialized(true);
          }
        }
      }
    }

    if (hadLocalData || initialized) {
      setSyncing(true);
    } else {
      setLoading(true);
    }

    const doFetch = async () => {
      try {
        const [g, i, w, f, p] = await Promise.all([
          supabase
            .from("glucose_entries")
            .select("*")
            .eq("user_id", currentUserId)
            .order("date_time", { ascending: false })
            .limit(300),
          supabase
            .from("insulin_entries")
            .select("*")
            .eq("user_id", currentUserId)
            .order("entry_date", { ascending: false })
            .limit(100),
          supabase
            .from("weight_entries")
            .select("*")
            .eq("user_id", currentUserId)
            .order("entry_date", { ascending: false })
            .limit(50),
          supabase
            .from("food_entries")
            .select("*")
            .eq("user_id", currentUserId)
            .order("date_time", { ascending: false })
            .limit(150),
          supabase.from("profiles").select("name").eq("user_id", currentUserId).maybeSingle(),
        ]);

        if (user?.id !== currentUserId) {
          return;
        }

        const freshG = (g.data || []) as GlucoseEntry[];
        const freshI = (i.data || []) as InsulinEntry[];
        const freshW = (w.data || []) as WeightEntry[];
        const freshF = (f.data || []) as FoodEntry[];
        const freshName = p.data?.name || "";

        if (g.data) setGlucose(freshG);
        if (i.data) setInsulin(freshI);
        if (w.data) setWeight(freshW);
        if (f.data) setFood(freshF);
        if (p.data?.name) setProfileName(freshName);

        setInitialized(true);

        // Update local web cache
        if (g.data || i.data) {
          setLocalHealthCache(currentUserId, {
            glucose: freshG,
            insulin: freshI,
            weight: freshW,
            food: freshF,
            profileName: freshName,
            cachedAt: new Date().toISOString(),
          });
        }

        // Path 3: Update local SQLite cache asynchronously (non-blocking)
        if (isMobile) {
          try {
            const localDb = await getLocalDbService();
            await Promise.all([
              g.data && g.data.length > 0 ? localDb.cacheGlucose(g.data) : Promise.resolve(),
              i.data && i.data.length > 0 ? localDb.cacheInsulin(i.data) : Promise.resolve(),
              w.data && w.data.length > 0 ? localDb.cacheWeight(w.data) : Promise.resolve(),
              f.data && f.data.length > 0 ? localDb.cacheFood(f.data) : Promise.resolve(),
              p.data ? localDb.cacheProfile(currentUserId, p.data.name) : Promise.resolve(),
            ]);
          } catch (cacheErr) {
            console.warn("[HEALTH_DATA_CONTEXT] Background SQLite cache save failed:", cacheErr);
          }
        }
      } catch (err) {
        console.error("[HEALTH_DATA_CONTEXT] Error fetching data:", err);
      } finally {
        setLoading(false);
        setSyncing(false);
        setInitialized(true);
        inFlightRefreshRef.current = null;
      }
    };

    inFlightRefreshRef.current = doFetch();
    return inFlightRefreshRef.current;
  };

  useEffect(() => {
    if (!user) {
      const prevUserId = lastSyncUserIdRef.current;
      setGlucose([]);
      setInsulin([]);
      setWeight([]);
      setFood([]);
      setProfileName("");
      setInitialized(false);
      setLoading(false);
      setSyncing(false);
      lastSyncUserIdRef.current = null;

      // Clear user-specific SQLite & Web cache on logout
      if (prevUserId) {
        try {
          localStorage.removeItem(`glucolab_health_cache_${prevUserId}`);
        } catch {}
        if (Capacitor.isNativePlatform()) {
          getLocalDbService()
            .then((db) => db.clearUserCache(prevUserId))
            .catch(() => {});
        }
      }
      return;
    }
    refreshData(false);

    const handleUpdate = () => {
      console.log("[HEALTH_DATA_CONTEXT] Realtime health data update event received, refreshing...");
      refreshData(true);
    };

    // Multi-device realtime subscription via Supabase Realtime channel
    const channel = supabase
      .channel(`user_health_realtime_${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "glucose_entries", filter: `user_id=eq.${user.id}` },
        () => {
          console.log("[REALTIME] Remote glucose change detected");
          refreshData(true);
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "insulin_entries", filter: `user_id=eq.${user.id}` },
        () => {
          console.log("[REALTIME] Remote insulin change detected");
          refreshData(true);
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "insulin_slots", filter: `user_id=eq.${user.id}` },
        () => {
          console.log("[REALTIME] Remote insulin slot change detected");
          refreshData(true);
        },
      )
      .subscribe();

    window.addEventListener("health-data-updated", handleUpdate);
    return () => {
      window.removeEventListener("health-data-updated", handleUpdate);
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  // Sync Android Native Home Screen Widgets whenever health entries update or on load
  useEffect(() => {
    if (!user || !initialized) return;

    // 1. Refresh Native Widgets with latest data
    import("@/services/widgetService").then(({ widgetService }) => {
      widgetService.updateWidgets(glucose, insulin);

      // 2. Process any pending Quick Insulin logs recorded from home screen widget
      widgetService.checkAndSyncPendingQuickInsulin(async (units, entryDate) => {
        try {
          const isMobile = Capacitor.isNativePlatform();
          if (isMobile) {
            const localDb = await getLocalDbService();
            await localDb.cacheInsulin([{
              id: "quick_" + Date.now() + "_" + Math.random().toString(36).substring(2, 7),
              user_id: user.id,
              morning: units,
              lunch: 0,
              afternoon: 0,
              evening: 0,
              night: 0,
              entry_date: entryDate,
              sync_status: "pending_sync",
            }]);
          }

          const { error } = await supabase.from("insulin_entries").insert({
            user_id: user.id,
            morning: units,
            entry_date: entryDate,
          });

          if (!error) {
            console.log(`[HEALTH_DATA_CONTEXT] Successfully synced widget quick insulin entry: ${units} U`);
            window.dispatchEvent(new Event("health-data-updated"));
          }
        } catch (err) {
          console.error("[HEALTH_DATA_CONTEXT] Error syncing quick insulin entry:", err);
        }
      });
    });
  }, [glucose, insulin, user, initialized]);

  const isMobile = Capacitor.isNativePlatform();

  // Optimistic mutation helpers for instant UI responsiveness
  const optimisticAddGlucose = (entry: GlucoseEntry) => {
    setGlucose((prev) => [entry, ...prev.filter((g) => g.id !== entry.id)]);
  };

  const optimisticUpdateGlucose = (entry: GlucoseEntry) => {
    setGlucose((prev) => prev.map((g) => (g.id === entry.id ? { ...g, ...entry } : g)));
  };

  const optimisticDeleteGlucose = (id: string) => {
    setGlucose((prev) => prev.filter((g) => g.id !== id));
  };

  const optimisticAddOrUpdateInsulin = (entry: InsulinEntry) => {
    setInsulin((prev) => {
      const entryDateOnly = entry.entry_date?.split("T")[0];
      const idx = prev.findIndex((i) => i.id === entry.id || i.entry_date?.split("T")[0] === entryDateOnly);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = { ...copy[idx], ...entry };
        return copy;
      }
      return [entry, ...prev];
    });
  };

  const optimisticDeleteInsulin = (id: string) => {
    setInsulin((prev) => prev.filter((i) => i.id !== id));
  };

  // Only block full screen on first load if we have NEITHER local cache nor network data yet
  if (isMobile && !initialized && loading && glucose.length === 0 && insulin.length === 0) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-950 text-white">
        <Activity className="h-12 w-12 text-primary animate-pulse" />
      </div>
    );
  }

  return (
    <HealthDataContext.Provider
      value={{
        glucose,
        insulin,
        weight,
        food,
        profileName,
        loading,
        syncing,
        initialized,
        refreshData,
        setGlucose,
        setInsulin,
        setWeight,
        setFood,
        setProfileName,
        optimisticAddGlucose,
        optimisticUpdateGlucose,
        optimisticDeleteGlucose,
        optimisticAddOrUpdateInsulin,
        optimisticDeleteInsulin,
      }}
    >
      {children}
    </HealthDataContext.Provider>
  );
}

export function useHealthData() {
  const ctx = useContext(HealthDataContext);
  if (!ctx) throw new Error("useHealthData must be used within HealthDataProvider");
  return ctx;
}
