import { createFileRoute } from "@tanstack/react-router";
import { telemetryMetrics } from "@/backend/telemetry/metrics";
import { redisService } from "@/backend/services/redisService.server";
import { alertManager } from "@/backend/telemetry/alertManager";
import { errorTracker } from "@/backend/telemetry/errorTracker";
import { instrumentApiHandler } from "@/backend/telemetry/instrumentation";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Request-ID",
};

export const Route = createFileRoute("/api/v1/monitoring/metrics")({
  server: {
    handlers: {
      OPTIONS: async () => {
        return new Response(null, {
          status: 204,
          headers: corsHeaders,
        });
      },

      GET: instrumentApiHandler("/api/v1/monitoring/metrics", "GET", async () => {
        const summary = telemetryMetrics.getSummary();
        const redisMetrics = redisService.getMetrics();
        const activeAlerts = alertManager.getActiveAlerts();
        const recentErrors = errorTracker.getRecentErrors();

        return Response.json(
          {
            status: "ok",
            timestamp: new Date().toISOString(),
            overallHealth: alertManager.getSystemHealthStatus(),
            api: summary.api,
            database: summary.database,
            redis: redisMetrics,
            system: summary.system,
            alerts: activeAlerts,
            recentErrors: recentErrors.slice(0, 10), // Most recent 10 scrubbed errors
          },
          {
            status: 200,
            headers: {
              ...corsHeaders,
              "Cache-Control": "private, no-cache, no-store",
            },
          },
        );
      }),
    },
  },
});
