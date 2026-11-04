/**
 * GlucoLab Error Tracking & Telemetry Service
 *
 * Provides:
 * - Deterministic error grouping & deduplication via fingerprinting
 * - Automatic scrubbing of sensitive clinical data & credentials
 * - Sentry DSN integration via lightweight edge HTTP protocol (zero external binaries)
 * - In-memory error buffer for the administrative monitoring dashboard
 */

import { scrubObject, scrubString } from "./scrubber";

export interface ErrorEvent {
  id: string;
  fingerprint: string;
  message: string;
  category: "api" | "db" | "cache" | "auth" | "unhandled";
  endpoint?: string;
  method?: string;
  statusCode?: number;
  requestId?: string;
  traceId?: string;
  environment: string;
  timestamp: string;
  count: number;
  stack?: string;
  metadata?: Record<string, any>;
}

class ErrorTrackerService {
  private sentryDsn: string | null = null;
  private sentryProjectId: string | null = null;
  private sentryHost: string | null = null;
  private sentryKey: string | null = null;

  // In-memory circular buffer for recent errors (max 50 unique fingerprints)
  private readonly recentErrors = new Map<string, ErrorEvent>();
  private readonly MAX_RECORDED_ERRORS = 50;

  constructor() {
    const dsn =
      process.env.SENTRY_DSN ||
      process.env.VITE_SENTRY_DSN ||
      null;

    if (dsn) {
      try {
        const url = new URL(dsn);
        this.sentryKey = url.username;
        this.sentryHost = url.host;
        const pathParts = url.pathname.split("/").filter(Boolean);
        this.sentryProjectId = pathParts[pathParts.length - 1] || null;
        if (this.sentryKey && this.sentryProjectId) {
          this.sentryDsn = dsn;
        }
      } catch (e) {
        console.warn("[ErrorTracker] Invalid SENTRY_DSN format:", e);
      }
    }
  }

  /**
   * Generate deterministic error fingerprint for intelligent grouping
   */
  private generateFingerprint(
    category: string,
    message: string,
    endpoint?: string,
  ): string {
    const cleanMsg = message
      .replace(/\b[0-9a-fA-F-]{36}\b/g, "[UUID]")
      .replace(/\b[0-9a-f]{8,}\b/gi, "[ID]")
      .replace(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}(:\d+)?\b/g, "[HOST]")
      .slice(0, 100);
    const cleanRoute = endpoint || "global";
    return `${category}:${cleanRoute}:${cleanMsg}`;
  }

  /**
   * Capture and record an error event with strict scrubbing
   */
  async captureError(params: {
    error: any;
    category?: ErrorEvent["category"];
    endpoint?: string;
    method?: string;
    statusCode?: number;
    requestId?: string;
    traceId?: string;
    metadata?: Record<string, any>;
  }): Promise<ErrorEvent> {
    const category = params.category || "unhandled";
    const rawMessage =
      params.error?.message ||
      (typeof params.error === "string" ? params.error : "Unknown Application Error");

    const message = scrubString(rawMessage);
    const rawStack = params.error?.stack;
    const stack = rawStack ? scrubString(rawStack) : undefined;
    const sanitizedMeta = params.metadata ? scrubObject(params.metadata) : undefined;

    const fingerprint = this.generateFingerprint(category, message, params.endpoint);
    const nowIso = new Date().toISOString();

    let existing = this.recentErrors.get(fingerprint);
    if (existing) {
      existing.count++;
      existing.timestamp = nowIso;
      existing.requestId = params.requestId || existing.requestId;
      existing.traceId = params.traceId || existing.traceId;
    } else {
      existing = {
        id: `err_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        fingerprint,
        message,
        category,
        endpoint: params.endpoint,
        method: params.method,
        statusCode: params.statusCode,
        requestId: params.requestId,
        traceId: params.traceId,
        environment: process.env.NODE_ENV || "production",
        timestamp: nowIso,
        count: 1,
        stack,
        metadata: sanitizedMeta,
      };

      if (this.recentErrors.size >= this.MAX_RECORDED_ERRORS) {
        // Evict oldest entry
        const firstKey = this.recentErrors.keys().next().value;
        if (firstKey) this.recentErrors.delete(firstKey);
      }

      this.recentErrors.set(fingerprint, existing);
    }

    // Forward to Sentry if configured
    if (this.sentryDsn && this.sentryKey && this.sentryProjectId) {
      this.sendToSentry(existing).catch(() => {});
    }

    return existing;
  }

  /**
   * Transmit sanitized error payload to Sentry Store API via native fetch
   */
  private async sendToSentry(event: ErrorEvent): Promise<void> {
    if (!this.sentryHost || !this.sentryProjectId || !this.sentryKey) return;

    try {
      const endpoint = `https://${this.sentryHost}/api/${this.sentryProjectId}/store/`;
      const payload = {
        event_id: event.id.replace("err_", "").padEnd(32, "0").slice(0, 32),
        timestamp: Math.floor(new Date(event.timestamp).getTime() / 1000),
        platform: "javascript",
        environment: event.environment,
        fingerprint: [event.fingerprint],
        message: event.message,
        tags: {
          category: event.category,
          endpoint: event.endpoint || "none",
          method: event.method || "none",
          statusCode: event.statusCode ? String(event.statusCode) : "none",
        },
        extra: {
          requestId: event.requestId,
          traceId: event.traceId,
          occurrenceCount: event.count,
          metadata: event.metadata,
        },
      };

      await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Sentry-Auth": `Sentry sentry_version=7, sentry_client=glucolab-observability/1.6, sentry_key=${this.sentryKey}`,
        },
        body: JSON.stringify(payload),
      });
    } catch (e) {
      // Never crash on telemetry transmission failure
      console.warn("[ErrorTracker] Failed to transmit event to Sentry:", e);
    }
  }

  /**
   * Get all grouped recent errors
   */
  getRecentErrors(): ErrorEvent[] {
    return Array.from(this.recentErrors.values()).sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    );
  }

  /**
   * Clear error history (test helper)
   */
  clear(): void {
    this.recentErrors.clear();
  }
}

export const errorTracker = new ErrorTrackerService();
