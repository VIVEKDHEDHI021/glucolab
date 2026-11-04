import { createFileRoute } from "@tanstack/react-router";
import { redisService } from "@/backend/services/redisService.server";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export const Route = createFileRoute("/api/v1/cache/metrics")({
  server: {
    handlers: {
      OPTIONS: async () => {
        return new Response(null, {
          status: 204,
          headers: corsHeaders,
        });
      },

      GET: async () => {
        const metrics = redisService.getMetrics();
        return Response.json(
          {
            status: "ok",
            metrics,
            timestamp: new Date().toISOString(),
          },
          {
            status: 200,
            headers: corsHeaders,
          },
        );
      },
    },
  },
});

