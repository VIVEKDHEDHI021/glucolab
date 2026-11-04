/**
 * GlucoLab Central Cache Manager
 *
 * Implements:
 * - Cache-Aside Pattern with strict user ID scoping
 * - Request Coalescing (SingleFlight) to prevent Cache Stampedes / Thundering Herd
 * - Multi-entity Invalidation on mutations (Glucose, Insulin, Weight, Food, Profile)
 * - Versioning generation counters
 * - Outbox pattern for resilient background invalidation retries
 */

import { redisService } from "./redisService.server";

// Standard TTL Policies (in seconds)
export const CACHE_TTL = {
  DASHBOARD_SUMMARY: 60, // 1 minute
  GLUCOSE_ANALYTICS: 120, // 2 minutes
  INSULIN_DAILY: 120, // 2 minutes
  MEDICATION_SETTINGS: 900, // 15 minutes
  PROFILE: 900, // 15 minutes
  STATIC_CONFIG: 3600, // 1 hour
} as const;

export class CacheManager {
  // In-flight request map for SingleFlight request coalescing
  private static inFlightRequests = new Map<string, Promise<any>>();

  // Durable retry outbox for failed invalidations
  private static retryOutbox: Array<{ pattern: string; attempts: number }> = [];
  private static isRetrying = false;

  /**
   * Deterministic user-scoped cache keys
   */
  static keys = {
    dashboardSummary: (userId: string) => `user:${userId}:dashboard:summary`,
    glucoseToday: (userId: string) => `user:${userId}:glucose:today`,
    glucoseHistory: (userId: string, days: number) => `user:${userId}:glucose:history:${days}`,
    insulinToday: (userId: string) => `user:${userId}:insulin:today`,
    profile: (userId: string) => `user:${userId}:profile`,
    medicationSettings: (userId: string) => `user:${userId}:medication:settings`,
    userPattern: (userId: string) => `user:${userId}:*`,
    glucosePattern: (userId: string) => `user:${userId}:glucose:*`,
    insulinPattern: (userId: string) => `user:${userId}:insulin:*`,
    weightPattern: (userId: string) => `user:${userId}:weight:*`,
    foodPattern: (userId: string) => `user:${userId}:food:*`,
    userVersion: (userId: string) => `user:${userId}:version`,
  };

  /**
   * Cache-Aside get-or-set with Request Coalescing (SingleFlight)
   * Prevents cache stampedes and eliminates redundant simultaneous DB queries.
   */
  static async getOrSet<T>(
    key: string,
    ttlSeconds: number,
    fetchFn: () => Promise<T>,
  ): Promise<T> {
    // 1. Check Cache HIT
    try {
      const cached = await redisService.get<T>(key);
      if (cached !== null && cached !== undefined) {
        return cached;
      }
    } catch (cacheErr) {
      console.warn(`[CacheManager] Cache read error for ${key}:`, cacheErr);
    }

    // 2. Request Coalescing: If another request for the same key is already in flight, await it
    if (this.inFlightRequests.has(key)) {
      try {
        return (await this.inFlightRequests.get(key)) as T;
      } catch {
        // If the in-flight request fails, proceed to fetch independently
      }
    }

    // 3. Cache MISS: Execute fetchFn and cache the result
    const fetchPromise = (async () => {
      try {
        const freshData = await fetchFn();
        if (freshData !== null && freshData !== undefined) {
          // Asynchronously cache without blocking the return
          redisService.set(key, freshData, ttlSeconds).catch((setErr) => {
            console.warn(`[CacheManager] Async cache set failed for ${key}:`, setErr);
          });
        }
        return freshData;
      } finally {
        this.inFlightRequests.delete(key);
      }
    })();

    this.inFlightRequests.set(key, fetchPromise);
    return fetchPromise;
  }

  /**
   * Invalidate affected cache entries for Glucose mutations
   */
  static async invalidateGlucose(userId: string): Promise<void> {
    const keysToDelete = [
      this.keys.dashboardSummary(userId),
      this.keys.glucoseToday(userId),
    ];
    await this.safeInvalidate(userId, keysToDelete, this.keys.glucosePattern(userId));
  }

  /**
   * Invalidate affected cache entries for Insulin mutations
   */
  static async invalidateInsulin(userId: string): Promise<void> {
    const keysToDelete = [
      this.keys.dashboardSummary(userId),
      this.keys.insulinToday(userId),
    ];
    await this.safeInvalidate(userId, keysToDelete, this.keys.insulinPattern(userId));
  }

  /**
   * Invalidate affected cache entries for Weight mutations
   */
  static async invalidateWeight(userId: string): Promise<void> {
    const keysToDelete = [this.keys.dashboardSummary(userId)];
    await this.safeInvalidate(userId, keysToDelete, this.keys.weightPattern(userId));
  }

  /**
   * Invalidate affected cache entries for Food mutations
   */
  static async invalidateFood(userId: string): Promise<void> {
    const keysToDelete = [this.keys.dashboardSummary(userId)];
    await this.safeInvalidate(userId, keysToDelete, this.keys.foodPattern(userId));
  }

  /**
   * Invalidate affected cache entries for Profile or Settings mutations
   */
  static async invalidateProfile(userId: string): Promise<void> {
    const keysToDelete = [
      this.keys.dashboardSummary(userId),
      this.keys.profile(userId),
      this.keys.medicationSettings(userId),
    ];
    await this.safeInvalidate(userId, keysToDelete);
  }

  /**
   * Robust invalidator with fallback outbox queue
   */
  private static async safeInvalidate(
    userId: string,
    specificKeys: string[],
    pattern?: string,
  ): Promise<void> {
    try {
      // 1. Delete explicit keys
      if (specificKeys.length > 0) {
        await redisService.del(specificKeys);
      }

      // 2. Delete pattern if specified
      if (pattern) {
        await redisService.delPattern(pattern);
      }

      // 3. Increment generation version counter for the user
      const versionKey = this.keys.userVersion(userId);
      const currentVersion = (await redisService.get<number>(versionKey)) || 0;
      await redisService.set(versionKey, currentVersion + 1, CACHE_TTL.STATIC_CONFIG);
    } catch (err: any) {
      console.warn(`[CacheManager] Invalidation error for user ${userId}:`, err);
      // Queue to durable retry outbox
      if (pattern) {
        this.retryOutbox.push({ pattern, attempts: 0 });
        this.triggerOutboxRetry();
      }
    }
  }

  /**
   * Background retry processor for failed invalidations
   */
  private static triggerOutboxRetry(): void {
    if (this.isRetrying || this.retryOutbox.length === 0) return;
    this.isRetrying = true;

    setTimeout(async () => {
      try {
        while (this.retryOutbox.length > 0) {
          const item = this.retryOutbox.shift();
          if (!item) break;

          try {
            await redisService.delPattern(item.pattern);
          } catch {
            if (item.attempts < 3) {
              item.attempts++;
              this.retryOutbox.push(item);
            }
          }
        }
      } finally {
        this.isRetrying = false;
      }
    }, 1000);
  }
}

