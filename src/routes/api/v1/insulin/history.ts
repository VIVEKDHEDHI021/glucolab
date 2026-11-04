import { createFileRoute } from "@tanstack/react-router";
import { createUserScopedClient } from "@/db/client.server";
import { CacheManager, CACHE_TTL } from "@/backend/services/cacheManager.server";
import { getLocalDateKey, subDaysLocal } from "@/frontend/lib/date-utils";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
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

        const url = new URL(request.url);
        const specificDate = url.searchParams.get("date");
        const days = Math.min(90, Math.max(1, parseInt(url.searchParams.get("days") || "30", 10)));

        const cacheKey = specificDate
          ? `user:${userId}:insulin:date:${specificDate}`
          : `user:${userId}:insulin:history:${days}d`;

        let cacheStatus: "HIT" | "MISS" = "MISS";

        try {
          const cachedResult = await CacheManager.getOrSet(
            cacheKey,
            CACHE_TTL.INSULIN_DAILY,
            async () => {
              cacheStatus = "MISS";

              if (specificDate) {
                // Targeted single-day fetch (e.g. for insulin dialog selector)
                const { data, error } = await userClient
                  .from("insulin_entries")
                  .select("id, entry_date, morning, lunch, afternoon, evening, night")
                  .eq("user_id", userId)
                  .eq("entry_date", specificDate)
                  .maybeSingle();

                if (error) throw error;

                if (!data) {
                  return { date: specificDate, entry: null };
                }

                // Guarantee integer units
                const entry = {
                  id: data.id,
                  entryDate: data.entry_date,
                  morning: Math.round(Number(data.morning) || 0),
                  lunch: Math.round(Number(data.lunch) || 0),
                  afternoon: Math.round(Number(data.afternoon) || 0),
                  evening: Math.round(Number(data.evening) || 0),
                  night: Math.round(Number(data.night) || 0),
                  totalUnits:
                    Math.round(Number(data.morning) || 0) +
                    Math.round(Number(data.lunch) || 0) +
                    Math.round(Number(data.afternoon) || 0) +
                    Math.round(Number(data.evening) || 0) +
                    Math.round(Number(data.night) || 0),
                };

                return { date: specificDate, entry };
              }

              // Range fetch (e.g. past N days)
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
      },
    },
  },
});
