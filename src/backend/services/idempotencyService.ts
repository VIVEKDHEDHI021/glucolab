/**
 * GlucoLab Idempotency Service
 *
 * Provides end-to-end idempotency for write mutations (Create Glucose, Create/Update Insulin):
 * 1. Generates and persists stable client-side idempotency keys for logical operations.
 * 2. Deduplicates concurrent requests (in-flight locks) to prevent double-click duplicates.
 * 3. Caches successful mutation responses so network retries receive identical responses without creating duplicate DB records.
 * 4. Resilient fallback across in-memory and local session cache.
 */

export interface IdempotencyRecord<T = any> {
  key: string;
  status: "in_flight" | "completed" | "failed";
  createdAt: number;
  result?: T;
  error?: string;
}

class IdempotencyService {
  private inFlightMap = new Map<string, Promise<any>>();
  private memoryCache = new Map<string, IdempotencyRecord>();
  private readonly CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
  private readonly IN_FLIGHT_TIMEOUT_MS = 30 * 1000; // 30 seconds

  /**
   * Generate a stable idempotency key for a logical create operation
   */
  generateKey(userId: string, entity: "glucose" | "insulin" | "weight" | "food", stableId?: string): string {
    const nonce = stableId || (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `nonce_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`);
    return `idem_${entity}_${userId.slice(0, 8)}_${nonce}`;
  }

  /**
   * Check if a completed result already exists for this idempotency key
   */
  getCompleted<T = any>(key: string): T | null {
    if (!key) return null;

    // 1. Check in-memory store
    const memEntry = this.memoryCache.get(key);
    if (memEntry && memEntry.status === "completed" && Date.now() - memEntry.createdAt < this.CACHE_TTL_MS) {
      return memEntry.result as T;
    }

    // 2. Check browser sessionStorage if available
    if (typeof window !== "undefined" && window.sessionStorage) {
      try {
        const raw = sessionStorage.getItem(`glucolab_idem_${key}`);
        if (raw) {
          const parsed = JSON.parse(raw) as IdempotencyRecord<T>;
          if (parsed && parsed.status === "completed" && Date.now() - parsed.createdAt < this.CACHE_TTL_MS) {
            this.memoryCache.set(key, parsed);
            return parsed.result as T;
          }
        }
      } catch { }
    }

    return null;
  }

  /**
   * Execute an operation with strict idempotency and concurrency protection
   */
  async executeIdempotent<T>(
    key: string,
    operation: () => Promise<T>,
  ): Promise<{ data: T; isCached: boolean }> {
    if (!key) {
      const data = await operation();
      return { data, isCached: false };
    }

    // 1. If operation already completed previously (e.g. client retry after network drop), return cached result!
    const existing = this.getCompleted<T>(key);
    if (existing !== null && existing !== undefined) {
      console.log(`[IDEMPOTENCY] Replaying cached response for idempotency key: ${key}`);
      return { data: existing, isCached: true };
    }

    // 2. Concurrency protection: If identical request is currently in-flight (e.g. double-click), join its promise!
    if (this.inFlightMap.has(key)) {
      console.log(`[IDEMPOTENCY] Joining in-flight operation for idempotency key: ${key}`);
      const inFlightPromise = this.inFlightMap.get(key)!;
      const data = await inFlightPromise;
      return { data, isCached: true };
    }

    // 3. Register in-flight promise with timeout safeguard
    let timeoutHandle: any = null;
    const promise = (async () => {
      try {
        timeoutHandle = setTimeout(() => {
          if (this.inFlightMap.get(key) === promise) {
            console.warn(`[IDEMPOTENCY] In-flight operation timed out for key: ${key}`);
            this.inFlightMap.delete(key);
          }
        }, this.IN_FLIGHT_TIMEOUT_MS);

        const result = await operation();

        // Save to completed cache
        const record: IdempotencyRecord<T> = {
          key,
          status: "completed",
          createdAt: Date.now(),
          result,
        };

        this.memoryCache.set(key, record);

        if (typeof window !== "undefined" && window.sessionStorage) {
          try {
            sessionStorage.setItem(`glucolab_idem_${key}`, JSON.stringify(record));
          } catch { }
        }

        return result;
      } catch (err: any) {
        // Remove on error so genuine retries can run again
        this.memoryCache.delete(key);
        if (typeof window !== "undefined" && window.sessionStorage) {
          try {
            sessionStorage.removeItem(`glucolab_idem_${key}`);
          } catch { }
        }
        throw err;
      } finally {
        if (timeoutHandle) clearTimeout(timeoutHandle);
        this.inFlightMap.delete(key);
      }
    })();

    this.inFlightMap.set(key, promise);
    const data = await promise;
    return { data, isCached: false };
  }

  /**
   * Clear idempotency entry on deletion or explicit eviction
   */
  evict(key: string): void {
    this.memoryCache.delete(key);
    this.inFlightMap.delete(key);
    if (typeof window !== "undefined" && window.sessionStorage) {
      try {
        sessionStorage.removeItem(`glucolab_idem_${key}`);
      } catch { }
    }
  }
}

export const idempotencyService = new IdempotencyService();

