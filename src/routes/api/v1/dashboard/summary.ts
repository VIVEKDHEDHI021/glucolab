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

export const Route = createFileRoute("/api/v1/dashboard/summary")({
  server: {
    handlers: {
      OPTIONS: async () => {
        return new Response(null, {
          status: 204,
          headers: corsHeaders,
        });
      },

      GET: instrumentApiHandler("/api/v1/dashboard/summary", "GET", async ({ request, traceContext }) => {
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

        // 2. Cache-Aside Pattern with Redis
        const cacheKey = CacheManager.keys.dashboardSummary(userId);
        let cacheStatus: "HIT" | "MISS" = "MISS";

        try {
          // Check if already in cache before executing DB queries
          const cached = await RequestTracer.traceSpan(
            traceContext,
            "cache.get_or_set_dashboard_summary",
            "cache",
            async () => {
              return CacheManager.getOrSet(
                cacheKey,
                CACHE_TTL.DASHBOARD_SUMMARY,
                async () => {
                  cacheStatus = "MISS";

                  // 3. Database Queries: Parallelized, indexed, date-bounded queries
                  return withDbMonitoring(
                    "db.dashboard_summary_parallel",
                    async () => {
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
                      const todayReadings = glucoseReadings.filter((g: any) =>
                        g.date_time?.startsWith(todayKey),
                      );

                      // Latest reading
                      const latestReading = glucoseReadings[0] || null;

                      // Time In Range (TIR) 7-day calculation
                      let inTarget = 0;
                      let high = 0;
                      let low = 0;
                      const validReadings = glucoseReadings.filter(
                        (g: any) => typeof g.glucose === "number" && g.glucose > 0,
                      );

                      for (const r of validReadings) {
                        if (r.glucose < 70) low++;
                        else if (r.glucose > 180) high++;
                        else inTarget++;
                      }

                      const totalReadings = validReadings.length;
                      const tir = {
                        inTargetPercent: totalReadings > 0 ? Math.round((inTarget / totalReadings) * 100) : 0,
                        highPercent: totalReadings > 0 ? Math.round((high / totalReadings) * 100) : 0,
                        lowPercent: totalReadings > 0 ? Math.round((low / totalReadings) * 100) : 0,
                        totalReadings,
                        periodDays: 7,
                      };

                      // Today's Insulin Totals (Decimal Units Supported)
                      const parseDose = (val: any) => {
                        if (val === null || val === undefined) return 0;
                        const num = Number(val);
                        return Number.isFinite(num) ? Math.round((num + Number.EPSILON) * 100) / 100 : 0;
                      };

                      const insulinRows = insulinRes.data || [];
                      const todayInsulinRow = insulinRows.find((i: any) => i.entry_date === todayKey) || null;

                      let todayTotalInsulinUnits = 0;
                      let morningUnits = 0;
                      let lunchUnits = 0;
                      let afternoonUnits = 0;
                      let eveningUnits = 0;
                      let nightUnits = 0;

                      if (todayInsulinRow) {
                        morningUnits = parseDose(todayInsulinRow.morning);
                        lunchUnits = parseDose(todayInsulinRow.lunch);
                        afternoonUnits = parseDose(todayInsulinRow.afternoon);
                        eveningUnits = parseDose(todayInsulinRow.evening);
                        nightUnits = parseDose(todayInsulinRow.night);
                        todayTotalInsulinUnits =
                          Math.round(
                            (morningUnits + lunchUnits + afternoonUnits + eveningUnits + nightUnits + Number.EPSILON) *
                              100,
                          ) / 100;
                      }

                      // Latest recorded insulin entry across all days
                      const latestInsulinRow = insulinRows[0] || null;
                      let lim = 0, lil = 0, lia = 0, lie = 0, lin = 0;
                      if (latestInsulinRow) {
                        lim = parseDose(latestInsulinRow.morning);
                        lil = parseDose(latestInsulinRow.lunch);
                        lia = parseDose(latestInsulinRow.afternoon);
                        lie = parseDose(latestInsulinRow.evening);
                        lin = parseDose(latestInsulinRow.night);
                      }

                      // Latest weight & profile
                      const latestWeight = weightRes.data || null;
                      const profile = profileRes.data || null;

                      // Micro sparkline data points (last 10 glucose readings in chronological order)
                      const sparkline = glucoseReadings
                        .slice(0, 10)
                        .reverse()
                        .map((g: any) => ({
                          time: g.date_time,
                          glucose: g.glucose,
                        }));

                      return {
                        todayDate: todayKey,
                        latestReading: latestReading
                          ? {
                              id: latestReading.id,
                              glucose: latestReading.glucose,
                              readingType: latestReading.reading_type,
                              dateTime: latestReading.date_time,
                            }
                          : null,
                        todayGlucoseCount: todayReadings.length,
                        todayInsulin: {
                          totalUnits: todayTotalInsulinUnits,
                          breakdown: {
                            morning: morningUnits,
                            lunch: lunchUnits,
                            afternoon: afternoonUnits,
                            evening: eveningUnits,
                            night: nightUnits,
                          },
                        },
                        latestInsulin: latestInsulinRow
                          ? {
                              id: latestInsulinRow.id,
                              entryDate: latestInsulinRow.entry_date,
                              morning: lim,
                              lunch: lil,
                              afternoon: lia,
                              evening: lie,
                              night: lin,
                              totalUnits: lim + lil + lia + lie + lin,
                            }
                          : null,
                        tir,
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
                      };
                    },
                    traceContext,
                  );
                },
              );
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
      }),
    },
  },
});
