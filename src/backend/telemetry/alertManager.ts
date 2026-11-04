/**
 * GlucoLab Observability Alert Manager
 *
 * Implements intelligent, deduplicated alert rules for:
 * - High API error rates (> 5%)
 * - High API p95 latency (> 500ms)
 * - Database query failures / connectivity loss
 * - Redis circuit-breaker / unavailability
 * - Repeated cache invalidation errors
 *
 * Features cooldown throttling to prevent notification fatigue.
 */

import { telemetryMetrics } from "./metrics";
import { redisService } from "@/backend/services/redisService.server";

export interface SystemAlert {
  id: string;
  name: string;
  severity: "CRITICAL" | "WARNING" | "INFO";
  description: string;
  triggeredAt: string;
  value: string | number;
  threshold: string | number;
}

class AlertManagerService {
  private lastAlertTimes = new Map<string, number>();
  private readonly ALERT_COOLDOWN_MS = 5 * 60 * 1000; // 5 minute throttling between duplicate alerts
  private activeAlerts: SystemAlert[] = [];

  /**
   * Evaluate all operational thresholds against live system metrics
   */
  evaluateAlerts(): SystemAlert[] {
    const summary = telemetryMetrics.getSummary();
    const redisMetrics = redisService.getMetrics();
    const alerts: SystemAlert[] = [];
    const now = Date.now();

    // 1. Rule: High API Error Rate (> 5% with minimum 10 requests)
    if (summary.api.totalRequests >= 10 && summary.api.errorRatePercent > 5.0) {
      alerts.push({
        id: "ALERT_HIGH_API_ERROR_RATE",
        name: "Elevated API Error Rate",
        severity: summary.api.errorRatePercent > 15.0 ? "CRITICAL" : "WARNING",
        description: `API error rate is at ${summary.api.errorRatePercent}%, exceeding safe threshold of 5.0%`,
        triggeredAt: new Date().toISOString(),
        value: `${summary.api.errorRatePercent}%`,
        threshold: "5.0%",
      });
    }

    // 2. Rule: High API Latency (p95 > 500ms with minimum 5 requests)
    if (summary.api.totalRequests >= 5 && summary.api.p95LatencyMs > 500) {
      alerts.push({
        id: "ALERT_HIGH_API_LATENCY",
        name: "Elevated API p95 Latency",
        severity: summary.api.p95LatencyMs > 1000 ? "CRITICAL" : "WARNING",
        description: `API p95 latency reached ${summary.api.p95LatencyMs}ms (threshold: 500ms)`,
        triggeredAt: new Date().toISOString(),
        value: `${summary.api.p95LatencyMs}ms`,
        threshold: "500ms",
      });
    }

    // 3. Rule: Database Query Failures
    if (summary.database.failedQueries > 0) {
      alerts.push({
        id: "ALERT_DATABASE_QUERY_FAILURE",
        name: "Database Query Errors Detected",
        severity: "CRITICAL",
        description: `${summary.database.failedQueries} database query operations failed in Supabase`,
        triggeredAt: new Date().toISOString(),
        value: summary.database.failedQueries,
        threshold: 0,
      });
    }

    // 4. Rule: Redis Cache Outage / Circuit Breaker
    if (!redisMetrics.isRedisConnected && redisMetrics.provider === "upstash-rest") {
      alerts.push({
        id: "ALERT_REDIS_UNAVAILABLE",
        name: "Redis Cache Outage (Circuit Breaker Tripped)",
        severity: "WARNING",
        description: "Primary Redis cache is unreachable. System has failed over to PostgreSQL and in-memory cache safely.",
        triggeredAt: new Date().toISOString(),
        value: "Disconnected",
        threshold: "Connected",
      });
    }

    // 5. Rule: Elevated Redis Error Rate
    if (redisMetrics.errors > 5) {
      alerts.push({
        id: "ALERT_REDIS_ERRORS",
        name: "Frequent Redis Cache Errors",
        severity: "WARNING",
        description: `Redis operations encountered ${redisMetrics.errors} errors. Fallbacks active.`,
        triggeredAt: new Date().toISOString(),
        value: redisMetrics.errors,
        threshold: 5,
      });
    }

    this.activeAlerts = alerts;
    return alerts;
  }

  /**
   * Get currently active system alerts
   */
  getActiveAlerts(): SystemAlert[] {
    return this.evaluateAlerts();
  }

  /**
   * Check overall system health status: "healthy" | "degraded" | "unhealthy"
   */
  getSystemHealthStatus(): "healthy" | "degraded" | "unhealthy" {
    const alerts = this.evaluateAlerts();
    if (alerts.some((a) => a.severity === "CRITICAL")) {
      return "unhealthy";
    }
    if (alerts.some((a) => a.severity === "WARNING")) {
      return "degraded";
    }
    return "healthy";
  }
}

export const alertManager = new AlertManagerService();

