/**
 * GlucoLab Distributed Request Tracing & Span Instrumentation
 *
 * Lightweight, zero-dependency OpenTelemetry-compatible tracing.
 * Captures request flows: Client -> API Route -> Redis -> Database -> Response
 *
 * Produces W3C standard Server-Timing and X-Trace-ID headers without performance overhead.
 */

export interface Span {
  name: string;
  category: "http" | "db" | "cache" | "auth" | "internal";
  startTime: number;
  endTime?: number;
  durationMs?: number;
  metadata?: Record<string, any>;
  status: "ok" | "error";
  errorMessage?: string;
}

export interface TraceContext {
  traceId: string;
  requestId: string;
  parentSpanId?: string;
  startTime: number;
  spans: Span[];
}

// Generate simple 16-char random hex string (edge & worker safe)
function generateId(length = 16): string {
  const chars = "abcdef0123456789";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}

export class RequestTracer {
  /**
   * Initialize a new trace context from an incoming HTTP Request
   */
  static startTrace(request: Request, defaultRouteName = "unknown"): TraceContext {
    const headerReqId =
      request.headers.get("x-request-id") ||
      request.headers.get("x-correlation-id") ||
      request.headers.get("cf-ray");

    const headerTraceId = request.headers.get("x-trace-id");

    const requestId = headerReqId ? headerReqId.slice(0, 64) : `req_${generateId(12)}`;
    const traceId = headerTraceId ? headerTraceId.slice(0, 64) : `trc_${generateId(16)}`;

    return {
      traceId,
      requestId,
      startTime: Date.now(),
      spans: [],
    };
  }

  /**
   * Execute an asynchronous action within a timed trace span
   */
  static async traceSpan<T>(
    context: TraceContext | undefined,
    name: string,
    category: Span["category"],
    action: () => Promise<T>,
    metadata?: Record<string, any>,
  ): Promise<T> {
    const start = Date.now();
    const span: Span = {
      name,
      category,
      startTime: start,
      metadata,
      status: "ok",
    };

    try {
      const result = await action();
      span.endTime = Date.now();
      span.durationMs = Math.max(0, span.endTime - start);
      if (context) context.spans.push(span);
      return result;
    } catch (err: any) {
      span.endTime = Date.now();
      span.durationMs = Math.max(0, span.endTime - start);
      span.status = "error";
      span.errorMessage = err?.message || String(err);
      if (context) context.spans.push(span);
      throw err;
    }
  }

  /**
   * Format spans into standard W3C Server-Timing header
   * Example: "db;dur=12.4;desc=\"Supabase\", redis;dur=0.8;desc=\"Redis\""
   */
  static formatServerTimingHeader(context: TraceContext): string {
    const timings: string[] = [];

    // Aggregate durations by category
    const categoryTotals = new Map<string, number>();

    for (const span of context.spans) {
      const dur = span.durationMs ?? (Date.now() - span.startTime);
      const cat = span.category;
      categoryTotals.set(cat, (categoryTotals.get(cat) || 0) + dur);
    }

    for (const [category, dur] of categoryTotals.entries()) {
      timings.push(`${category};dur=${dur.toFixed(1)}`);
    }

    const totalDur = Date.now() - context.startTime;
    timings.push(`total;dur=${totalDur.toFixed(1)}`);

    return timings.join(", ");
  }
}
