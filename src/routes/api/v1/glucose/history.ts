import { createFileRoute } from "@tanstack/react-router";
import { createUserScopedClient } from "@/db/client.server";
import { CacheManager, CACHE_TTL } from "@/backend/services/cacheManager.server";
import { instrumentApiHandler } from "@/backend/telemetry/instrumentation";
import { withDbMonitoring } from "@/backend/telemetry/dbMonitor";
import { RequestTracer } from "@/backend/telemetry/tracer";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Request-ID",
};

export const Route = createFileRoute("/api/v1/glucose/history")({
  server: {
    handlers: {
      OPTIONS: async () => {
        return new Response(null, {
          status: 204,
          headers: corsHeaders,
        });
      },

      GET: instrumentApiHandler("/api/v1/glucose/history", "GET", async ({ request, traceContext }) => {
        const start = Date.now();
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

        let userClient: any;
        let userId: string;

        try {
          userClient = createUserScopedClient(token);
          const userRes = await RequestTracer.traceSpan(
            traceContext,
            "auth.verify_token",
            "auth",
            async () => userClient.auth.getUser(),
          );

          if (userRes.error || !userRes.data?.user) {
            return Response.json(
              { error: "Unauthorized: Session invalid or expired" },
              { status: 401, headers: corsHeaders },
            );
          }

          userId = userRes.data.user.id;
        } catch (authErr: any) {
          return Response.json(
            { error: "Authentication failed", details: authErr?.message },
            { status: 401, headers: corsHeaders },
          );
        }

        // Query parameters
        const url = new URL(request.url);
        const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10));
        const pageSize = Math.min(100, Math.max(5, parseInt(url.searchParams.get("pageSize") || "20", 10)));
        const fromIso = url.searchParams.get("from"); // e.g. 2026-10-01T00:00:00.000Z
        const toIso = url.searchParams.get("to");
        const readingType = url.searchParams.get("readingType"); // optional filter

        // Build deterministic cache key based on query filters
        const cacheKey = `user:${userId}:glucose:page:${page}:size:${pageSize}:from:${fromIso || "all"}:to:${toIso || "all"}:type:${readingType || "all"}`;
        let cacheStatus: "HIT" | "MISS" = "MISS";

        try {
          const cachedResult = await RequestTracer.traceSpan(
            traceContext,
            "cache.glucose_history",
            "cache",
            async () => {
              return CacheManager.getOrSet(
                cacheKey,
                CACHE_TTL.GLUCOSE_ANALYTICS,
                async () => {
                  cacheStatus = "MISS";

                  return withDbMonitoring(
                    "db.glucose_history_paginated",
                    async () => {
                      const offset = (page - 1) * pageSize;

                      // Base query with RLS
                      let countQuery = userClient
                        .from("glucose_entries")
                        .select("id", { count: "exact", head: true })
                        .eq("user_id", userId);

                      let dataQuery = userClient
                        .from("glucose_entries")
                        .select("id, glucose, reading_type, date_time, notes, created_at")
                        .eq("user_id", userId)
                        .order("date_time", { ascending: false })
                        .range(offset, offset + pageSize - 1);

                      if (fromIso) {
                        countQuery = countQuery.gte("date_time", fromIso);
                        dataQuery = dataQuery.gte("date_time", fromIso);
                      }
                      if (toIso) {
                        countQuery = countQuery.lte("date_time", toIso);
                        dataQuery = dataQuery.lte("date_time", toIso);
                      }
                      if (readingType && readingType !== "all") {
                        countQuery = countQuery.eq("reading_type", readingType);
                        dataQuery = dataQuery.eq("reading_type", readingType);
                      }

                      const [countRes, dataRes] = await Promise.all([countQuery, dataQuery]);

                      if (dataRes.error) throw dataRes.error;

                      const totalCount = countRes.count || 0;
                      const totalPages = Math.ceil(totalCount / pageSize);
                      const readings = dataRes.data || [];

                      // Calculate batch statistics for requested range
                      let inTarget = 0;
                      let high = 0;
                      let low = 0;
                      let sum = 0;

                      for (const r of readings) {
                        const val = Number(r.glucose);
                        sum += val;
                        if (val < 70) low++;
                        else if (val > 180) high++;
                        else inTarget++;
                      }

                      const countInBatch = readings.length;
                      const stats = {
                        average: countInBatch > 0 ? Math.round(sum / countInBatch) : null,
                        inTargetPercent: countInBatch > 0 ? Math.round((inTarget / countInBatch) * 100) : 0,
                        highPercent: countInBatch > 0 ? Math.round((high / countInBatch) * 100) : 0,
                        lowPercent: countInBatch > 0 ? Math.round((low / countInBatch) * 100) : 0,
                      };

                      return {
                        page,
                        pageSize,
                        totalCount,
                        totalPages,
                        hasMore: page < totalPages,
                        readings,
                        stats,
                        cachedAt: new Date().toISOString(),
                      };
                    },
                    traceContext,
                  );
                },
              );
            },
          );

          const latencyMs = Date.now() - start;

          return Response.json(cachedResult, {
            status: 200,
            headers: {
              ...corsHeaders,
              "Cache-Control": "private, max-age=120",
              "X-Cache-Status": cacheStatus,
              "X-Response-Time-Ms": `${latencyMs}`,
            },
          });
        } catch (dbErr: any) {
          console.error("[GlucoseHistoryAPI] Error fetching history:", dbErr);
          return Response.json(
            { error: "Failed to fetch glucose history", details: dbErr?.message },
            { status: 500, headers: corsHeaders },
          );
        }
      }),
    },
  },
});
