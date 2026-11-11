import { createContext, useContext, useEffect, useState, useRef, type ReactNode } from "react";
import { useAuth } from "@/frontend/lib/auth-context";
import { authService } from "@/backend/services/authService";
import { supabase, getLocalDbService } from "@/db/client";
import type { GlucoseEntry, InsulinEntry, WeightEntry, FoodEntry } from "@/frontend/lib/types";
import { Capacitor } from "@capacitor/core";
import { Activity } from "lucide-react";
import { getLocalDateKey } from "@/frontend/lib/date-utils";

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
  rollbackOptimisticInsulin: (originalEntry: InsulinEntry | null, entryDate: string) => void;
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
  const recentLocalMutationsRef = useRef<Map<string, number>>(new Map());

  const refreshData = async (force = false) => {
    if (!user?.id) return;

    // Deduplicate in-flight sync if not forced
    if (inFlightRefreshRef.current && !force) {
      return inFlightRefreshRef.current;
    }

    const currentUserId = user.id;
    const isMobile = Capacitor.isNativePlatform();
    const currentSeq = ++activeSyncSeqRef.current;

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

        if (user?.id !== currentUserId || activeSyncSeqRef.current !== currentSeq) {
          console.log("[HEALTH_DATA_CONTEXT] Stale in-flight refresh response discarded");
          return;
        }

        const freshG = (g.data || []) as GlucoseEntry[];
        const freshI = (i.data || []) as InsulinEntry[];
        const freshW = (w.data || []) as WeightEntry[];
        const freshF = (f.data || []) as FoodEntry[];
        const freshName = p.data?.name || "";

        if (g.data) setGlucose(freshG);
        let mergedInsulinList: InsulinEntry[] = freshI;
        if (i.data) {
          setInsulin((prev) => {
            const resultMap = new Map<string, InsulinEntry>();
            for (const item of freshI) {
              const d = item.entry_date?.split("T")[0];
              if (d) resultMap.set(d, item);
            }

            // Protect local collecting entries, pending sync, recent mutations & higher revisions
            for (const localItem of prev) {
              const d = localItem.entry_date?.split("T")[0];
              if (!d) continue;

              const isPendingSync =
                localItem.sync_status === "pending_sync" ||
                localItem.sync_status === "local_collecting";
              const isRecentMutation = recentLocalMutationsRef.current.has(d);
              const remote = resultMap.get(d);

              if (isPendingSync || isRecentMutation) {
                if (!remote) {
                  resultMap.set(d, localItem);
                } else {
                  resultMap.set(d, {
                    ...remote,
                    ...localItem,
                    revision: Math.max(localItem.revision || 1, (remote.revision || 0) + 1),
                  });
                }
              } else if (remote) {
                if ((localItem.revision || 0) > (remote.revision || 0)) {
                  resultMap.set(d, {
                    ...remote,
                    ...localItem,
                  });
                }
              } else {
                resultMap.set(d, localItem);
              }
            }

            mergedInsulinList = Array.from(resultMap.values()).sort((a, b) =>
              (b.entry_date || "").localeCompare(a.entry_date || "")
            );
            return mergedInsulinList;
          });
        }
        if (w.data) setWeight(freshW);
        if (f.data) setFood(freshF);
        if (p.data?.name) setProfileName(freshName);

        setInitialized(true);

        // Update local web cache with the MERGED insulin, preserving local pending changes
        if (g.data || i.data) {
          setLocalHealthCache(currentUserId, {
            glucose: freshG,
            insulin: mergedInsulinList,
            weight: freshW,
            food: freshF,
            profileName: freshName,
            cachedAt: new Date().toISOString(),
          });
        }

        // Path 3: Update local SQLite cache asynchronously with merged list
        if (isMobile) {
          try {
            const localDb = await getLocalDbService();
            await Promise.all([
              g.data && g.data.length > 0 ? localDb.cacheGlucose(g.data) : Promise.resolve(),
              mergedInsulinList.length > 0 ? localDb.cacheInsulin(mergedInsulinList) : Promise.resolve(),
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

    const handleUpdate = (e?: any) => {
      const detail = e?.detail;
      // Skip redundant full database refetch for locally initiated insulin updates
      if (detail?.entity === "insulin") {
        const idTimestamp = detail.id ? recentLocalMutationsRef.current.get(detail.id) : undefined;
        const dateTimestamp = detail.date ? recentLocalMutationsRef.current.get(detail.date) : undefined;
        const isRecentLocal =
          (idTimestamp !== undefined && Date.now() - idTimestamp < 15000) ||
          (dateTimestamp !== undefined && Date.now() - dateTimestamp < 15000);

        if (isRecentLocal) {
          console.log("[HEALTH_DATA_CONTEXT] Skipping self-echo refresh for recent local insulin update");
          return;
        }
      }
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
        (payload: any) => {
          const newRow = payload.new as InsulinEntry | undefined;
          const rowId = newRow?.id || payload.old?.id;
          const rowDate = newRow?.entry_date?.split("T")[0];

          // Discard self-echo for local updates
          const isRecentLocal =
            (rowId && recentLocalMutationsRef.current.has(rowId)) ||
            (rowDate && recentLocalMutationsRef.current.has(rowDate));

          if (isRecentLocal) {
            console.log("[REALTIME] Discarding self-echo for recent local insulin mutation:", rowId);
            return;
          }

          // Targeted merge for remote multi-device updates without full refetch
          if (newRow && payload.eventType === "UPDATE") {
            console.log("[REALTIME] Targeted merge for remote insulin update:", newRow.id);
            setInsulin((prev) => {
              const idx = prev.findIndex((i) => i.id === newRow.id || i.entry_date?.split("T")[0] === rowDate);
              if (idx >= 0) {
                const next = [...prev];
                next[idx] = { ...next[idx], ...newRow };
                return next;
              }
              return [newRow, ...prev].sort((a, b) => (b.entry_date || "").localeCompare(a.entry_date || ""));
            });
            return;
          }

          if (newRow && payload.eventType === "INSERT") {
            console.log("[REALTIME] Targeted prepend for remote insulin insert:", newRow.id);
            setInsulin((prev) =>
              [newRow, ...prev.filter((i) => i.id !== newRow.id)].sort((a, b) =>
                (b.entry_date || "").localeCompare(a.entry_date || ""),
              ),
            );
            return;
          }

          console.log("[REALTIME] Remote insulin change detected, refreshing...");
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
    const entryDateOnly = entry.entry_date?.split("T")[0];
    if (entryDateOnly) {
      recentLocalMutationsRef.current.set(entryDateOnly, Date.now());
    }
    if (entry.id) {
      recentLocalMutationsRef.current.set(entry.id, Date.now());
    }

    setInsulin((prev) => {
      const idx = prev.findIndex((i) => i.id === entry.id || i.entry_date?.split("T")[0] === entryDateOnly);
      let updated: InsulinEntry[];
      if (idx >= 0) {
        const prevItem = prev[idx];
        const nextRevision = Math.max(prevItem.revision || 1, entry.revision || 1) + (entry.revision ? 0 : 1);
        updated = [...prev];
        updated[idx] = {
          ...prevItem,
          ...entry,
          revision: nextRevision,
          sync_status: entry.sync_status || "pending_sync",
          updated_at: new Date().toISOString(),
        };
      } else {
        updated = [
          {
            ...entry,
            revision: entry.revision || 1,
            sync_status: entry.sync_status || "pending_sync",
            updated_at: new Date().toISOString(),
          },
          ...prev,
        ];
      }
      return updated.sort((a, b) => (b.entry_date || "").localeCompare(a.entry_date || ""));
    });

    // Keep web cache immediately synchronized without waiting for network refresh
    if (user?.id) {
      try {
        const cached = getLocalHealthCache(user.id);
        if (cached) {
          const prevCached = cached.insulin || [];
          const idx = prevCached.findIndex((i) => i.id === entry.id || i.entry_date?.split("T")[0] === entryDateOnly);
          let nextCached: InsulinEntry[];
          if (idx >= 0) {
            nextCached = [...prevCached];
            nextCached[idx] = { ...nextCached[idx], ...entry };
          } else {
            nextCached = [entry, ...prevCached];
          }
          cached.insulin = nextCached;
          setLocalHealthCache(user.id, cached);
        }
      } catch {}
    }
  };

  const rollbackOptimisticInsulin = (originalEntry: InsulinEntry | null, entryDate: string) => {
    const dateOnly = entryDate?.split("T")[0];
    setInsulin((prev) => {
      let next: InsulinEntry[];
      if (originalEntry) {
        next = prev.map((item) =>
          item.id === originalEntry.id || item.entry_date?.split("T")[0] === dateOnly
            ? originalEntry
            : item,
        );
      } else {
        next = prev.filter((item) => item.entry_date?.split("T")[0] !== dateOnly);
      }

      if (user?.id) {
        try {
          const cached = getLocalHealthCache(user.id);
          if (cached) {
            cached.insulin = next;
            setLocalHealthCache(user.id, cached);
          }
        } catch {}
      }

      return next;
    });

    if (isMobile && user?.id) {
      getLocalDbService()
        .then((localDb) => {
          if (originalEntry) {
            localDb.cacheInsulin([originalEntry]);
          } else {
            localDb.deleteInsulin(dateOnly);
          }
        })
        .catch(() => {});
    }
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
        rollbackOptimisticInsulin,
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
