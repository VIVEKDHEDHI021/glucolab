import { createFileRoute } from "@tanstack/react-router";
import { createUserScopedClient } from "@/db/client.server";
import { CacheManager } from "@/backend/services/cacheManager.server";
import { instrumentApiHandler } from "@/backend/telemetry/instrumentation";
import { RequestTracer } from "@/backend/telemetry/tracer";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Request-ID",
};

export const Route = createFileRoute("/api/v1/cache/invalidate")({
  server: {
    handlers: {
      OPTIONS: async () => {
        return new Response(null, {
          status: 204,
          headers: corsHeaders,
        });
      },

      POST: instrumentApiHandler("/api/v1/cache/invalidate", "POST", async ({ request, traceContext }) => {
        const authHeader = request.headers.get("Authorization");

        if (!authHeader || !authHeader.startsWith("Bearer ")) {
          return Response.json(
            { error: "Unauthorized: Missing Bearer token" },
            { status: 401, headers: corsHeaders },
          );
        }

        const token = authHeader.split(" ")[1]?.trim();
        if (!token) {
          return Response.json(
            { error: "Unauthorized: Empty token" },
            { status: 401, headers: corsHeaders },
          );
        }

        try {
          const userClient = createUserScopedClient(token);
          const userRes = await RequestTracer.traceSpan(
            traceContext,
            "auth.verify_token",
            "auth",
            async () => userClient.auth.getUser(),
          );

          if (userRes.error || !userRes.data?.user) {
            return Response.json(
              { error: "Unauthorized: Invalid session" },
              { status: 401, headers: corsHeaders },
            );
          }

          const user = userRes.data.user;
          const body = await request.json().catch(() => ({}));
          const entity = body.entity || "all";

          await RequestTracer.traceSpan(
            traceContext,
            `cache.invalidate_${entity}`,
            "cache",
            async () => {
              switch (entity) {
                case "glucose":
                  await CacheManager.invalidateGlucose(user.id);
                  break;
                case "insulin":
                  await CacheManager.invalidateInsulin(user.id);
                  break;
                case "weight":
                  await CacheManager.invalidateWeight(user.id);
                  break;
                case "food":
                  await CacheManager.invalidateFood(user.id);
                  break;
                case "profile":
                  await CacheManager.invalidateProfile(user.id);
                  break;
                default:
                  await Promise.all([
                    CacheManager.invalidateGlucose(user.id),
                    CacheManager.invalidateInsulin(user.id),
                    CacheManager.invalidateWeight(user.id),
                    CacheManager.invalidateFood(user.id),
                    CacheManager.invalidateProfile(user.id),
                  ]);
                  break;
              }
            },
          );

          return Response.json(
            { success: true, entity, timestamp: new Date().toISOString() },
            { status: 200, headers: corsHeaders },
          );
        } catch (err: any) {
          console.warn("[CacheInvalidateAPI] Invalidation error:", err);
          // Never fail hard on cache invalidation
          return Response.json(
            { success: false, warning: err?.message },
            { status: 200, headers: corsHeaders },
          );
        }
      }),
    },
  },
});
