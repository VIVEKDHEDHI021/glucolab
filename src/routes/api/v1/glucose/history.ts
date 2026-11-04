import { createFileRoute } from "@tanstack/react-router";
import { createUserScopedClient } from "@/db/client.server";
import { CacheManager, CACHE_TTL } from "@/backend/services/cacheManager.server";
import { redisService } from "@/backend/services/redisService.server";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
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

      GET: async ({ request }) => {
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
          const {
            data: { user },
            error,
          } = await userClient.auth.getUser();

          if (error || !user) {
            return Response.json(
              { error: "Unauthorized: Session invalid or expired" },
              { status: 401, headers: corsHeaders },
            );
          }

          userId = user.id;
        } catch (authErr: any) {
          return Response.json(
            { error: "Authentication failed", details: authErr?.message },
            { status: 401, headers: corsHeaders },
          );
        }

        // Parse query parameters
        const url = new URL(request.url);
        const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10));
        const pageSize = Math.min(100, Math.max(1, parseInt(url.searchParams.get("pageSize") || "20", 10)));
        const from = url.searchParams.get("from");
        const to = url.searchParams.get("to");
        const readingType = url.searchParams.get("readingType");

        // Construct unique deterministic cache key
        const cacheKey = `user:${userId}:glucose:history:p${page}_s${pageSize}_f${from || "all"}_t${to || "all"}_rt${readingType || "all"}`;
        let cacheStatus: "HIT" | "MISS" = "MISS";

        try {
          const cachedResult = await CacheManager.getOrSet(
            cacheKey,
            CACHE_TTL.GLUCOSE_ANALYTICS,
            async () => {
              cacheStatus = "MISS";

              // Build indexed Supabase range query
              let query = userClient
                .from("glucose_entries")
                .select("id, glucose, reading_type, date_time, notes, symptoms", { count: "exact" })
                .eq("user_id", userId)
                .order("date_time", { ascending: false });

              if (from) {
                const fromIso = from.includes("T") ? from : `${from}T00:00:00.000Z`;
                query = query.gte("date_time", fromIso);
              }

              if (to) {
                const toIso = to.includes("T") ? to : `${to}T23:59:59.999Z`;
                query = query.lte("date_time", toIso);
              }

              if (readingType) {
                query = query.eq("reading_type", readingType);
              }

              const fromIndex = (page - 1) * pageSize;
              const toIndex = fromIndex + pageSize - 1;
              const { data, count, error } = await query.range(fromIndex, toIndex);

              if (error) throw error;

              const totalCount = count || 0;
              const totalPages = Math.ceil(totalCount / pageSize);
              const readings = data || [];

              // Calculate range statistics
              let inTarget = 0, high = 0, low = 0, sum = 0;
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
      },
    },
  },
});
