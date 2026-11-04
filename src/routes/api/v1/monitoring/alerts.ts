import { createFileRoute } from "@tanstack/react-router";
import { alertManager } from "@/backend/telemetry/alertManager";
import { instrumentApiHandler } from "@/backend/telemetry/instrumentation";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Request-ID",
};

export const Route = createFileRoute("/api/v1/monitoring/alerts")({
  server: {
    handlers: {
      OPTIONS: async () => {
        return new Response(null, {
          status: 204,
          headers: corsHeaders,
        });
      },

      GET: instrumentApiHandler("/api/v1/monitoring/alerts", "GET", async () => {
        const alerts = alertManager.getActiveAlerts();

        return Response.json(
          {
            status: "ok",
            alerts,
            count: alerts.length,
            timestamp: new Date().toISOString(),
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

