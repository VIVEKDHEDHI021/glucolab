/**
 * GlucoLab Write Operation Queue Service (v1.6)
 *
 * Implements a reliable, durable mutation queue for Insulin, Glucose, and Health data:
 * 1. Operation identity with stable idempotency keys.
 * 2. Per-record execution ordering (independent records process concurrently).
 * 3. Bounded exponential backoff with jitter for transient errors.
 * 4. Immediate eviction / non-retry for validation and authorization errors.
 * 5. Isolated queue persistence per authenticated user (survives app reloads/restarts).
 * 6. Dispatches status events for optimistic UI reconciliation.
 */

import { idempotencyService } from "./idempotencyService";

export type QueueOperationType = "create" | "update" | "delete";
export type QueueEntity = "glucose" | "insulin" | "insulin_slot" | "weight" | "food";
export type QueueStatus = "pending" | "processing" | "succeeded" | "failed" | "retry_scheduled";

export interface WriteQueueItem<T = any> {
  id: string; // Operation ID
  idempotencyKey: string;
  userId: string;
  entity: QueueEntity;
  operationType: QueueOperationType;
  recordId?: string; // Logical entity ID (e.g. glucose ID or slot ID)
  payload: T;
  createdAt: number;
  status: QueueStatus;
  retryCount: number;
  maxRetries: number;
  lastError?: string;
  nextRetryAt?: number;
}

export type QueueSubscriber = (item: WriteQueueItem, action: "enqueued" | "processing" | "succeeded" | "failed" | "retry") => void;

class WriteQueueService {
  private queue: Map<string, WriteQueueItem> = new Map();
  private activeLocks: Set<string> = new Set(); // Per-record lock to preserve ordering
  private isProcessing = false;
  private subscribers: Set<QueueSubscriber> = new Set();
  private readonly MAX_RETRIES = 5;
  private readonly BASE_DELAY_MS = 1000;
  private readonly MAX_DELAY_MS = 30000;

  constructor() {
    this.restorePersistedQueue();
  }

  /**
   * Get storage key scoped to user
   */
  private getStorageKey(userId: string): string {
    return `glucolab_write_queue_v1_${userId}`;
  }

  /**
   * Restore any uncommitted operations from local storage on app start
   */
  private restorePersistedQueue(): void {
    if (typeof window === "undefined" || !window.localStorage) return;
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith("glucolab_write_queue_v1_")) {
          const raw = localStorage.getItem(k);
          if (raw) {
            const items = JSON.parse(raw) as WriteQueueItem[];
            for (const item of items) {
              if (item.status === "processing" || item.status === "retry_scheduled") {
                item.status = "pending"; // Reset in-flight from previous session to pending
              }
              if (item.status === "pending") {
                this.queue.set(item.id, item);
              }
            }
          }
        }
      }
    } catch (e) {
      console.warn("[WRITE_QUEUE] Warning restoring persisted queue:", e);
    }
  }

  /**
   * Save user's pending queue items to localStorage
   */
  private persistUserQueue(userId: string): void {
    if (typeof window === "undefined" || !window.localStorage || !userId) return;
    try {
      const userItems = Array.from(this.queue.values()).filter(
        (item) => item.userId === userId && (item.status === "pending" || item.status === "retry_scheduled" || item.status === "processing"),
      );
      if (userItems.length > 0) {
        localStorage.setItem(this.getStorageKey(userId), JSON.stringify(userItems));
      } else {
        localStorage.removeItem(this.getStorageKey(userId));
      }
    } catch (e) {
      console.warn("[WRITE_QUEUE] Warning saving queue to storage:", e);
    }
  }

  /**
   * Subscribe to queue lifecycle events
   */
  subscribe(callback: QueueSubscriber): () => void {
    this.subscribers.add(callback);
    return () => this.subscribers.delete(callback);
  }

  private notify(item: WriteQueueItem, action: "enqueued" | "processing" | "succeeded" | "failed" | "retry"): void {
    this.subscribers.forEach((cb) => {
      try {
        cb(item, action);
      } catch (err) {
        console.error("[WRITE_QUEUE] Subscriber error:", err);
      }
    });

    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("write-queue-updated", {
          detail: { item, action },
        }),
      );
    }
  }

  /**
   * Enqueue a new mutation operation
   */
  async enqueue<T>(
    userId: string,
    entity: QueueEntity,
    operationType: QueueOperationType,
    payload: T,
    options?: {
      recordId?: string;
      idempotencyKey?: string;
      executeImmediately?: boolean;
    },
  ): Promise<WriteQueueItem<T>> {
    if (!userId) throw new Error("Authenticated user context required to enqueue operation");

    const operationId = `op_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const idempotencyKey =
      options?.idempotencyKey ||
      idempotencyService.generateKey(userId, entity === "insulin_slot" ? "insulin" : entity, options?.recordId || operationId);

    const item: WriteQueueItem<T> = {
      id: operationId,
      idempotencyKey,
      userId,
      entity,
      operationType,
      recordId: options?.recordId,
      payload,
      createdAt: Date.now(),
      status: "pending",
      retryCount: 0,
      maxRetries: this.MAX_RETRIES,
    };

    this.queue.set(operationId, item);
    this.persistUserQueue(userId);
    this.notify(item, "enqueued");

    if (options?.executeImmediately !== false) {
      // Trigger execution tick asynchronously
      setTimeout(() => this.processQueue(), 0);
    }

    return item;
  }

  /**
   * Check if an error is non-retryable (e.g. validation, authorization)
   */
  private isPermanentFailure(err: any): boolean {
    const msg = (err?.message || "").toLowerCase();
    const code = err?.code || "";

    // Auth & Permission errors
    if (code === "42501" || msg.includes("not authenticated") || msg.includes("unauthorized") || msg.includes("forbidden") || msg.includes("permission denied")) {
      return true;
    }
    // Validation errors
    if (msg.includes("cannot update") || msg.includes("missing required") || msg.includes("out of range") || msg.includes("invalid input") || msg.includes("not found")) {
      return true;
    }
    return false;
  }

  /**
   * Compute backoff with jitter
   */
  private calculateBackoff(retryCount: number): number {
    const base = Math.min(this.MAX_DELAY_MS, this.BASE_DELAY_MS * Math.pow(2, retryCount));
    const jitter = Math.floor(Math.random() * (base * 0.2));
    return base + jitter;
  }

  /**
   * Process all eligible operations in the queue
   */
  async processQueue(executor?: (item: WriteQueueItem) => Promise<any>): Promise<void> {
    if (this.isProcessing) return;
    this.isProcessing = true;

    try {
      const now = Date.now();
      const pendingItems = Array.from(this.queue.values()).filter(
        (item) => item.status === "pending" || (item.status === "retry_scheduled" && (!item.nextRetryAt || item.nextRetryAt <= now)),
      );

      for (const item of pendingItems) {
        // Enforce ordering: If another operation on the same record is currently processing, wait
        const lockKey = item.recordId ? `${item.userId}_${item.entity}_${item.recordId}` : null;
        if (lockKey && this.activeLocks.has(lockKey)) {
          continue; // Skip until dependent operation completes
        }

        if (lockKey) this.activeLocks.add(lockKey);
        item.status = "processing";
        this.notify(item, "processing");

        try {
          if (executor) {
            await executor(item);
          }
          item.status = "succeeded";
          this.notify(item, "succeeded");
          this.queue.delete(item.id);
        } catch (err: any) {
          item.lastError = err?.message || "Operation failed";

          if (this.isPermanentFailure(err) || item.retryCount >= item.maxRetries) {
            item.status = "failed";
            this.notify(item, "failed");
            console.error(`[WRITE_QUEUE] Permanent failure for op ${item.id}:`, item.lastError);
          } else {
            item.retryCount++;
            item.status = "retry_scheduled";
            const delay = this.calculateBackoff(item.retryCount);
            item.nextRetryAt = Date.now() + delay;
            this.notify(item, "retry");
            console.warn(`[WRITE_QUEUE] Scheduled retry #${item.retryCount} for op ${item.id} in ${delay}ms`);
          }
        } finally {
          if (lockKey) this.activeLocks.delete(lockKey);
          this.persistUserQueue(item.userId);
        }
      }
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Get pending count for a user
   */
  getPendingCount(userId: string): number {
    return Array.from(this.queue.values()).filter(
      (item) => item.userId === userId && (item.status === "pending" || item.status === "retry_scheduled" || item.status === "processing"),
    ).length;
  }

  /**
   * Clear queue for a user (e.g. on logout)
   */
  clearUserQueue(userId: string): void {
    for (const [id, item] of this.queue.entries()) {
      if (item.userId === userId) {
        this.queue.delete(id);
      }
    }
    if (typeof window !== "undefined" && window.localStorage) {
      localStorage.removeItem(this.getStorageKey(userId));
    }
  }

  /**
   * Inspect all items currently in memory
   */
  getAllItems(userId?: string): WriteQueueItem[] {
    const all = Array.from(this.queue.values());
    if (userId) return all.filter((i) => i.userId === userId);
    return all;
  }
}

export const writeQueueService = new WriteQueueService();
