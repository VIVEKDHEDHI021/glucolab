/**
 * GlucoLab API Route Instrumentation Middleware
 *
 * Wraps TanStack Start API handlers with:
 * - Correlation & Request ID generation / propagation
 * - Distributed trace spans & Server-Timing headers
 * - Performance metric collection (p50, p95, p99, request count)
 * - Automatic error scrubbing and tracking
 * - Safe error responses (zero internal leakage)
 */

import { RequestTracer, type TraceContext } from "./tracer";
import { telemetryMetrics } from "./metrics";
import { errorTracker } from "./errorTracker";
import { scrubObject } from "./scrubber";

export interface InstrumentedHandlerContext {
  request: Request;
  traceContext: TraceContext;
  requestId: string;
  traceId: string;
}

export type InstrumentedRouteHandler = (
  ctx: InstrumentedHandlerContext,
) => Promise<Response>;

/**
 * Higher-order function to instrument a TanStack Start server handler
 */
export function instrumentApiHandler(
  routeName: string,
  method: string,
  handler: InstrumentedRouteHandler,
) {
  return async ({ request }: { request: Request }): Promise<Response> => {
    const traceContext = RequestTracer.startTrace(request, routeName);
    const { requestId, traceId } = traceContext;
    const start = Date.now();

    let response: Response;
    let statusCode = 200;

    try {
      // Execute the wrapped handler
      response = await handler({
        request,
        traceContext,
        requestId,
        traceId,
      });

      statusCode = response.status;
    } catch (unhandledErr: any) {
      statusCode = 500;

      // Sanitize and report error
      const sanitized = scrubObject({
        message: unhandledErr?.message || "Internal Server Error",
        name: unhandledErr?.name,
        stack: unhandledErr?.stack,
      });

      console.error(`[API Instrumentation] Unhandled error in [${method} ${routeName}] [ReqID: ${requestId}]:`, sanitized);

      await errorTracker.captureError({
        error: unhandledErr,
        category: "unhandled",
        endpoint: routeName,
        method,
        statusCode: 500,
        requestId,
        traceId,
      });

      response = Response.json(
        {
          error: "An unexpected server error occurred",
          requestId,
        },
        {
          status: 500,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        },
      );
    } finally {
      const durationMs = Math.max(1, Date.now() - start);

      // Record API performance metrics
      telemetryMetrics.recordApiRequest({
        method,
        route: routeName,
        statusCode,
        durationMs,
        timestamp: Date.now(),
        requestId,
      });
    }

    // Clone response to attach observability headers
    const newHeaders = new Headers(response.headers);
    newHeaders.set("X-Request-ID", requestId);
    newHeaders.set("X-Trace-ID", traceId);
    newHeaders.set("X-Response-Time-Ms", `${Math.max(1, Date.now() - start)}`);

    const serverTiming = RequestTracer.formatServerTimingHeader(traceContext);
    if (serverTiming) {
      newHeaders.set("Server-Timing", serverTiming);
    }

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: newHeaders,
    });
  };
}
