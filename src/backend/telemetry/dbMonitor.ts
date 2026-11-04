/**
 * GlucoLab Database Performance & Query Monitoring
 *
 * Wraps Supabase query executions to monitor:
 * - Query duration
 * - Slow queries (>100ms threshold)
 * - Query failure rate
 * - Trace span integration
 *
 * Guarantees zero patient clinical data or credentials logged.
 */

import { telemetryMetrics } from "./metrics";
import { RequestTracer, type TraceContext } from "./tracer";
import { scrubObject } from "./scrubber";

export async function withDbMonitoring<T>(
  queryName: string,
  queryFn: () => Promise<T>,
  traceContext?: TraceContext,
): Promise<T> {
  const start = Date.now();
  let success = true;

  try {
    if (traceContext) {
      return await RequestTracer.traceSpan(
        traceContext,
        queryName,
        "db",
        async () => queryFn(),
      );
    } else {
      return await queryFn();
    }
  } catch (err: any) {
    success = false;
    const duration = Date.now() - start;
    telemetryMetrics.recordDbQuery(queryName, duration, false);

    // Sanitize error before logging
    const sanitizedErr = scrubObject({
      query: queryName,
      durationMs: duration,
      error: err?.message || String(err),
      code: err?.code,
    });

    console.error("[DbMonitor] Database query failed:", sanitizedErr);
    throw err;
  } finally {
    if (success) {
      const duration = Date.now() - start;
      telemetryMetrics.recordDbQuery(queryName, duration, true);
    }
  }
}

