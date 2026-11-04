/**
 * GlucoLab Central Telemetry Metrics Store
 *
 * Lightweight, in-memory circular buffer metric registry.
 * Captures:
 * - API request counts (total, 2xx, 4xx, 5xx)
 * - Latency distributions (p50, p95, p99, avg, max)
 * - Endpoint-specific performance statistics
 * - Database query performance (slow queries >100ms, execution times, failures)
 * - Redis caching health & fallbacks
 * - System runtime resource metrics (heap, rss, uptime)
 */

export interface ApiMetricSample {
  method: string;
  route: string;
  statusCode: number;
  durationMs: number;
  timestamp: number;
  requestId: string;
}

export interface EndpointStats {
  route: string;
  method: string;
  totalRequests: number;
  successCount: number;
  clientErrorCount: number; // 4xx
  serverErrorCount: number; // 5xx
  averageLatencyMs: number;
  p50LatencyMs: number;
  p95LatencyMs: number;
  p99LatencyMs: number;
  maxLatencyMs: number;
}

export interface DatabaseMetricsSummary {
  totalQueries: number;
  slowQueries: number; // >100ms
  failedQueries: number;
  averageDurationMs: number;
  recentSlowQueries: Array<{
    queryName: string;
    durationMs: number;
    timestamp: string;
  }>;
}

export interface GlobalTelemetrySummary {
  api: {
    totalRequests: number;
    successRequests: number;
    clientErrors: number;
    serverErrors: number;
    errorRatePercent: number;
    averageLatencyMs: number;
    p50LatencyMs: number;
    p95LatencyMs: number;
    p99LatencyMs: number;
    endpoints: EndpointStats[];
    slowestEndpoints: EndpointStats[];
  };
  database: DatabaseMetricsSummary;
  system: {
    uptimeSeconds: number;
    environment: string;
    memoryMb: {
      heapUsed: number;
      heapTotal: number;
      rss: number;
    };
  };
}

class TelemetryMetricsStore {
  private readonly startTime = Date.now();
  private readonly MAX_SAMPLES_PER_ROUTE = 500;
  private readonly SLOW_QUERY_THRESHOLD_MS = 100;
  private readonly MAX_SLOW_QUERY_LOG = 20;

  // Global API Counters
  private totalApiRequests = 0;
  private successApiRequests = 0;
  private clientErrors4xx = 0;
  private serverErrors5xx = 0;

  // Per-route latency samples (routeKey -> number[])
  private routeLatencies = new Map<string, number[]>();
  private routeCounts = new Map<
    string,
    {
      method: string;
      route: string;
      total: number;
      success: number;
      clientError: number;
      serverError: number;
      totalDurationMs: number;
      maxDurationMs: number;
    }
  >();

  // Database Metrics
  private totalDbQueries = 0;
  private slowDbQueries = 0;
  private failedDbQueries = 0;
  private totalDbDurationMs = 0;
  private recentSlowQueries: Array<{
    queryName: string;
    durationMs: number;
    timestamp: string;
  }> = [];

  /**
   * Record a completed API request
   */
  recordApiRequest(sample: ApiMetricSample): void {
    this.totalApiRequests++;

    if (sample.statusCode >= 200 && sample.statusCode < 400) {
      this.successApiRequests++;
    } else if (sample.statusCode >= 400 && sample.statusCode < 500) {
      this.clientErrors4xx++;
    } else if (sample.statusCode >= 500) {
      this.serverErrors5xx++;
    }

    const routeKey = `${sample.method.toUpperCase()} ${sample.route}`;

    // Update route count aggregation
    let countData = this.routeCounts.get(routeKey);
    if (!countData) {
      countData = {
        method: sample.method.toUpperCase(),
        route: sample.route,
        total: 0,
        success: 0,
        clientError: 0,
        serverError: 0,
        totalDurationMs: 0,
        maxDurationMs: 0,
      };
      this.routeCounts.set(routeKey, countData);
    }

    countData.total++;
    countData.totalDurationMs += sample.durationMs;
    countData.maxDurationMs = Math.max(countData.maxDurationMs, sample.durationMs);

    if (sample.statusCode >= 200 && sample.statusCode < 400) {
      countData.success++;
    } else if (sample.statusCode >= 400 && sample.statusCode < 500) {
      countData.clientError++;
    } else {
      countData.serverError++;
    }

    // Update route latency samples
    let latencies = this.routeLatencies.get(routeKey);
    if (!latencies) {
      latencies = [];
      this.routeLatencies.set(routeKey, latencies);
    }

    latencies.push(sample.durationMs);
    if (latencies.length > this.MAX_SAMPLES_PER_ROUTE) {
      latencies.shift();
    }
  }

  /**
   * Record a database query execution
   */
  recordDbQuery(queryName: string, durationMs: number, success = true): void {
    this.totalDbQueries++;
    this.totalDbDurationMs += durationMs;

    if (!success) {
      this.failedDbQueries++;
    }

    if (durationMs >= this.SLOW_QUERY_THRESHOLD_MS) {
      this.slowDbQueries++;
      this.recentSlowQueries.unshift({
        queryName,
        durationMs: Math.round(durationMs),
        timestamp: new Date().toISOString(),
      });

      if (this.recentSlowQueries.length > this.MAX_SLOW_QUERY_LOG) {
        this.recentSlowQueries.pop();
      }
    }
  }

  /**
   * Calculate percentiles from array of numbers
   */
  private calculatePercentiles(samples: number[]): { p50: number; p95: number; p99: number; avg: number } {
    if (samples.length === 0) {
      return { p50: 0, p95: 0, p99: 0, avg: 0 };
    }

    const sorted = [...samples].sort((a, b) => a - b);
    const getPercentile = (pct: number) => {
      const idx = Math.min(sorted.length - 1, Math.floor((pct / 100) * sorted.length));
      return sorted[idx] ?? 0;
    };

    const sum = samples.reduce((acc, v) => acc + v, 0);
    const avg = Math.round(sum / samples.length);

    return {
      p50: getPercentile(50),
      p95: getPercentile(95),
      p99: getPercentile(99),
      avg,
    };
  }

  /**
   * Generate comprehensive metrics summary
   */
  getSummary(): GlobalTelemetrySummary {
    const allLatencies: number[] = [];
    const endpointStats: EndpointStats[] = [];

    for (const [key, countData] of this.routeCounts.entries()) {
      const latencies = this.routeLatencies.get(key) || [];
      allLatencies.push(...latencies);

      const { p50, p95, p99, avg } = this.calculatePercentiles(latencies);

      endpointStats.push({
        route: countData.route,
        method: countData.method,
        totalRequests: countData.total,
        successCount: countData.success,
        clientErrorCount: countData.clientError,
        serverErrorCount: countData.serverError,
        averageLatencyMs: avg,
        p50LatencyMs: p50,
        p95LatencyMs: p95,
        p99LatencyMs: p99,
        maxLatencyMs: countData.maxDurationMs,
      });
    }

    const globalPercentiles = this.calculatePercentiles(allLatencies);
    const totalFailures = this.clientErrors4xx + this.serverErrors5xx;
    const errorRatePercent =
      this.totalApiRequests > 0
        ? Math.round((totalFailures / this.totalApiRequests) * 1000) / 10
        : 0;

    // Slowest endpoints sorted by p95 latency
    const slowestEndpoints = [...endpointStats]
      .sort((a, b) => b.p95LatencyMs - a.p95LatencyMs)
      .slice(0, 5);

    // Memory info
    let memoryMb = { heapUsed: 0, heapTotal: 0, rss: 0 };
    if (typeof process !== "undefined" && typeof process.memoryUsage === "function") {
      try {
        const mem = process.memoryUsage();
        memoryMb = {
          heapUsed: Math.round(mem.heapUsed / 1024 / 1024),
          heapTotal: Math.round(mem.heapTotal / 1024 / 1024),
          rss: Math.round(mem.rss / 1024 / 1024),
        };
      } catch {}
    }

    const avgDbDuration =
      this.totalDbQueries > 0
        ? Math.round(this.totalDbDurationMs / this.totalDbQueries)
        : 0;

    return {
      api: {
        totalRequests: this.totalApiRequests,
        successRequests: this.successApiRequests,
        clientErrors: this.clientErrors4xx,
        serverErrors: this.serverErrors5xx,
        errorRatePercent,
        averageLatencyMs: globalPercentiles.avg,
        p50LatencyMs: globalPercentiles.p50,
        p95LatencyMs: globalPercentiles.p95,
        p99LatencyMs: globalPercentiles.p99,
        endpoints: endpointStats,
        slowestEndpoints,
      },
      database: {
        totalQueries: this.totalDbQueries,
        slowQueries: this.slowDbQueries,
        failedQueries: this.failedDbQueries,
        averageDurationMs: avgDbDuration,
        recentSlowQueries: this.recentSlowQueries,
      },
      system: {
        uptimeSeconds: Math.floor((Date.now() - this.startTime) / 1000),
        environment: process.env.NODE_ENV || "production",
        memoryMb,
      },
    };
  }

  /**
   * Reset all metric accumulators (useful for tests)
   */
  reset(): void {
    this.totalApiRequests = 0;
    this.successApiRequests = 0;
    this.clientErrors4xx = 0;
    this.serverErrors5xx = 0;
    this.routeLatencies.clear();
    this.routeCounts.clear();
    this.totalDbQueries = 0;
    this.slowDbQueries = 0;
    this.failedDbQueries = 0;
    this.totalDbDurationMs = 0;
    this.recentSlowQueries = [];
  }
}

export const telemetryMetrics = new TelemetryMetricsStore();

