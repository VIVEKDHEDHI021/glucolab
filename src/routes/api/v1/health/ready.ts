import { createFileRoute } from "@tanstack/react-router";
import { redisService } from "@/backend/services/redisService.server";
import { supabaseAdmin, hasServiceRoleKey } from "@/db/client.server";
import { supabase } from "@/db/client";
import { instrumentApiHandler } from "@/backend/telemetry/instrumentation";
import { withDbMonitoring } from "@/backend/telemetry/dbMonitor";
import { RequestTracer } from "@/backend/telemetry/tracer";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Request-ID",
};

export const Route = createFileRoute("/api/v1/health/ready")({
  server: {
    handlers: {
      OPTIONS: async () => {
        return new Response(null, {
          status: 204,
          headers: corsHeaders,
        });
      },

      GET: instrumentApiHandler("/api/v1/health/ready", "GET", async ({ traceContext }) => {
        const checkResults: {
          database: "healthy" | "unhealthy";
          redis: "healthy" | "fallback" | "unhealthy";
        } = {
          database: "healthy",
          redis: "healthy",
        };

        const latencies: {
          databaseMs: number;
          redisMs: number;
        } = {
          databaseMs: 0,
          redisMs: 0,
        };

        // 1. Check Redis Dependency
        const redisStart = Date.now();
        try {
          await RequestTracer.traceSpan(traceContext, "redis.health_check", "cache", async () => {
            await redisService.get("health:probe");
          });
          latencies.redisMs = Math.max(1, Date.now() - redisStart);
          const metrics = redisService.getMetrics();
          checkResults.redis = metrics.provider === "upstash-rest" && metrics.isRedisConnected ? "healthy" : "fallback";
        } catch {
          latencies.redisMs = Math.max(1, Date.now() - redisStart);
          checkResults.redis = "unhealthy";
        }

        // 2. Check Database Dependency (PostgreSQL via Supabase)
        const dbStart = Date.now();
        try {
          await withDbMonitoring(
            "db.health_check",
            async () => {
              const client = hasServiceRoleKey() ? supabaseAdmin : supabase;
              const { error } = await client.from("profiles").select("id").limit(1);
              if (error && error.code !== "PGRST116") {
                // If it's not a harmless empty result error, throw
                throw error;
              }
            },
            traceContext,
          );
          latencies.databaseMs = Math.max(1, Date.now() - dbStart);
          checkResults.database = "healthy";
        } catch (dbErr) {
          latencies.databaseMs = Math.max(1, Date.now() - dbStart);
          checkResults.database = "unhealthy";
        }

        const isReady = checkResults.database === "healthy";
        const httpStatus = isReady ? 200 : 503;

        return Response.json(
          {
            status: isReady ? "ready" : "not_ready",
            checks: checkResults,
            latencyMs: latencies,
            timestamp: new Date().toISOString(),
          },
          {
            status: httpStatus,
            headers: {
              ...corsHeaders,
              "Cache-Control": "no-cache, no-store, must-revalidate",
            },
          },
        );
      }),
    },
  },
});
