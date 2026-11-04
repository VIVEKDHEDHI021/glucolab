import { createFileRoute } from "@tanstack/react-router";
import { alertManager } from "@/backend/telemetry/alertManager";
import { instrumentApiHandler } from "@/backend/telemetry/instrumentation";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Request-ID",
};

export const Route = createFileRoute("/api/v1/health/")({
  server: {
    handlers: {
      OPTIONS: async () => {
        return new Response(null, {
          status: 204,
          headers: corsHeaders,
        });
      },

      GET: instrumentApiHandler("/api/v1/health", "GET", async () => {
        const healthStatus = alertManager.getSystemHealthStatus();
        const uptimeSeconds = Math.floor(process.uptime ? process.uptime() : 0);

        return Response.json(
          {
            status: healthStatus,
            version: "1.6.0",
            environment: process.env.NODE_ENV || "production",
            uptimeSeconds,
            timestamp: new Date().toISOString(),
          },
          {
            status: healthStatus === "unhealthy" ? 503 : 200,
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

