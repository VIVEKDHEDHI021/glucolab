import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/db/client.server";
import { reminderEngine } from "@/backend/services/reminderEngine.server";

export const Route = createFileRoute("/api/reminders/check")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        return handleCheck(request);
      },
      POST: async ({ request }) => {
        return handleCheck(request);
      },
    },
  },
});

async function handleCheck(request: Request) {
  try {
    const authHeader = request.headers.get("authorization");
    const token = authHeader?.replace(/^Bearer\s+/i, "").trim();

    let authenticatedUserId: string | null = null;
    let isServiceRole = false;

    if (token) {
      // Check if token matches service role key
      const serviceKey =
        process.env.SUPABASE_SERVICE_ROLE_KEY ||
        process.env.SUPABASE_PUBLISHABLE_KEY ||
        process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

      if (serviceKey && token === serviceKey) {
        isServiceRole = true;
      } else {
        const {
          data: { user },
          error: authErr,
        } = await supabaseAdmin.auth.getUser(token);
        if (!authErr && user) {
          authenticatedUserId = user.id;
        }
      }
    }

    // Optional query parameter or body parameter to evaluate a specific user
    const url = new URL(request.url);
    const queryUserId = url.searchParams.get("userId");

    // If service role or no user restriction, check all users (e.g. cron schedule)
    if (isServiceRole || (!authenticatedUserId && !queryUserId)) {
      console.log("[api/reminders/check] Triggering batch reminder check for all active patients...");
      const batchResults = await reminderEngine.evaluateAllUsers();
      return Response.json({
        success: true,
        count: batchResults.length,
        results: batchResults,
      });
    }

    // Otherwise evaluate specific user (enforcing user isolation)
    const targetUserId = authenticatedUserId || queryUserId;

    if (authenticatedUserId && queryUserId && authenticatedUserId !== queryUserId) {
      return Response.json(
        { error: "Forbidden: Cannot evaluate reminders for other users." },
        { status: 403 },
      );
    }

    if (!targetUserId) {
      return Response.json(
        { error: "Unauthorized: Missing authentication or target userId." },
        { status: 401 },
      );
    }

    console.log(`[api/reminders/check] Evaluating reminders for user ${targetUserId}...`);
    const result = await reminderEngine.evaluateUser(targetUserId);

    return Response.json({
      success: true,
      result,
    });
  } catch (e: any) {
    console.error("[api/reminders/check] Uncaught error:", e);
    return Response.json(
      { error: e instanceof Error ? e.message : "Internal Server Error" },
      { status: 500 },
    );
  }
}
