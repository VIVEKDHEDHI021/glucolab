import { createFileRoute } from "@tanstack/react-router";
import { createUserScopedClient } from "@/db/client.server";
import { CacheManager, CACHE_TTL } from "@/backend/services/cacheManager.server";
import { getLocalDateKey, subDaysLocal } from "@/frontend/lib/date-utils";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export const Route = createFileRoute("/api/v1/dashboard/summary")({
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

        // 1. Authenticate user via Supabase Bearer token
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
          return Response.json(
            { error: "Unauthorized: Missing or invalid Bearer token" },
            { status: 401, headers: corsHeaders },
          );
        }

        const token = authHeader.split(" ")[1]?.trim();
        if (!token) {
          return Response.json(
            { error: "Unauthorized: Empty token provided" },
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

        // 2. Cache-Aside Pattern with Redis
        const cacheKey = CacheManager.keys.dashboardSummary(userId);
        let cacheStatus: "HIT" | "MISS" = "MISS";

        try {
          // Check if already in cache before executing DB queries
          const cached = await CacheManager.getOrSet(
            cacheKey,
            CACHE_TTL.DASHBOARD_SUMMARY,
            async () => {
              cacheStatus = "MISS";

              // 3. Database Queries: Parallelized, indexed, date-bounded queries
              const todayKey = getLocalDateKey();
              const sevenDaysAgoDate = subDaysLocal(todayKey, 7);
              const sevenDaysAgoIso = `${sevenDaysAgoDate}T00:00:00.000Z`;

              const [glucoseRes, insulinRes, weightRes, profileRes] = await Promise.all([
                // Recent glucose (indexed on user_id, date_time DESC)
                userClient
                  .from("glucose_entries")
                  .select("id, glucose, reading_type, date_time, notes")
                  .eq("user_id", userId)
                  .gte("date_time", sevenDaysAgoIso)
                  .order("date_time", { ascending: false })
                  .limit(100),

                // Recent insulin (indexed on user_id, entry_date DESC)
                userClient
                  .from("insulin_entries")
                  .select("id, entry_date, morning, lunch, afternoon, evening, night")
                  .eq("user_id", userId)
                  .gte("entry_date", sevenDaysAgoDate)
                  .order("entry_date", { ascending: false })
                  .limit(10),

                // Latest weight (single row)
                userClient
                  .from("weight_entries")
                  .select("id, weight_kg, entry_date")
                  .eq("user_id", userId)
                  .order("entry_date", { ascending: false })
                  .limit(1)
                  .maybeSingle(),

                // Profile
                userClient
                  .from("profiles")
                  .select("name, age, diabetes_type, onboarding_completed")
                  .eq("user_id", userId)
                  .maybeSingle(),
              ]);

              const glucoseReadings = glucoseRes.data || [];
              const insulinEntries = insulinRes.data || [];
              const latestWeight = weightRes.data || null;
              const profile = profileRes.data || null;

              // 4. In-Memory Statistical Aggregations
              const todayGlucose = glucoseReadings.filter((g: any) =>
                g.date_time?.startsWith(todayKey),
              );

              const latestReading = glucoseReadings.length > 0 ? glucoseReadings[0] : null;

              // Time-In-Range (TIR) calculations
              let inTargetCount = 0;
              let highCount = 0;
              let lowCount = 0;
              let glucoseSum = 0;

              for (const r of glucoseReadings) {
                const val = Number(r.glucose);
                glucoseSum += val;
                if (val < 70) lowCount++;
                else if (val > 180) highCount++;
                else inTargetCount++;
              }

              const totalReadings = glucoseReadings.length;
              const tir = {
                inTargetPercent: totalReadings > 0 ? Math.round((inTargetCount / totalReadings) * 100) : 0,
                highPercent: totalReadings > 0 ? Math.round((highCount / totalReadings) * 100) : 0,
                lowPercent: totalReadings > 0 ? Math.round((lowCount / totalReadings) * 100) : 0,
                totalReadings,
                averageGlucose: totalReadings > 0 ? Math.round(glucoseSum / totalReadings) : null,
              };

              // Today's insulin aggregation
              const todayInsulinEntry = insulinEntries.find(
                (i: any) => i.entry_date === todayKey || i.entry_date?.startsWith(todayKey),
              );

              const todayInsulinTotal = todayInsulinEntry
                ? (Number(todayInsulinEntry.morning) || 0) +
                  (Number(todayInsulinEntry.lunch) || 0) +
                  (Number(todayInsulinEntry.afternoon) || 0) +
                  (Number(todayInsulinEntry.evening) || 0) +
                  (Number(todayInsulinEntry.night) || 0)
                : 0;

              // Sparkline values (chronological order)
              const sparkline = glucoseReadings
                .slice(0, 10)
                .map((g: any) => Number(g.glucose))
                .reverse();

              return {
                userId,
                date: todayKey,
                summary: {
                  latestGlucose: latestReading
                    ? {
                        glucose: latestReading.glucose,
                        readingType: latestReading.reading_type,
                        dateTime: latestReading.date_time,
                      }
                    : null,
                  todayGlucoseCount: todayGlucose.length,
                  timeInRange: tir,
                  insulin: {
                    todayTotalUnits: todayInsulinTotal,
                    hasLoggedToday: Boolean(todayInsulinEntry),
                    todaySlots: todayInsulinEntry || null,
                    latestEntry: insulinEntries.length > 0 ? insulinEntries[0] : null,
                  },
                  weight: latestWeight
                    ? {
                        weightKg: latestWeight.weight_kg,
                        entryDate: latestWeight.entry_date,
                      }
                    : null,
                  profile: {
                    name: profile?.name || "",
                    diabetesType: profile?.diabetes_type || null,
                    onboardingCompleted: profile?.onboarding_completed || false,
                  },
                  sparkline,
                },
                cachedAt: new Date().toISOString(),
              };
            },
          );

          const latencyMs = Date.now() - start;

          return Response.json(cached, {
            status: 200,
            headers: {
              ...corsHeaders,
              "Cache-Control": "private, max-age=60",
              "X-Cache-Status": cacheStatus,
              "X-Response-Time-Ms": `${latencyMs}`,
            },
          });
        } catch (dbErr: any) {
          console.error("[DashboardSummaryAPI] Error executing dashboard summary:", dbErr);
          return Response.json(
            { error: "Failed to generate dashboard summary", details: dbErr?.message },
            { status: 500, headers: corsHeaders },
          );
        }
      },
    },
  },
});

