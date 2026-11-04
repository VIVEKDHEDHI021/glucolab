/**
 * GlucoLab Mobile Dashboard Local SWR Cache Service
 *
 * Implements Stale-While-Revalidate client-side caching:
 * - Immediate 0ms rendering of cached dashboard summary on app launch
 * - Background revalidation against /api/v1/dashboard/summary
 * - Strict isolation per authenticated user ID
 * - Clear distinction between fresh and cached data (with last-updated timestamps)
 * - Automatic eviction on logout
 */

export interface CachedDashboardData {
  todayDate: string;
  latestReading: {
    id: string;
    glucose: number;
    readingType: string;
    dateTime: string;
  } | null;
  todayGlucoseCount: number;
  todayInsulin: {
    totalUnits: number;
    breakdown: {
      morning: number;
      lunch: number;
      afternoon: number;
      evening: number;
      night: number;
    };
  };
  tir: {
    inTargetPercent: number;
    highPercent: number;
    lowPercent: number;
    totalReadings: number;
    periodDays: number;
  };
  weight: {
    weightKg: number;
    entryDate: string;
  } | null;
  profile: {
    name: string;
    diabetesType: string | null;
    onboardingCompleted: boolean;
  };
  sparkline: Array<{
    time: string;
    glucose: number;
  }>;
  cachedAt: string; // ISO string
}

export interface DashboardCacheResult {
  data: CachedDashboardData | null;
  isCached: boolean;
  isStale: boolean;
  ageSeconds: number;
  lastUpdatedText: string;
}

const CACHE_PREFIX = "glucolab_dashboard_summary_v1_";
const STALE_THRESHOLD_SECONDS = 120; // 2 minutes

export const dashboardCacheService = {
  /**
   * Retrieve cached dashboard summary for a specific user ID
   */
  get(userId: string): DashboardCacheResult {
    if (!userId || typeof window === "undefined") {
      return {
        data: null,
        isCached: false,
        isStale: true,
        ageSeconds: 0,
        lastUpdatedText: "",
      };
    }

    try {
      const raw = localStorage.getItem(`${CACHE_PREFIX}${userId}`);
      if (!raw) {
        return {
          data: null,
          isCached: false,
          isStale: true,
          ageSeconds: 0,
          lastUpdatedText: "",
        };
      }

      const parsed: CachedDashboardData = JSON.parse(raw);
      const cachedTime = new Date(parsed.cachedAt).getTime();
      const ageSeconds = Math.max(0, Math.floor((Date.now() - cachedTime) / 1000));
      const isStale = ageSeconds > STALE_THRESHOLD_SECONDS;

      let lastUpdatedText = "Just now";
      if (ageSeconds >= 3600) {
        lastUpdatedText = `${Math.floor(ageSeconds / 3600)}h ago`;
      } else if (ageSeconds >= 60) {
        lastUpdatedText = `${Math.floor(ageSeconds / 60)}m ago`;
      } else if (ageSeconds > 10) {
        lastUpdatedText = `${ageSeconds}s ago`;
      }

      return {
        data: parsed,
        isCached: true,
        isStale,
        ageSeconds,
        lastUpdatedText,
      };
    } catch (e) {
      console.warn("[DashboardCache] Failed to parse local dashboard cache:", e);
      return {
        data: null,
        isCached: false,
        isStale: true,
        ageSeconds: 0,
        lastUpdatedText: "",
      };
    }
  },

  /**
   * Persist fresh dashboard summary for a specific user ID
   */
  set(userId: string, data: Partial<CachedDashboardData>): void {
    if (!userId || !data || typeof window === "undefined") return;

    try {
      const record: CachedDashboardData = {
        todayDate: data.todayDate || new Date().toISOString().split("T")[0],
        latestReading: data.latestReading || null,
        todayGlucoseCount: data.todayGlucoseCount || 0,
        todayInsulin: data.todayInsulin || {
          totalUnits: 0,
          breakdown: { morning: 0, lunch: 0, afternoon: 0, evening: 0, night: 0 },
        },
        tir: data.tir || { inTargetPercent: 0, highPercent: 0, lowPercent: 0, totalReadings: 0, periodDays: 7 },
        weight: data.weight || null,
        profile: data.profile || { name: "", diabetesType: null, onboardingCompleted: true },
        sparkline: data.sparkline || [],
        cachedAt: new Date().toISOString(),
      };

      localStorage.setItem(`${CACHE_PREFIX}${userId}`, JSON.stringify(record));
    } catch (e) {
      console.warn("[DashboardCache] Failed to persist local dashboard cache:", e);
    }
  },

  /**
   * Invalidate local dashboard cache for a user (e.g. after adding a glucose or insulin record)
   */
  invalidate(userId: string): void {
    if (!userId || typeof window === "undefined") return;
    try {
      localStorage.removeItem(`${CACHE_PREFIX}${userId}`);
    } catch {}
  },

  /**
   * Clear all user-specific local caches on logout
   */
  clearAllUserCaches(userId: string): void {
    if (!userId || typeof window === "undefined") return;
    try {
      localStorage.removeItem(`${CACHE_PREFIX}${userId}`);
      localStorage.removeItem(`glucolab_profile_cache_${userId}`);
      localStorage.removeItem(`glucolab_health_cache_${userId}`);
    } catch {}
  },
};
