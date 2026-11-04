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

  const refreshData = async (force = false) => {
    if (!user || !authService.isEmailVerified(user)) return;

    const currentUserId = user.id;
    const syncSeq = ++activeSyncSeqRef.current;
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

    // Fast Path 1: Load from local SQLite database immediately for instant UI display
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

        if (activeSyncSeqRef.current === syncSeq && user?.id === currentUserId) {
          if (localG && localG.length > 0) setGlucose(localG as GlucoseEntry[]);
          if (localI && localI.length > 0) setInsulin(localI as InsulinEntry[]);
          if (localW && localW.length > 0) setWeight(localW as WeightEntry[]);
          if (localF && localF.length > 0) setFood(localF as FoodEntry[]);
          if (localP?.name) setProfileName(localP.name);
          setInitialized(true);
        }
      } catch (err) {
        console.warn("[HEALTH_DATA_CONTEXT] Local DB pre-load failed:", err);
      }
    }

    // If already loaded and not forced, keep current cache on mobile
    if (isMobile && initialized && !force) {
      return;
    }

    if (initialized) {
      setSyncing(true);
    } else {
      setLoading(true);
    }

    // Path 2: Fetch fresh data from Supabase in parallel (stale-while-revalidate)
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

      // Guard against race conditions if another sync started or user switched
      if (activeSyncSeqRef.current !== syncSeq || user?.id !== currentUserId) {
        return;
      }

      if (g.data) setGlucose(g.data as GlucoseEntry[]);
      if (i.data) setInsulin(i.data as InsulinEntry[]);
      if (w.data) setWeight(w.data as WeightEntry[]);
      if (f.data) setFood(f.data as FoodEntry[]);
      if (p.data?.name) setProfileName(p.data.name);

      setInitialized(true);

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
      if (activeSyncSeqRef.current === syncSeq) {
        setLoading(false);
        setSyncing(false);
      }
    }
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

      // Clear user-specific SQLite cache on logout
      if (prevUserId && Capacitor.isNativePlatform()) {
        getLocalDbService()
          .then((db) => db.clearUserCache(prevUserId))
          .catch(() => {});
      }
      return;
    }
    refreshData(false);

    const handleUpdate = () => {
      console.log("[HEALTH_DATA_CONTEXT] Realtime health data update event received, refreshing...");
      refreshData(true);
    };

    window.addEventListener("health-data-updated", handleUpdate);
    return () => {
      window.removeEventListener("health-data-updated", handleUpdate);
    };
  }, [user]);

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
