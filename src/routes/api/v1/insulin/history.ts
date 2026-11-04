import { createFileRoute } from "@tanstack/react-router";
import { createUserScopedClient } from "@/db/client.server";
import { CacheManager, CACHE_TTL } from "@/backend/services/cacheManager.server";
import { getLocalDateKey, subDaysLocal } from "@/frontend/lib/date-utils";
import { instrumentApiHandler } from "@/backend/telemetry/instrumentation";
import { withDbMonitoring } from "@/backend/telemetry/dbMonitor";
import { RequestTracer } from "@/backend/telemetry/tracer";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Request-ID",
};

export const Route = createFileRoute("/api/v1/insulin/history")({
  server: {
    handlers: {
      OPTIONS: async () => {
        return new Response(null, {
          status: 204,
          headers: corsHeaders,
        });
      },

      GET: instrumentApiHandler("/api/v1/insulin/history", "GET", async ({ request, traceContext }) => {
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

        const url = new URL(request.url);
        const specificDate = url.searchParams.get("date"); // e.g. 2026-11-04
        const daysParam = url.searchParams.get("days");
        const days = Math.min(90, Math.max(1, parseInt(daysParam || "30", 10)));

        // Handle single-date targeted lookup (used by Insulin Selector)
        if (specificDate) {
          const cacheKey = `user:${userId}:insulin:date:${specificDate}`;
          let cacheStatus: "HIT" | "MISS" = "MISS";

          try {
            const cachedEntry = await RequestTracer.traceSpan(
              traceContext,
              "cache.insulin_date",
              "cache",
              async () => {
                return CacheManager.getOrSet(
                  cacheKey,
                  CACHE_TTL.INSULIN_DAILY,
                  async () => {
                    cacheStatus = "MISS";

                    return withDbMonitoring(
                      "db.insulin_single_date",
                      async () => {
                        const { data, error } = await userClient
                          .from("insulin_entries")
                          .select("id, entry_date, morning, lunch, afternoon, evening, night")
                          .eq("user_id", userId)
                          .eq("entry_date", specificDate)
                          .maybeSingle();

                        if (error) throw error;

                        if (!data) {
                          return {
                            entryDate: specificDate,
                            morning: 0,
                            lunch: 0,
                            afternoon: 0,
                            evening: 0,
                            night: 0,
                            totalUnits: 0,
                            exists: false,
                          };
                        }

                        const morning = Math.round(Number(data.morning) || 0);
                        const lunch = Math.round(Number(data.lunch) || 0);
                        const afternoon = Math.round(Number(data.afternoon) || 0);
                        const evening = Math.round(Number(data.evening) || 0);
                        const night = Math.round(Number(data.night) || 0);

                        return {
                          id: data.id,
                          entryDate: data.entry_date,
                          morning,
                          lunch,
                          afternoon,
                          evening,
                          night,
                          totalUnits: morning + lunch + afternoon + evening + night,
                          exists: true,
                        };
                      },
                      traceContext,
                    );
                  },
                );
              },
            );

            const latencyMs = Date.now() - start;

            return Response.json(cachedEntry, {
              status: 200,
              headers: {
                ...corsHeaders,
                "Cache-Control": "private, max-age=120",
                "X-Cache-Status": cacheStatus,
                "X-Response-Time-Ms": `${latencyMs}`,
              },
            });
          } catch (dbErr: any) {
            console.error("[InsulinHistoryAPI] Error fetching single date entry:", dbErr);
            return Response.json(
              { error: "Failed to fetch insulin record", details: dbErr?.message },
              { status: 500, headers: corsHeaders },
            );
          }
        }

        // Bounded historical window query (e.g. 30 days)
        const cacheKey = `user:${userId}:insulin:window:${days}`;
        let cacheStatus: "HIT" | "MISS" = "MISS";

        try {
          const cachedResult = await RequestTracer.traceSpan(
            traceContext,
            "cache.insulin_window",
            "cache",
            async () => {
              return CacheManager.getOrSet(
                cacheKey,
                CACHE_TTL.INSULIN_DAILY,
                async () => {
                  cacheStatus = "MISS";

                  return withDbMonitoring(
                    "db.insulin_history_window",
                    async () => {
                      const todayKey = getLocalDateKey();
                      const sinceDate = subDaysLocal(todayKey, days);

                      const { data, error } = await userClient
                        .from("insulin_entries")
                        .select("id, entry_date, morning, lunch, afternoon, evening, night")
                        .eq("user_id", userId)
                        .gte("entry_date", sinceDate)
                        .order("entry_date", { ascending: false });

                      if (error) throw error;

                      const sanitizedEntries = (data || []).map((row: any) => ({
                        id: row.id,
                        entryDate: row.entry_date,
                        morning: Math.round(Number(row.morning) || 0),
                        lunch: Math.round(Number(row.lunch) || 0),
                        afternoon: Math.round(Number(row.afternoon) || 0),
                        evening: Math.round(Number(row.evening) || 0),
                        night: Math.round(Number(row.night) || 0),
                        totalUnits:
                          Math.round(Number(row.morning) || 0) +
                          Math.round(Number(row.lunch) || 0) +
                          Math.round(Number(row.afternoon) || 0) +
                          Math.round(Number(row.evening) || 0) +
                          Math.round(Number(row.night) || 0),
                      }));

                      return {
                        windowDays: days,
                        sinceDate,
                        entries: sanitizedEntries,
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
          console.error("[InsulinHistoryAPI] Error fetching insulin history:", dbErr);
          return Response.json(
            { error: "Failed to fetch insulin records", details: dbErr?.message },
            { status: 500, headers: corsHeaders },
          );
        }
      }),
    },
  },
});
